import { expect, it } from 'vitest';
import { readPublicConfig } from '../src/config';

it('requires explicit public API configuration', () => {
  expect(() => readPublicConfig({})).toThrow('VITE_API_BASE_URL');
  expect(() => readPublicConfig({ VITE_API_BASE_URL: '*' })).toThrow();
});
it('requires HTTPS for deployed production API origins', () => {
  expect(() =>
    readPublicConfig({
      PROD: true,
      VITE_API_BASE_URL: 'http://api.example.com',
    }),
  ).toThrow('HTTPS');
  expect(
    readPublicConfig({
      PROD: true,
      VITE_API_BASE_URL: 'https://api.example.com',
    }).apiBaseUrl,
  ).toBe('https://api.example.com');
});
it('allows local production-build testing without TLS', () => {
  expect(
    readPublicConfig({ PROD: true, VITE_API_BASE_URL: 'http://localhost:3000' })
      .apiBaseUrl,
  ).toBe('http://localhost:3000');
});
