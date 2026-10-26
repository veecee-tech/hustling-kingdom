import { expect, it } from 'vitest';
import { parseHttpOrigin } from '../src/index.js';

it('accepts an explicit origin', () => {
  expect(parseHttpOrigin('https://example.com/')).toBe('https://example.com');
});
it.each([
  '*',
  'https://*.example.com',
  'https://user:password@example.com',
  'https://example.com/path',
  'file:///tmp',
  'https://example.com?q=1',
])('rejects unsafe origin %s', (value) => {
  expect(() => parseHttpOrigin(value)).toThrow();
});
