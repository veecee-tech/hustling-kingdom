import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { AccountUser, AuthSessionResponse, MeResponse } from '@hk/shared';
import { api } from '../../api';
import { ApiError } from '../../api/client';

const cookieRequest = {
  method: 'POST' as const,
  csrf: true,
  credentials: 'include' as const,
};
export const useAuthStore = defineStore('auth', () => {
  const status = ref<'initializing' | 'authenticated' | 'unauthenticated'>(
    'initializing',
  );
  const user = ref<AccountUser | null>(null);
  const accessToken = ref<string | null>(null);
  const error = ref('');
  const busy = ref(false);
  let refreshing: Promise<boolean> | undefined;
  let initializing: Promise<void> | undefined;
  let initialized = false;
  let epoch = 0;
  let signingOut = false;
  const authenticated = computed(() => status.value === 'authenticated');
  function clear(): void {
    accessToken.value = null;
    user.value = null;
    status.value = 'unauthenticated';
  }
  function accept(session: AuthSessionResponse): void {
    accessToken.value = session.accessToken;
    user.value = session.user;
    status.value = 'authenticated';
  }

  function refresh(): Promise<boolean> {
    if (signingOut) return Promise.resolve(false);
    if (refreshing) return refreshing;
    const version = epoch;
    refreshing = (async () => {
      try {
        const session = await api.request<AuthSessionResponse>(
          '/api/v1/auth/refresh',
          { ...cookieRequest, body: {} },
        );
        if (version !== epoch) return false;
        accept(session);
        return true;
      } catch (cause) {
        if (version === epoch) {
          clear();
          if (!(cause instanceof ApiError && cause.status === 401))
            error.value = 'Session could not be restored. Please try again.';
        }
        return false;
      } finally {
        refreshing = undefined;
      }
    })();
    return refreshing;
  }
  function initialize(): Promise<void> {
    if (initialized) return Promise.resolve();
    if (initializing) return initializing;
    initializing = (async () => {
      try {
        if (await refresh()) {
          const account = await api.request<MeResponse>('/api/v1/me', {
            authenticated: true,
            retryAuthentication: false,
          });
          user.value = account.user;
        }
      } catch {
        clear();
        error.value = 'Session could not be restored. Please sign in again.';
      } finally {
        initialized = true;
        initializing = undefined;
      }
    })();
    return initializing;
  }
  async function signIn(
    mode: 'login' | 'register',
    input: {
      password: string;
      email?: string;
      username?: string;
      emailOrUsername?: string;
    },
  ): Promise<void> {
    busy.value = true;
    error.value = '';
    epoch++;
    try {
      const session = await api.request<AuthSessionResponse>(
        `/api/v1/auth/${mode}`,
        { ...cookieRequest, body: input },
      );
      accept(session);
      initialized = true;
    } catch (cause) {
      clear();
      const messages: Record<string, string> = {
        INVALID_CREDENTIALS: 'Email, username or password is incorrect.',
        EMAIL_ALREADY_EXISTS: 'This email is already registered.',
        USERNAME_ALREADY_EXISTS: 'This username is already registered.',
        RATE_LIMITED: 'Too many attempts. Please wait before trying again.',
        VALIDATION_ERROR: 'Please check the details you entered.',
        NETWORK_ERROR:
          'Unable to connect. Check your connection and try again.',
      };
      error.value =
        cause instanceof ApiError
          ? (messages[cause.code] ??
            'Sign-in could not be completed. Please try again.')
          : 'Sign-in could not be completed. Please try again.';
      throw cause;
    } finally {
      busy.value = false;
    }
  }
  async function logout(all = false): Promise<void> {
    busy.value = true;
    error.value = '';
    await refreshing;
    try {
      // Logout-all needs a current bearer token even after a long idle period.
      if (all && !(await refresh())) throw new Error('Session unavailable.');
      signingOut = true;
      epoch++;
      await api.request<void>(
        all ? '/api/v1/auth/logout-all' : '/api/v1/auth/logout',
        {
          ...cookieRequest,
          body: {},
          authorization:
            all && accessToken.value
              ? `Bearer ${accessToken.value}`
              : undefined,
        },
      );
    } catch {
      error.value =
        'Sign-out could not be confirmed. Check your connection and try again.';
    } finally {
      epoch++;
      clear();
      signingOut = false;
      busy.value = false;
      initialized = true;
    }
  }
  api.configureAuthentication({
    accessToken: () => accessToken.value,
    refresh,
    onUnauthorized: () => {
      epoch++;
      clear();
    },
  });
  return {
    status,
    user,
    accessToken,
    authenticated,
    error,
    busy,
    initialize,
    refresh,
    signIn,
    logout,
  };
});
