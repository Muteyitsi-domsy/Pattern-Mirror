import { Request, Response } from 'express';
import { getJob } from '../services/jobService';
import { handleError } from '../middleware/errorHandler';

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
