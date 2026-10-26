import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorEnvelope } from '@hk/shared';
import { requestContext, StructuredLogger } from './logging.js';

export class PublicHttpError extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
  ) {
    super(message, status);
  }
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new StructuredLogger();
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const defaults: Record<number, [string, string]> = {
      400: ['VALIDATION_ERROR', 'Request validation failed.'],
      401: ['UNAUTHORIZED', 'Authentication required.'],
      403: ['FORBIDDEN', 'Request forbidden.'],
      404: ['NOT_FOUND', 'Resource not found.'],
      405: ['METHOD_NOT_ALLOWED', 'Method not allowed.'],
      413: ['PAYLOAD_TOO_LARGE', 'Request payload is too large.'],
      429: ['RATE_LIMITED', 'Too many requests.'],
      503: ['SERVICE_UNAVAILABLE', 'Service unavailable.'],
    };
    const [code, message] =
      error instanceof PublicHttpError
        ? [error.code, error.message]
        : (defaults[status] ?? [
            'INTERNAL_ERROR',
            'An unexpected error occurred.',
          ]);
    if (status >= 500) this.logger.error(error, undefined, 'Http');
    const body: ApiErrorEnvelope = {
      error: {
        code,
        message,
        details: {},
        requestId:
          requestContext.getStore()?.requestId ??
          String(response.getHeader('x-request-id')),
      },
    };
    response.status(status).json(body);
  }
}
