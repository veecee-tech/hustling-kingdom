import { AsyncLocalStorage } from 'node:async_hooks';
import type { LoggerService } from '@nestjs/common';
import { ConfigurationError } from '../config/config.module.js';

export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

export class StructuredLogger implements LoggerService {
  private write(level: string, message: unknown, context?: string): void {
    // Framework errors may contain secrets/paths. Never serialize arbitrary Error objects.
    const safeMessage =
      message instanceof Error
        ? 'Internal application error.'
        : typeof message === 'string'
          ? message
          : 'Application event.';
    process.stdout.write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        requestId: requestContext.getStore()?.requestId,
        context: context ?? 'Application',
        message: safeMessage,
      }) + '\n',
    );
  }
  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }
  error(message: unknown, _trace?: string, context?: string): void {
    this.write(
      'error',
      message instanceof ConfigurationError
        ? message.message
        : 'Internal application error.',
      context,
    );
  }
  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }
  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }
  verbose(message: unknown, context?: string): void {
    this.write('trace', message, context);
  }
}
