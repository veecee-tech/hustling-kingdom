import type { ApiErrorEnvelope, HealthStatus } from '@hk/shared';
import { REQUEST_ID_HEADER } from '@hk/config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  authorization?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
  csrf?: boolean;
  authenticated?: boolean;
  retryAuthentication?: boolean;
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (!value || typeof value !== 'object' || !('error' in value)) return false;
  const error = value.error;
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string' &&
    'requestId' in error &&
    typeof error.requestId === 'string'
  );
}

export function createApiClient(
  baseUrl: string,
  transport: typeof fetch = fetch,
) {
  let authentication:
    | {
        accessToken: () => string | null;
        refresh: () => Promise<boolean>;
        onUnauthorized?: () => void;
      }
    | undefined;
  function configureAuthentication(
    hooks: NonNullable<typeof authentication>,
  ): void {
    authentication = hooks;
  }
  async function request<T>(
    path: string,
    options: RequestOptions = {},
    retried = false,
  ): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//'))
      throw new Error('API paths must be relative to the configured origin.');
    const headers = new Headers({ Accept: 'application/json' });
    if (options.body !== undefined)
      headers.set('Content-Type', 'application/json');
    if (options.authorization)
      headers.set('Authorization', options.authorization);
    const accessToken = options.authenticated
      ? authentication?.accessToken()
      : undefined;
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    if (options.csrf) headers.set('X-HK-Client', 'web');
    if (options.idempotencyKey)
      headers.set('Idempotency-Key', options.idempotencyKey);
    let response: Response;
    try {
      response = await transport(`${baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal ?? AbortSignal.timeout(5000),
        credentials: options.credentials ?? 'omit',
      });
    } catch {
      throw new ApiError(
        0,
        'NETWORK_ERROR',
        'The API could not be reached. Please try again.',
      );
    }
    const requestId = response.headers.get(REQUEST_ID_HEADER) ?? undefined;
    const payload: unknown =
      response.status === 204
        ? undefined
        : await response.json().catch(() => undefined);
    if (!response.ok) {
      if (
        response.status === 401 &&
        options.authenticated &&
        options.retryAuthentication !== false &&
        !retried &&
        authentication
      ) {
        const alreadyRefreshed =
          authentication.accessToken() &&
          authentication.accessToken() !== accessToken;
        if (alreadyRefreshed || (await authentication.refresh()))
          return request<T>(path, options, true);
      }
      if (response.status === 401 && options.authenticated)
        authentication?.onUnauthorized?.();
      if (isErrorEnvelope(payload))
        throw new ApiError(
          response.status,
          payload.error.code,
          payload.error.message,
          requestId ?? payload.error.requestId,
        );
      throw new ApiError(
        response.status,
        'HTTP_ERROR',
        'The request could not be completed.',
        requestId,
      );
    }
    if (response.status !== 204 && payload === undefined)
      throw new ApiError(
        response.status,
        'INVALID_RESPONSE',
        'The API returned an invalid response.',
        requestId,
      );
    return payload as T;
  }
  return {
    configureAuthentication,
    request,
    live: () => request<HealthStatus>('/health/live'),
    ready: () => request<HealthStatus>('/health/ready'),
  };
}
