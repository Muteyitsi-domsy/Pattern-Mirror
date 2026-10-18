import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { processJob } from '../services/jobService';

/**
 * Cloud Tasks worker. firebase-functions v2 provisions this function's
 * backing Cloud Tasks queue automatically on `firebase deploy --only
 * functions` — there's no separately-created queue to manage.
 */
export const processReportJob = onTaskDispatched<{ jobId: string }>(async (request) => {
  const { jobId } = request.data;
  await processJob(jobId);
});
