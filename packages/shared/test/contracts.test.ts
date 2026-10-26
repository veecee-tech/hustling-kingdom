import { describe, expect, it } from 'vitest';
import type { ApiErrorEnvelope } from '../src/index.js';
import { API_PREFIX, REQUEST_ID_HEADER } from '../../config/src/index.js';

describe('public protocol contracts', () => {
  it('keeps request correlation in the standard JSON error', () => {
    const error: ApiErrorEnvelope = {
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found.',
        details: {},
        requestId: 'req_test',
      },
    };
    expect(JSON.parse(JSON.stringify(error)).error.requestId).toBe('req_test');
    expect(API_PREFIX).toBe('api/v1');
    expect(REQUEST_ID_HEADER).toBe('x-request-id');
  });
});
