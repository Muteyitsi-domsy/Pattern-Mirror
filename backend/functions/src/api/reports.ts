import { Request, Response } from 'express';
import { createJob, enqueueJob, getJob } from '../services/jobService';
import { checkRateLimit } from '../services/rateLimitService';
import { getUser } from '../services/userService';
import {
  checkPaymentRequired,
  consumeCheckout,
  createLemonSqueezyCheckout,
  findPaidCheckout,
} from '../services/paymentService';
import {
  calculateLineCount,
  createUploadUrl,
  detectDataType,
  getOwnedUpload,
  getUploadedFile,
  hashContent,
  markUploadConsumed,
} from '../services/uploadService';
import { Framework, UserContext } from '../models/Job';
import { ValidationError } from '../errors';
import { handleError } from '../middleware/errorHandler';

/**
 * POST /api/reports/upload-url
 * First step of the upload flow (API_SPEC.md 4.3) — returns a signed Cloud
 * Storage URL the client PUTs the journal file to directly.
 */
export async function getUploadUrl(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId as string;
    const fileName = req.body?.fileName;

    const result = await createUploadUrl(userId, fileName);

    res.status(200).json(result);
  } catch (error) {
    handleError(error as Error, res);
  }
}

const VALID_FRAMEWORKS: Framework[] = ['mbti', 'enneagram', 'values'];

interface CreateReportRequestBody {
  dataType: string;
  uploadId: string;
  focusQuestions: string[];
  frameworks: string[];
  userContext?: UserContext;
  userMbtiType?: string;
  userEnneagramType?: string;
}

function validateRequestBody(body: Partial<CreateReportRequestBody>): CreateReportRequestBody {
  if (!Array.isArray(body.focusQuestions) || body.focusQuestions.length !== 2) {
    throw new ValidationError('focusQuestions must contain exactly 2 items', {
      field: 'focusQuestions',
    });
  }
  if (body.focusQuestions.some((q) => typeof q !== 'string' || q.trim().length === 0)) {
    throw new ValidationError('focusQuestions must be non-empty strings', {
      field: 'focusQuestions',
    });
  }

  const frameworks = body.frameworks ?? [];
  if (!Array.isArray(frameworks) || frameworks.length > 2) {
    throw new ValidationError('frameworks must be an array of 0-2 items', { field: 'frameworks' });
  }
  if (frameworks.some((f) => !VALID_FRAMEWORKS.includes(f as Framework))) {
    throw new ValidationError('frameworks must only contain: mbti, enneagram, values', {
      field: 'frameworks',
    });
  }

  if (typeof body.uploadId !== 'string' || body.uploadId.length === 0) {
    throw new ValidationError('uploadId is required', { field: 'uploadId' });
  }

  return {
    dataType: body.dataType ?? '',
    uploadId: body.uploadId,
    focusQuestions: body.focusQuestions,
    frameworks,
    userContext: body.userContext,
    userMbtiType: body.userMbtiType,
    userEnneagramType: body.userEnneagramType,
  };
}

/**
 * POST /api/reports/create
 * Implements PHASE_SPECS.md 1.1 end to end: validation -> resolve the
 * already-completed direct upload -> rate limit -> payment gate (Lemon
 * Squeezy, async via webhook — see API_SPEC.md 4.5) -> job creation ->
 * enqueue. The journal file itself was already uploaded straight to Cloud
 * Storage via POST /api/reports/upload-url — it never passes through this
 * request (Cloud Functions gen2's 32MB request-body cap can't fit it).
 */
export async function createReport(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId as string;
    const body = validateRequestBody(req.body ?? {});
    const dataType = detectDataType(body.dataType);

    const upload = await getOwnedUpload(userId, body.uploadId);

    const user = await getUser(userId);
    const tier = user?.subscriptionTier ?? 'free';

    await checkRateLimit(userId);

    let checkoutId: string | null = null;
    let chargeAmount = 0;

    if (checkPaymentRequired(tier)) {
      const paidCheckout = await findPaidCheckout(userId);

      if (!paidCheckout) {
        const checkout = await createLemonSqueezyCheckout(userId, dataType);
        res.status(402).json({
          error: 'payment_required',
          message: 'Payment needed before this report can run. Complete checkout and try again.',
          checkoutUrl: checkout.checkoutUrl,
        });
        return;
      }

      checkoutId = paidCheckout.checkoutId;
      chargeAmount = paidCheckout.amount;
    }

    const buffer = await getUploadedFile(upload.storagePath);
    hashContent(buffer); // computed for future dedup/caching use (Phase 1.2); not yet persisted

    const job = await createJob({
      userId,
      dataType,
      journalCount: calculateLineCount(buffer),
      journalStoragePath: upload.storagePath,
      focusQuestions: [body.focusQuestions[0], body.focusQuestions[1]],
      frameworks: body.frameworks as Framework[],
      userContext: body.userContext ?? {},
      userMbtiType: body.userMbtiType ?? null,
      userEnneagramType: body.userEnneagramType ?? null,
      chargeAmount,
      checkoutId,
    });

    await markUploadConsumed(upload.uploadId, job.jobId);

    if (checkoutId) {
      await consumeCheckout(checkoutId, job.jobId);
    }

    await enqueueJob(job.jobId);

    res.status(202).json({
      jobId: job.jobId,
      reportId: job.reportId,
      status: job.status,
      estimatedCompletionSeconds: job.estimatedRemainingSeconds,
      userCanWait: true,
      statusCheckUrl: `/api/reports/${job.jobId}/status`,
      message: `Your report job has been queued. Estimated completion: ${Math.round(
        (job.estimatedRemainingSeconds ?? 0) / 60
      )} minutes.`,
    });
  } catch (error) {
    handleError(error as Error, res);
  }
}

/**
 * GET /api/reports/:jobId/status
 * Matches API_SPEC.md 4.3's three response shapes (in-progress / complete /
 * failed). Admin SDK bypasses Firestore security rules, so ownership is
 * enforced here, not just in firestore.rules.
 */
export async function getJobStatus(req: Request, res: Response): Promise<void> {
  try {
    const job = await getJob(req.params.jobId);

    if (!job || job.userId !== req.userId) {
      res.status(404).json({ error: 'not_found', message: 'Job not found' });
      return;
    }

    if (job.status === 'failed') {
      res.status(200).json({
        jobId: job.jobId,
        status: job.status,
        error: {
          phase: job.errorPhase,
          message: job.errorMessage,
          recoverable: job.errorRecoverable,
        },
      });
      return;
    }

    if (job.status === 'complete') {
      const processingTimeSeconds =
        job.startedAt && job.completedAt
          ? job.completedAt.seconds - job.startedAt.seconds
          : null;

      res.status(200).json({
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        reportId: job.reportId,
        processingTimeSeconds,
        completedAt: job.completedAt?.toDate().toISOString() ?? null,
      });
      return;
    }

    res.status(200).json({
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      currentPhase: job.currentPhase,
      estimatedRemainingSeconds: job.estimatedRemainingSeconds,
      startedAt: job.startedAt?.toDate().toISOString() ?? null,
      reportId: job.reportId,
    });
  } catch (error) {
    handleError(error as Error, res);
  }
}
