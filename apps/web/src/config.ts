import { parseHttpOrigin } from '@hk/validation';

export function readPublicConfig(source: Record<string, unknown>) {
  const value = source.VITE_API_BASE_URL;
  if (typeof value !== 'string')
    throw new Error('VITE_API_BASE_URL is required.');
  const apiBaseUrl = parseHttpOrigin(value);
  const url = new URL(apiBaseUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (source.PROD && !local && url.protocol !== 'https:')
    throw new Error('Production API URL must use HTTPS.');
  return { apiBaseUrl };
}
