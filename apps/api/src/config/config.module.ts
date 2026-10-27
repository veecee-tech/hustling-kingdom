import { Global, Injectable, Module } from '@nestjs/common';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { parseHttpOrigin } from '@hk/validation';

export interface Environment {
  jobsDevDurationSeconds?: number;
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  webOrigin: string;
  databaseUrl: string;
  redisUrl: string;
  accessSecret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  authRateLimit: number;
  authRateWindowSeconds: number;
}

/** Messages contain configuration key names only, never supplied values. */
export class ConfigurationError extends Error {}

export function validateEnvironment(source: NodeJS.ProcessEnv): Environment {
  const mode = source.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(mode))
    throw new ConfigurationError('Invalid NODE_ENV.');
  const required = (key: string): string => {
    const value = source[key]?.trim();
    if (!value)
      throw new ConfigurationError(`Missing required configuration: ${key}.`);
    return value;
  };
  const port = Number(
    source.API_PORT ?? (mode === 'production' ? required('API_PORT') : 3000),
  );
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new ConfigurationError('Invalid API_PORT.');
  let webOrigin: string;
  try {
    webOrigin = parseHttpOrigin(
      source.WEB_ORIGIN ??
        (mode === 'production'
          ? required('WEB_ORIGIN')
          : 'http://127.0.0.1:5173'),
    );
  } catch {
    throw new ConfigurationError(
      'Invalid WEB_ORIGIN; use one explicit HTTP(S) origin.',
    );
  }
  if (mode === 'production' && !webOrigin.startsWith('https://'))
    throw new ConfigurationError('Production WEB_ORIGIN must use HTTPS.');
  const connection = (key: string, protocols: string[]): string => {
    const value = required(key);
    try {
      const url = new URL(value);
      if (!protocols.includes(url.protocol) || !url.hostname)
        throw new ConfigurationError();
    } catch {
      throw new ConfigurationError(`Invalid ${key}.`);
    }
    return value;
  };
  const integer = (
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number => {
    const value = Number(source[key] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max)
      throw new ConfigurationError(`Invalid ${key}.`);
    return value;
  };
  const accessSecret = required('JWT_ACCESS_SECRET');
  if (
    Buffer.byteLength(accessSecret) < 32 ||
    (mode === 'production' &&
      /development|placeholder|change.?me/i.test(accessSecret))
  ) {
    throw new ConfigurationError(
      'Invalid JWT_ACCESS_SECRET; supply a private random secret of at least 32 bytes.',
    );
  }
  const jobsDevDurationSeconds =
    source.JOBS_DEV_DURATION_SECONDS === undefined
      ? undefined
      : integer('JOBS_DEV_DURATION_SECONDS', 30, 1, 60);
  if (mode === 'production' && jobsDevDurationSeconds !== undefined)
    throw new ConfigurationError(
      'JOBS_DEV_DURATION_SECONDS is unavailable in production.',
    );
  return {
    jobsDevDurationSeconds,
    nodeEnv: mode as Environment['nodeEnv'],
    port,
    webOrigin,
    databaseUrl: connection('DATABASE_URL', ['postgres:', 'postgresql:']),
    redisUrl: connection('REDIS_URL', ['redis:', 'rediss:']),
    accessSecret,
    accessTtlSeconds: integer('JWT_ACCESS_TTL_SECONDS', 600, 30, 900),
    refreshTtlSeconds: integer(
      'REFRESH_TOKEN_TTL_SECONDS',
      604800,
      300,
      2592000,
    ),
    authRateLimit: integer('AUTH_RATE_LIMIT', 30, 1, 10000),
    authRateWindowSeconds: integer('AUTH_RATE_WINDOW_SECONDS', 60, 1, 3600),
  };
}

@Injectable()
export class AppConfig {
  readonly values: Environment;
  constructor() {
    // Source and compiled entry points are both one directory below apps/api.
    config({
      path: fileURLToPath(new URL('../../../../.env', import.meta.url)),
      quiet: true,
    });
    this.values = validateEnvironment(process.env);
  }
}

@Global()
@Module({ providers: [AppConfig], exports: [AppConfig] })
export class ConfigModule {}
