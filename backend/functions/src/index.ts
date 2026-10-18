import { onRequest } from 'firebase-functions/v2/https';
import { createApp } from './app';

/** Single Cloud Function serving the whole Express API. */
export const api = onRequest(createApp());

export { processReportJob } from './triggers/onJobQueued';
