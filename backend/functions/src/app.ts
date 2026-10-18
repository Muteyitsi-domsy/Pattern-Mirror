import express, { Express } from 'express';
import { loginUser, logoutUser } from './api/auth';
import { getJobStatus } from './api/reports';
import { verifyFirebaseToken } from './middleware/auth';

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/auth/login', loginUser);
  app.post('/auth/logout', verifyFirebaseToken, logoutUser);

  app.get('/api/reports/:jobId/status', verifyFirebaseToken, getJobStatus);

  return app;
}
