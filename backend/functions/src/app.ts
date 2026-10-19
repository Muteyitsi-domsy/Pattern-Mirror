import express, { Express } from 'express';
import { loginUser, logoutUser } from './api/auth';
import { createReport, getJobStatus, getUploadUrl } from './api/reports';
import { createCheckout, getCheckoutStatus, lemonSqueezyWebhook } from './api/payment';
import { verifyFirebaseToken } from './middleware/auth';

export function createApp(): Express {
  const app = express();

  // Must be registered before the global express.json() below: the webhook
  // needs the exact raw bytes Lemon Squeezy signed to verify X-Signature.
  // Registration order matters in Express — once this route's handler
  // responds, the later global json() middleware never runs for this path.
  app.post('/api/webhooks/lemonsqueezy', express.raw({ type: '*/*' }), lemonSqueezyWebhook);

  // Journal files no longer pass through this API (they upload directly to
  // Cloud Storage via a signed URL — see POST /api/reports/upload-url and
  // API_SPEC.md 4.3), so request bodies are small JSON only. 1mb is
  // generous headroom for userContext free-text fields.
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/auth/login', loginUser);
  app.post('/auth/logout', verifyFirebaseToken, logoutUser);

  app.post('/api/reports/upload-url', verifyFirebaseToken, getUploadUrl);
  app.post('/api/reports/create', verifyFirebaseToken, createReport);
  app.get('/api/reports/:jobId/status', verifyFirebaseToken, getJobStatus);

  app.post('/api/payment/create-checkout', verifyFirebaseToken, createCheckout);
  app.get('/api/payment/checkout/:checkoutId/status', verifyFirebaseToken, getCheckoutStatus);

  return app;
}
