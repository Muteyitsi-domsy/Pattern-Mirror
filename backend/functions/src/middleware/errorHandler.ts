import { Response } from 'express';
import {
  ValidationError,
  AuthenticationError,
  RateLimitError,
  PaymentError,
} from '../errors';

/** Maps a thrown error to the API's standard error response shape. */
export function handleError(error: Error, res: Response): Response {
  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: 'validation_error',
      message: error.message,
      details: error.context,
    });
  }

  if (error instanceof AuthenticationError) {
    return res.status(401).json({
      error: 'authentication_error',
      message: error.message,
    });
  }

  if (error instanceof RateLimitError) {
    return res.status(429).json({
      error: 'rate_limit_exceeded',
      message: error.message,
      resetTime: error.resetTime,
    });
  }

  if (error instanceof PaymentError) {
    return res.status(402).json({
      error: 'payment_required',
      message: error.message,
      checkoutUrl: error.checkoutUrl,
    });
  }

  // Unrecognized error types are real bugs or infra failures — the client
  // only sees a generic message, so this is the only record of what broke.
  console.error('Unhandled error:', error);

  return res.status(500).json({
    error: 'server_error',
    message: 'An unexpected error occurred',
  });
}
