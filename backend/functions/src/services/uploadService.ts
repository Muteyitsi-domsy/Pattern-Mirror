import { randomUUID, createHash } from 'crypto';
import { Storage } from '@google-cloud/storage';
import { Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { db, storageBucketName } from '../firebaseAdmin';
import { ValidationError } from '../errors';
import { DataType } from '../models/Job';
import { Upload } from '../models/Upload';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB, per API_SPEC.md 4.3
const UPLOAD_URL_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const SUPPORTED_FORMATS = ['csv', 'json', 'txt', 'md'] as const;
type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

const UPLOADS_COLLECTION = 'uploads';

function extensionOf(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function contentTypeFor(format: string): string {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'json':
      return 'application/json';
    case 'md':
      return 'text/markdown';
    default:
      return 'text/plain';
  }
}

/**
 * Validates the declared dataType enum. Note: this does not *infer* a data
 * type from file content — the user explicitly selects it in the upload UI
 * (DESIGN_SYSTEM.md's upload screen), so "detection" here means validating
 * the declared value, not content-based classification.
 */
export function detectDataType(dataType: string): DataType {
  if (dataType !== 'structured' && dataType !== 'semi' && dataType !== 'unstructured') {
    throw new ValidationError('dataType must be one of: structured, semi, unstructured', {
      field: 'dataType',
    });
  }
  return dataType;
}

export interface UploadUrlResult {
  uploadId: string;
  uploadUrl: string;
  storagePath: string;
}

/**
 * V4 signed URLs need either a real private key or (what deployed Cloud
 * Functions get) the ability to call IAM signBlob as the function's own
 * identity — neither is available to the emulator by default, which fails
 * with "Cannot sign data without client_email". STORAGE_SIGNING_KEY_PATH
 * (set only in backend/functions/.env, gitignored) points at a narrowly
 * scoped local-dev-only service account key for this case. Deliberately not
 * named GOOGLE_APPLICATION_CREDENTIALS: the Firebase CLI's emulator startup
 * overrides that specific var with its own login-derived credential before
 * the function process's .env ever loads, silently shadowing any value set
 * there. See DEVELOPMENT.md and Coding Build Docs/DEPLOYMENT.md section 6.
 */
function signingBucket() {
  const keyPath = process.env.STORAGE_SIGNING_KEY_PATH;
  if (keyPath) {
    return new Storage({ keyFilename: keyPath }).bucket(storageBucketName as string);
  }
  return getStorage().bucket();
}

/**
 * POST /api/reports/upload-url. Cloud Functions gen2 hard-caps HTTP request
 * bodies at 32MB (non-configurable) — base64-encoding the documented 50MB
 * file limit needs ~66.7MB, so large files upload directly to Cloud Storage
 * via this signed URL instead of through our API. See API_SPEC.md 4.3.
 */
export async function createUploadUrl(userId: string, fileName: string): Promise<UploadUrlResult> {
  if (!fileName) {
    throw new ValidationError('fileName is required', { field: 'fileName' });
  }

  const format = extensionOf(fileName);
  if (!SUPPORTED_FORMATS.includes(format as SupportedFormat)) {
    throw new ValidationError(`Unsupported file format: ${format || '(none)'}`, {
      field: 'fileName',
    });
  }

  const uploadId = randomUUID();
  const storagePath = `temp/${uploadId}/journal.${format}`;

  const bucket = signingBucket();
  const [uploadUrl] = await bucket.file(storagePath).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + UPLOAD_URL_EXPIRY_MS,
    contentType: contentTypeFor(format),
  });

  const upload: Upload = {
    uploadId,
    userId,
    storagePath,
    fileName,
    createdAt: Timestamp.now(),
    consumedByJobId: null,
  };
  await db.collection(UPLOADS_COLLECTION).doc(uploadId).set(upload);

  return { uploadId, uploadUrl, storagePath };
}

/**
 * Resolves an uploadId to its Upload record, enforcing ownership (404-style
 * ValidationError, not a leak of "wrong owner" vs "doesn't exist") and that
 * it hasn't already been consumed by a prior job.
 */
export async function getOwnedUpload(userId: string, uploadId: string): Promise<Upload> {
  const doc = await db.collection(UPLOADS_COLLECTION).doc(uploadId).get();

  if (!doc.exists) {
    throw new ValidationError('Upload not found', { field: 'uploadId' });
  }

  const upload = doc.data() as Upload;
  if (upload.userId !== userId || upload.consumedByJobId) {
    throw new ValidationError('Upload not found', { field: 'uploadId' });
  }

  return upload;
}

export async function markUploadConsumed(uploadId: string, jobId: string): Promise<void> {
  await db.collection(UPLOADS_COLLECTION).doc(uploadId).update({ consumedByJobId: jobId });
}

/**
 * Downloads and validates the file the client already PUT to storagePath.
 * Throws ValidationError if the direct upload was never completed, or if
 * it ended up over the 50MB limit (the real enforcement point now — Storage
 * has no request-size ceiling the way Cloud Functions' HTTP trigger does).
 */
export async function getUploadedFile(storagePath: string): Promise<Buffer> {
  const file = getStorage().bucket().file(storagePath);
  const [exists] = await file.exists();

  if (!exists) {
    throw new ValidationError('Uploaded file not found — complete the direct upload first', {
      field: 'uploadId',
    });
  }

  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size ?? 0);
  if (size > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(`Uploaded file exceeds maximum size of ${MAX_FILE_SIZE_BYTES} bytes`, {
      field: 'uploadId',
    });
  }

  const [buffer] = await file.download();
  return buffer;
}

export function hashContent(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Rough line count used for the job's journalCount field. Reasonable for
 * CSV/TXT/MD; for JSON it's an approximation, not a true entry count —
 * acceptable since journalCount is informational (shown in report summaries),
 * not used for billing or analysis logic.
 */
export function calculateLineCount(buffer: Buffer): number {
  const text = buffer.toString('utf-8');
  return text.split('\n').filter((line) => line.trim().length > 0).length;
}
