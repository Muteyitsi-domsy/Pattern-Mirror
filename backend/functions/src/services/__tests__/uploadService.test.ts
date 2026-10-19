import {
  detectDataType,
  createUploadUrl,
  getOwnedUpload,
  markUploadConsumed,
  getUploadedFile,
  hashContent,
  calculateLineCount,
} from '../uploadService';
import { ValidationError } from '../../errors';
import { getStorage } from 'firebase-admin/storage';
import { db } from '../../firebaseAdmin';

jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn(),
}));

jest.mock('../../firebaseAdmin', () => ({
  db: { collection: jest.fn() },
}));

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: { now: jest.fn(() => ({ seconds: 1700000000, nanoseconds: 0 })) },
}));

describe('detectDataType', () => {
  it('accepts each documented value', () => {
    expect(detectDataType('structured')).toBe('structured');
    expect(detectDataType('semi')).toBe('semi');
    expect(detectDataType('unstructured')).toBe('unstructured');
  });

  it('rejects an invalid value', () => {
    expect(() => detectDataType('bogus')).toThrow(ValidationError);
  });
});

describe('createUploadUrl', () => {
  function mockBucket() {
    const getSignedUrl = jest.fn().mockResolvedValue(['https://storage.googleapis.com/signed-url']);
    const file = jest.fn().mockReturnValue({ getSignedUrl });
    (getStorage as jest.Mock).mockReturnValue({
      bucket: jest.fn().mockReturnValue({ file }),
    });
    return { file, getSignedUrl };
  }

  it('rejects a missing fileName', async () => {
    await expect(createUploadUrl('user_abc123', '')).rejects.toThrow(ValidationError);
  });

  it('rejects an unsupported file format', async () => {
    await expect(createUploadUrl('user_abc123', 'journal.exe')).rejects.toThrow(/Unsupported file format/);
  });

  it('creates a signed URL and an ownership-tracking doc', async () => {
    const { file } = mockBucket();
    const set = jest.fn().mockResolvedValue(undefined);
    (db.collection as jest.Mock).mockReturnValue({ doc: jest.fn().mockReturnValue({ set }) });

    const result = await createUploadUrl('user_abc123', 'journal.csv');

    expect(result.uploadUrl).toBe('https://storage.googleapis.com/signed-url');
    expect(result.storagePath).toMatch(/^temp\/.+\/journal\.csv$/);
    expect(file).toHaveBeenCalledWith(result.storagePath);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user_abc123', consumedByJobId: null }));
  });
});

describe('getOwnedUpload', () => {
  function mockUploadDoc(exists: boolean, data?: Record<string, unknown>) {
    const get = jest.fn().mockResolvedValue({ exists, data: () => data });
    (db.collection as jest.Mock).mockReturnValue({ doc: jest.fn().mockReturnValue({ get }) });
  }

  it('throws when the upload does not exist', async () => {
    mockUploadDoc(false);
    await expect(getOwnedUpload('user_abc123', 'upload_1')).rejects.toThrow(ValidationError);
  });

  it("throws when the upload belongs to a different user (doesn't leak existence)", async () => {
    mockUploadDoc(true, { userId: 'someone_else', consumedByJobId: null });
    await expect(getOwnedUpload('user_abc123', 'upload_1')).rejects.toThrow(/not found/);
  });

  it('throws when the upload was already consumed by a prior job', async () => {
    mockUploadDoc(true, { userId: 'user_abc123', consumedByJobId: 'job_999' });
    await expect(getOwnedUpload('user_abc123', 'upload_1')).rejects.toThrow(/not found/);
  });

  it('returns the upload when owned and unconsumed', async () => {
    const upload = { uploadId: 'upload_1', userId: 'user_abc123', consumedByJobId: null, storagePath: 'temp/upload_1/journal.csv' };
    mockUploadDoc(true, upload);
    await expect(getOwnedUpload('user_abc123', 'upload_1')).resolves.toEqual(upload);
  });
});

describe('markUploadConsumed', () => {
  it('sets consumedByJobId', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    (db.collection as jest.Mock).mockReturnValue({ doc: jest.fn().mockReturnValue({ update }) });

    await markUploadConsumed('upload_1', 'job_123');

    expect(update).toHaveBeenCalledWith({ consumedByJobId: 'job_123' });
  });
});

describe('getUploadedFile', () => {
  function mockFile(opts: { exists: boolean; size?: number; content?: string }) {
    const download = jest.fn().mockResolvedValue([Buffer.from(opts.content ?? 'content')]);
    const getMetadata = jest.fn().mockResolvedValue([{ size: opts.size ?? 100 }]);
    const exists = jest.fn().mockResolvedValue([opts.exists]);
    const file = jest.fn().mockReturnValue({ exists, getMetadata, download });
    (getStorage as jest.Mock).mockReturnValue({ bucket: jest.fn().mockReturnValue({ file }) });
  }

  it('throws when the file was never uploaded', async () => {
    mockFile({ exists: false });
    await expect(getUploadedFile('temp/upload_1/journal.csv')).rejects.toThrow(/complete the direct upload/);
  });

  it('throws when the uploaded file exceeds 50MB', async () => {
    mockFile({ exists: true, size: 51 * 1024 * 1024 });
    await expect(getUploadedFile('temp/upload_1/journal.csv')).rejects.toThrow(/exceeds maximum size/);
  });

  it('downloads and returns the file when valid', async () => {
    mockFile({ exists: true, size: 100, content: 'hello' });
    const buffer = await getUploadedFile('temp/upload_1/journal.csv');
    expect(buffer.toString('utf-8')).toBe('hello');
  });
});

describe('hashContent', () => {
  it('produces a stable SHA256 hex digest', () => {
    const hash = hashContent(Buffer.from('hello'));
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
});

describe('calculateLineCount', () => {
  it('counts non-empty lines', () => {
    const buffer = Buffer.from('line1\nline2\n\n   \nline3');
    expect(calculateLineCount(buffer)).toBe(3);
  });
});
