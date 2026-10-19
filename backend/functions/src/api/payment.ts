import { Request, Response } from 'express';
import { db } from '../firebaseAdmin';
import {
  createLemonSqueezyCheckout,
  handleLemonSqueezyWebhook,
  verifyWebhookSignature,
} from '../services/paymentService';
import { detectDataType } from '../services/uploadService';
import { ValidationError } from '../errors';
import { handleError } from '../middleware/errorHandler';
import { Checkout } from '../models/Checkout';

/** POST /api/payment/create-checkout (API_SPEC.md 4.5). */
export async function createCheckout(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId as string;
    const dataType = detectDataType(req.body?.dataType ?? '');

    const checkout = await createLemonSqueezyCheckout(userId, dataType);

    res.status(200).json({
      checkoutId: checkout.checkoutId,
      checkoutUrl: checkout.checkoutUrl,
      variantId: checkout.variantId,
      amount: checkout.amount,
      currency: checkout.currency,
      status: checkout.status,
    });
  } catch (error) {
    handleError(error as Error, res);
  }
}

/** GET /api/payment/checkout/:checkoutId/status (API_SPEC.md 4.5). */
export async function getCheckoutStatus(req: Request, res: Response): Promise<void> {
  try {
    const doc = await db.collection('checkouts').doc(req.params.checkoutId).get();

    if (!doc.exists) {
      res.status(404).json({ error: 'not_found', message: 'Checkout not found' });
      return;
    }

    const checkout = doc.data() as Checkout;
    if (checkout.userId !== req.userId) {
      res.status(404).json({ error: 'not_found', message: 'Checkout not found' });
      return;
    }

    res.status(200).json({
      checkoutId: checkout.checkoutId,
      status: checkout.status,
      lemonSqueezyOrderId: checkout.lemonSqueezyOrderId,
      paidAt: checkout.status === 'paid' ? checkout.updatedAt.toDate().toISOString() : null,
    });
  } catch (error) {
    handleError(error as Error, res);
  }
}

/**
 * POST /api/webhooks/lemonsqueezy (API_SPEC.md 4.5). Server-to-server, not
 * authenticated with a Firebase ID token — verified via X-Signature instead.
 * Requires the raw request body (see app.ts's route-specific express.raw()
 * registered *before* the global express.json()), since signature
 * verification needs the exact bytes Lemon Squeezy signed.
 */
export async function lemonSqueezyWebhook(req: Request, res: Response): Promise<void> {
  try {
    const rawBody = req.body as Buffer;
    const signature = req.header('X-Signature');

    if (!verifyWebhookSignature(rawBody, signature)) {
      res.status(401).json({
        error: 'authentication_error',
        message: 'Invalid webhook signature',
      });
      return;
    }

    await handleLemonSqueezyWebhook(rawBody);
    res.status(200).json({ received: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: 'validation_error', message: error.message });
      return;
    }
    handleError(error as Error, res);
  }
}
