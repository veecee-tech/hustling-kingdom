import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../src/config/config.module.js';

const valid = {
  NODE_ENV: 'production',
  API_PORT: '3000',
  WEB_ORIGIN: 'https://web.example.com',
  DATABASE_URL: 'postgresql://localhost/test',
  REDIS_URL: 'redis://localhost:6379',
};
describe('server configuration', () => {
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
