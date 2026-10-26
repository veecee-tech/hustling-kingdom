import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { defineComponent } from 'vue';
import { api } from '../src/api';
import { ApiError, createApiClient } from '../src/api/client';
import { useAuthStore } from '../src/features/auth/store';
import { installAuthGuard } from '../src/features/auth/route-guard';
import type { AuthSessionResponse } from '@hk/shared';

const session: AuthSessionResponse = {
  user: {
    id: 'fixture-user',
    username: 'fixture',
    email: 'fixture@example.test',
    role: 'PLAYER',
  },
  accessToken: 'memory-only-fixture',
  expiresIn: 600,
};
beforeEach(() => {
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('account session state', () => {
  it('refreshes before logout-all so an expired access token cannot skip server revocation', async () => {
    const request = vi
      .spyOn(api, 'request')
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({ user: session.user, character: null })
      .mockResolvedValueOnce({ ...session, accessToken: 'renewed-fixture' })
      .mockResolvedValueOnce(undefined);
    const auth = useAuthStore();
    await auth.signIn('login', {
      emailOrUsername: 'fixture',
      password: 'fixture passphrase',
    });
    await auth.logout(true);
    expect(request.mock.calls.map((call) => call[0])).toEqual([
      '/api/v1/auth/login',
      '/api/v1/me',
      '/api/v1/auth/refresh',
      '/api/v1/auth/logout-all',
    ]);
    expect(request.mock.calls[3]?.[1]?.authorization).toBe(
      'Bearer renewed-fixture',
    );
    expect(auth.authenticated).toBe(false);
  });
  it('restores through the cookie and loads /me before initialization completes', async () => {
    const request = vi
      .spyOn(api, 'request')
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({ user: session.user, character: null });
    const auth = useAuthStore();
    expect(auth.status).toBe('initializing');
    await auth.initialize();
    expect(auth.authenticated).toBe(true);
    expect(auth.user).toEqual(session.user);
    expect(request.mock.calls.map((call) => call[0])).toEqual([
      '/api/v1/auth/refresh',
      '/api/v1/me',
    ]);
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'include',
      csrf: true,
    });
  });
  it('clears a revoked session and does not loop on refresh failure', async () => {
    const request = vi
      .spyOn(api, 'request')
      .mockRejectedValue(
        new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid session.'),
      );
    const auth = useAuthStore();
    await auth.initialize();
    await auth.initialize();
    expect(auth.status).toBe('unauthenticated');
    expect(auth.accessToken).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('shows safe login failure using the error code', async () => {
    vi.spyOn(api, 'request').mockRejectedValue(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Server wording may change.'),
    );
    const auth = useAuthStore();
    await expect(
      auth.signIn('login', {
        emailOrUsername: 'fixture',
        password: 'not a real password',
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(auth.authenticated).toBe(false);
    expect(auth.error).toBe('Email, username or password is incorrect.');
    expect(auth.accessToken).toBeNull();
  });
  it('shares one refresh among concurrent callers', async () => {
    let resolve!: (value: AuthSessionResponse) => void;
    const request = vi.spyOn(api, 'request').mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const auth = useAuthStore();
    const first = auth.refresh();
    const second = auth.refresh();
    expect(request).toHaveBeenCalledTimes(1);
    resolve(session);
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(auth.authenticated).toBe(true);
  });
  it('logs out through the backend and clears memory without token persistence', async () => {
    const request = vi
      .spyOn(api, 'request')
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({ user: session.user, character: null })
      .mockResolvedValueOnce(undefined);
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const auth = useAuthStore();
    await auth.signIn('login', {
      emailOrUsername: 'fixture',
      password: 'fixture passphrase',
    });
    await auth.logout();
    expect(request.mock.calls[2]?.[0]).toBe('/api/v1/auth/logout');
    expect(auth.user).toBeNull();
    expect(auth.accessToken).toBeNull();
    expect(auth.authenticated).toBe(false);
    expect(storage).not.toHaveBeenCalled();
  });
  it('clears stale local state when logout cannot reach the server and informs the user', async () => {
    vi.spyOn(api, 'request')
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({ user: session.user, character: null })
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Unavailable.'));
    const auth = useAuthStore();
    await auth.signIn('login', {
      emailOrUsername: 'fixture',
      password: 'fixture passphrase',
    });
    await auth.logout();
    expect(auth.authenticated).toBe(false);
    expect(auth.error).toContain('could not be confirmed');
  });
});

describe('protected navigation', () => {
  function router() {
    const Page = defineComponent({ template: '<p>Route</p>' });
    return createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: Page },
        {
          path: '/create-character',
          name: 'create-character',
          component: Page,
          meta: { requiresAuth: true },
        },
        {
          path: '/login',
          name: 'login',
          component: Page,
          meta: { guestOnly: true },
        },
        {
          path: '/register',
          name: 'register',
          component: Page,
          meta: { guestOnly: true },
        },
        {
          path: '/account',
          name: 'account',
          component: Page,
          meta: { requiresAuth: true, requiresCharacter: true },
        },
      ],
    });
  }
  it('redirects unauthenticated users before protected content is reached', async () => {
    vi.spyOn(api, 'request').mockRejectedValue(
      new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid.'),
    );
    const auth = useAuthStore();
    const navigation = router();
    installAuthGuard(navigation, auth);
    await navigation.push('/account');
    expect(navigation.currentRoute.value.name).toBe('login');
  });
  it('waits for restoration and sends authenticated guests to their account', async () => {
    vi.spyOn(api, 'request')
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({ user: session.user, character: null });
    const auth = useAuthStore();
    const navigation = router();
    installAuthGuard(navigation, auth);
    await navigation.push('/login');
    expect(navigation.currentRoute.value.name).toBe('create-character');
  });
});

describe('authenticated API requests', () => {
  it('retries once after refresh, attaches credentials intentionally and avoids refresh loops', async () => {
    let token = 'old';
    const refresh = vi.fn(async () => {
      token = 'new';
      return true;
    });
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"ok":true}'));
    const client = createApiClient('http://localhost', transport);
    client.configureAuthentication({ accessToken: () => token, refresh });
    expect(await client.request('/api/v1/me', { authenticated: true })).toEqual(
      { ok: true },
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(
      new Headers(transport.mock.calls[1]?.[1]?.headers).get('Authorization'),
    ).toBe('Bearer new');
    transport.mockResolvedValue(new Response('{}', { status: 401 }));
    await expect(
      client.request('/api/v1/me', { authenticated: true }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(refresh).toHaveBeenCalledTimes(2); // one refresh for each original request, never recursive
  });
  it('sends the browser refresh cookie and CSRF header only when requested', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}'));
    const client = createApiClient('http://localhost', transport);
    await client.request('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      csrf: true,
      body: {},
    });
    expect(transport.mock.calls[0]?.[1]?.credentials).toBe('include');
    expect(
      new Headers(transport.mock.calls[0]?.[1]?.headers).get('X-HK-Client'),
    ).toBe('web');
  });
});
