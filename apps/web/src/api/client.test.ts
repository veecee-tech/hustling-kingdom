import { expect, it, vi } from 'vitest';
import { createApiClient } from './client';

it('sends JSON and optional authorization/idempotency through one client', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(
    new Response('{"ok":true}', {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  const client = createApiClient('http://localhost:3000', transport);
  await client.request('/api/v1/example', {
    method: 'POST',
    body: { label: 'test' },
    authorization: 'Bearer test',
    idempotencyKey: 'key',
  });
  const init = transport.mock.calls[0]?.[1];
  expect(init?.body).toBe('{"label":"test"}');
  expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('key');
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test');
});
it('preserves safe API errors and server request IDs', async () => {
  const client = createApiClient(
    'http://localhost',
    vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Service unavailable.',
            details: {},
            requestId: 'req_body',
          },
        }),
        { status: 503, headers: { 'x-request-id': 'req_server' } },
      ),
    ),
  );
  await expect(client.ready()).rejects.toMatchObject({
    code: 'SERVICE_UNAVAILABLE',
    requestId: 'req_server',
    status: 503,
  });
});
it('handles network and non-JSON failures safely', async () => {
  await expect(
    createApiClient(
      'http://localhost',
      vi.fn<typeof fetch>().mockRejectedValue(new Error('secret')),
    ).live(),
  ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  await expect(
    createApiClient(
      'http://localhost',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response('private proxy failure', { status: 502 }),
        ),
    ).live(),
  ).rejects.toMatchObject({ code: 'HTTP_ERROR' });
});
