import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../src/config/config.module.js';

const valid = {
  NODE_ENV: 'production',
  API_PORT: '3000',
  WEB_ORIGIN: 'https://web.example.com',
  DATABASE_URL: 'postgresql://localhost/test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-fixture-not-a-real-secret-0123456789',
};
describe('server configuration', () => {
  it('requires a strong supplied secret and bounded lifetimes/rate limits', () => {
    for (const JWT_ACCESS_SECRET of [
      '',
      'short',
      'development-only-public-secret-never-use-in-production',
    ])
      expect(() =>
        validateEnvironment({ ...valid, JWT_ACCESS_SECRET }),
      ).toThrow('JWT_ACCESS_SECRET');
    for (const key of [
      'JWT_ACCESS_TTL_SECONDS',
      'REFRESH_TOKEN_TTL_SECONDS',
      'AUTH_RATE_LIMIT',
      'AUTH_RATE_WINDOW_SECONDS',
    ])
      expect(() => validateEnvironment({ ...valid, [key]: '-1' })).toThrow(key);
  });
  it('gates development work timing outside production', () => {
    expect(() =>
      validateEnvironment({ ...valid, JOBS_DEV_DURATION_SECONDS: '1' }),
    ).toThrow('JOBS_DEV_DURATION_SECONDS');
    expect(
      validateEnvironment({
        ...valid,
        NODE_ENV: 'test',
        JOBS_DEV_DURATION_SECONDS: '1',
      }).jobsDevDurationSeconds,
    ).toBe(1);
    expect(() =>
      validateEnvironment({
        ...valid,
        NODE_ENV: 'test',
        JOBS_DEV_DURATION_SECONDS: '0',
      }),
    ).toThrow('JOBS_DEV_DURATION_SECONDS');
  });
  it('parses valid settings', () => {
    expect(validateEnvironment(valid).port).toBe(3000);
  });
  it.each(['NODE_ENV', 'API_PORT', 'WEB_ORIGIN', 'DATABASE_URL', 'REDIS_URL'])(
    'rejects invalid %s without echoing its value',
    (key) => {
      expect(() =>
        validateEnvironment({ ...valid, [key]: 'secret-invalid-value' }),
      ).toThrow(new RegExp(key));
    },
  );
  it.each(['API_PORT', 'WEB_ORIGIN', 'DATABASE_URL', 'REDIS_URL'])(
    'rejects missing production %s',
    (key) => {
      expect(() => validateEnvironment({ ...valid, [key]: '' })).toThrow();
    },
  );
  it('rejects wildcard CORS and production HTTP', () => {
    for (const WEB_ORIGIN of ['*', 'http://example.com'])
      expect(() => validateEnvironment({ ...valid, WEB_ORIGIN })).toThrow();
  });
});
