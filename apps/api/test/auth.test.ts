import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { normalizeIdentity } from '../src/auth/auth.dto.js';
import { PasswordService } from '../src/auth/password.service.js';
import { TokenService } from '../src/auth/token.service.js';
import {
  ConfigurationError,
  type AppConfig,
} from '../src/config/config.module.js';
import { StructuredLogger, requestContext } from '../src/common/logging.js';
import { decodeJwt } from 'jose';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from '../src/auth/auth.guards.js';

describe('authentication primitives', () => {
  it('enforces explicit role authorization and denies absent policy by default', () => {
    const handler = () => {};
    const req = { principal: { user: { role: 'PLAYER' } } };
    const context = {
      getHandler: () => handler,
      getClass: () => Object,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    const guard = new RolesGuard(new Reflector());
    Reflect.defineMetadata('auth:roles', ['ADMIN'], handler);
    expect(() => guard.canActivate(context)).toThrow('Request forbidden.');
    req.principal.user.role = 'ADMIN';
    expect(guard.canActivate(context)).toBe(true);
    Reflect.deleteMetadata('auth:roles', handler);
    expect(() => guard.canActivate(context)).toThrow('Request forbidden.');
  });
  it('normalizes identities without rewriting aliases', () => {
    expect(normalizeIdentity('  A.Name+tag@Example.com  ')).toBe(
      'a.name+tag@example.com',
    );
  });
  it('preserves passphrase spaces and verifies passwords through Argon2id', async () => {
    const service = new PasswordService();
    const password = '  an untrimmed passphrase  ';
    const stored = await service.hash(password);
    expect(await service.matches(password, stored)).toBe(true);
    expect(await service.matches(password.trim(), stored)).toBe(false);
    expect(await service.matches(password)).toBe(false);
  });
  it('issues minimal JWT claims and rejects tampering', async () => {
    const config = {
      values: {
        accessSecret: 'test-fixture-private-key-for-unit-tests-only',
        accessTtlSeconds: 600,
      },
    } as AppConfig;
    const service = new TokenService(config);
    const userId = randomUUID();
    const familyId = randomUUID();
    const token = await service.issue(userId, familyId);
    expect(await service.verify(token)).toEqual({ userId, familyId });
    expect(Object.keys(decodeJwt(token)).sort()).toEqual([
      'aud',
      'exp',
      'iat',
      'iss',
      'sid',
      'sub',
    ]);
    await expect(service.verify(`${token}tampered`)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
  it('logs correlation fields while suppressing credential-bearing exceptions', () => {
    const output: string[] = [];
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk) => {
        output.push(String(chunk));
        return true;
      });
    try {
      requestContext.run({ requestId: 'req_test' }, () =>
        new StructuredLogger().error(
          new Error('password-token-secret'),
          'private stack',
          'Auth',
        ),
      );
      new StructuredLogger().error(
        new ConfigurationError('Invalid JWT_ACCESS_SECRET.'),
        undefined,
        'Config',
      );
      const line = JSON.parse(output[0] ?? '{}');
      expect(line.requestId).toBe('req_test');
      expect(line.level).toBe('error');
      expect(line.context).toBe('Auth');
      expect(typeof line.timestamp).toBe('string');
      expect(output.join('').includes('password-token-secret')).toBe(false);
      expect(output.join('').includes('private stack')).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});
