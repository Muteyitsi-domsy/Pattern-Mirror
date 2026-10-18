export class ValidationError extends Error {
  constructor(
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends Error {
  constructor(public resetTime: Date) {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
  }
}

export class PaymentError extends Error {
  constructor(
    message: string,
    public checkoutUrl?: string
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class AnalysisError extends Error {
  constructor(
    message: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}
