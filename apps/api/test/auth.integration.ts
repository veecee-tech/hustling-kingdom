import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { SignJWT, decodeJwt } from 'jose';
import request from 'supertest';
import type { Response as TestResponse } from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AppConfig } from '../src/config/config.module.js';
import { DatabaseService } from '../src/database/database.module.js';
import { RedisService } from '../src/redis/redis.module.js';
import { setupApplication } from '../src/setup.js';
import { digestRefresh } from '../src/auth/auth.service.js';
import { TokenService } from '../src/auth/token.service.js';

let app: INestApplication;
let db: DatabaseService;
let redis: RedisService;
let configuration: AppConfig;
const prefix = `ph1_${randomUUID().slice(0, 8)}_`;
const password = `fixture passphrase ${randomUUID()}`;
let sequence = 0;
function identity() {
  const name = `${prefix}${sequence++}`;
  return { email: `${name}@example.test`, username: name, password };
}
function post(path: string) {
  return request(app.getHttpServer())
    .post(`/api/v1/auth/${path}`)
    .set('Origin', configuration.values.webOrigin)
    .set('X-HK-Client', 'web');
}
function cookie(response: TestResponse): string {
  const value = response.headers['set-cookie'];
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) throw new Error('Missing refresh cookie.');
  return first.split(';')[0] ?? '';
}
function rawCookie(value: string): string {
  return value.slice(value.indexOf('=') + 1);
}
async function registered() {
  const input = identity();
  const result = await post('register').send(input);
  expect(result.status).toBe(201);
  return {
    input,
    result,
    cookie: cookie(result),
    token: String(result.body.accessToken),
    id: String(result.body.user.id),
  };
}
function me(token?: string) {
  const req = request(app.getHttpServer()).get('/api/v1/me');
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
}

beforeAll(async () => {
  const values = { ...new AppConfig().values, authRateLimit: 1000 };
  const redisUrl = new URL(values.redisUrl);
  redisUrl.pathname = '/1';
  values.redisUrl = redisUrl.toString();
  configuration = { values };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppConfig)
    .useValue(configuration)
    .compile();
  app = module.createNestApplication({ logger: false });
  setupApplication(app);
  await app.init();
  db = app.get(DatabaseService);
  redis = app.get(RedisService);
});
afterAll(async () => {
  if (db)
    await db.client.user.deleteMany({
      where: { email: { startsWith: prefix } },
    });
  if (redis) {
    const keys = await redis.client.keys('auth:rate:*');
    if (keys.length) await redis.client.del(...keys);
  }
  await app?.close();
});

describe('registration integrity', () => {
  it('rolls registration back if session issuance fails and sanitizes the error', async () => {
    const input = identity();
    const spy = vi
      .spyOn(app.get(TokenService), 'issue')
      .mockRejectedValueOnce(new Error('private signing details'));
    try {
      const result = await post('register').send(input);
      expect(result.status).toBe(500);
      expect(result.body.error.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(result.body).includes('private signing')).toBe(
        false,
      );
      expect(
        await db.client.user.count({ where: { email: input.email } }),
      ).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
  it('registers only an account with canonical identities, secure cookie and hashed credentials', async () => {
    const input = identity();
    const result = await post('register').send({
      ...input,
      email: `  ${input.email.toUpperCase()}  `,
      username: input.username.toUpperCase(),
    });
    expect(result.status).toBe(201);
    expect(Object.keys(result.body).sort()).toEqual([
      'accessToken',
      'expiresIn',
      'user',
    ]);
    expect(Object.keys(result.body.user).sort()).toEqual([
      'email',
      'id',
      'role',
      'username',
    ]);
    expect(result.body.user.email).toBe(input.email);
    expect(result.body.user.role).toBe('PLAYER');
    const header = String(result.headers['set-cookie']);
    expect(header.includes('HttpOnly')).toBe(true);
    expect(header.includes('SameSite=Strict')).toBe(true);
    expect(header.includes('Path=/api/v1/auth')).toBe(true);
    expect(result.headers['cache-control']).toBe('no-store');
    const user = await db.client.user.findUniqueOrThrow({
      where: { id: result.body.user.id },
    });
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(user.passwordHash === password).toBe(false);
    const sessions = await db.client.authSession.findMany({
      where: { userId: user.id },
    });
    expect(sessions.length).toBe(1);
    expect(
      sessions[0]?.refreshTokenHash ===
        digestRefresh(rawCookie(cookie(result))),
    ).toBe(true);
    expect(JSON.stringify(sessions).includes(rawCookie(cookie(result)))).toBe(
      false,
    );
    const account = await me(result.body.accessToken);
    expect(account.status).toBe(200);
    expect(account.body.character).toBeNull();
    expect(Object.keys(account.body.user).sort()).toEqual([
      'email',
      'id',
      'role',
      'username',
    ]);
  });
  it('rejects duplicate email and username including case variants', async () => {
    const original = await registered();
    for (const email of [
      original.input.email,
      original.input.email.toUpperCase(),
    ]) {
      const result = await post('register').send({ ...identity(), email });
      expect(result.status).toBe(409);
      expect(result.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    }
    for (const username of [
      original.input.username,
      original.input.username.toUpperCase(),
    ]) {
      const result = await post('register').send({ ...identity(), username });
      expect(result.status).toBe(409);
      expect(result.body.error.code).toBe('USERNAME_ALREADY_EXISTS');
    }
  });
  it.each([
    { email: 'bad' },
    { username: 'bad-name!' },
    { password: 'short' },
    { role: 'ADMIN' },
    { role: 'SUPER_ADMIN' },
    { status: 'ACTIVE' },
    { passwordHash: 'forged' },
    { createdAt: '2020-01-01' },
    { sessions: [] },
  ])('rejects invalid input and mass assignment %#', async (extra) => {
    const result = await post('register').send({ ...identity(), ...extra });
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_ERROR');
    expect(result.body.error.requestId).toBe(result.headers['x-request-id']);
  });
  it.each(['email', 'username'] as const)(
    'enforces concurrent %s uniqueness in PostgreSQL',
    async (key) => {
      const first = identity();
      const second = { ...identity(), [key]: first[key].toUpperCase() };
      const results = await Promise.all([
        post('register').send(first),
        post('register').send(second),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
      expect(await db.client.user.count({ where: { [key]: first[key] } })).toBe(
        1,
      );
    },
  );
});

describe('login and protected access', () => {
  it('logs in with email and username; failures have the same safe error', async () => {
    const user = await registered();
    for (const emailOrUsername of [
      user.input.email.toUpperCase(),
      ` ${user.input.username.toUpperCase()} `,
    ])
      expect(
        (await post('login').send({ emailOrUsername, password })).status,
      ).toBe(200);
    const wrong = await post('login').send({
      emailOrUsername: user.input.email,
      password: 'incorrect passphrase',
    });
    const unknown = await post('login').send({
      emailOrUsername: 'unknown@example.test',
      password,
    });
    for (const result of [wrong, unknown]) {
      expect(result.status).toBe(401);
      expect(result.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(result.body.error.message).toBe('Invalid credentials.');
    }
  });
  it('rejects missing, malformed and expired access tokens', async () => {
    expect((await me()).status).toBe(401);
    expect((await me('invalid')).status).toBe(401);
    const user = await registered();
    const claims = decodeJwt(user.token);
    const expired = await new SignJWT({ sid: claims.sid })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setIssuer('hustling-kingdom')
      .setAudience('hustling-kingdom-api')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(new TextEncoder().encode(configuration.values.accessSecret));
    expect((await me(expired)).status).toBe(401);
  });
  it('denies suspended users on login, refresh and existing access', async () => {
    const user = await registered();
    await db.client.user.update({
      where: { id: user.id },
      data: { status: 'SUSPENDED' },
    });
    expect(
      (
        await post('login').send({
          emailOrUsername: user.input.email,
          password,
        })
      ).status,
    ).toBe(401);
    expect(
      (await post('refresh').set('Cookie', user.cookie).send({})).status,
    ).toBe(401);
    expect((await me(user.token)).status).toBe(401);
  });
});

describe('refresh and revocation', () => {
  it('rotates refresh credentials and revokes the family on reuse', async () => {
    const user = await registered();
    const refreshed = await post('refresh').set('Cookie', user.cookie).send({});
    expect(refreshed.status).toBe(200);
    expect(cookie(refreshed) === user.cookie).toBe(false);
    const rows = await db.client.authSession.findMany({
      where: { userId: user.id },
    });
    expect(rows.length).toBe(2);
    expect(rows.filter((row) => row.revokedAt !== null).length).toBe(1);
    const replay = await post('refresh').set('Cookie', user.cookie).send({});
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    expect(
      (await post('refresh').set('Cookie', cookie(refreshed)).send({})).status,
    ).toBe(401);
    expect((await me(refreshed.body.accessToken)).status).toBe(401);
    expect(
      await db.client.authSession.count({
        where: { userId: user.id, revokedAt: null },
      }),
    ).toBe(0);
  });
  it('rejects missing, invalid, expired and unexpected refresh inputs', async () => {
    expect((await post('refresh').send({})).status).toBe(401);
    expect(
      (await post('refresh').set('Cookie', 'hk_refresh=forged').send({}))
        .status,
    ).toBe(401);
    const user = await registered();
    await db.client.authSession.updateMany({
      where: { userId: user.id },
      data: {
        createdAt: new Date(Date.now() - 10000),
        expiresAt: new Date(Date.now() - 5000),
      },
    });
    expect(
      (await post('refresh').set('Cookie', user.cookie).send({})).status,
    ).toBe(401);
    expect(
      (
        await post('refresh').send({
          refreshToken: 'body credentials prohibited',
        })
      ).status,
    ).toBe(400);
  });
  it('serializes concurrent refresh; losing replay revokes the winner', async () => {
    const user = await registered();
    const results = await Promise.all([
      post('refresh').set('Cookie', user.cookie).send({}),
      post('refresh').set('Cookie', user.cookie).send({}),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 401]);
    expect(
      await db.client.authSession.count({
        where: { userId: user.id, revokedAt: null },
      }),
    ).toBe(0);
  });
  it('logout persists current-session revocation and blocks old access', async () => {
    const user = await registered();
    expect(
      (await post('logout').set('Cookie', user.cookie).send({})).status,
    ).toBe(204);
    expect(
      (await post('logout').set('Cookie', user.cookie).send({})).status,
    ).toBe(204);
    expect(
      (await post('refresh').set('Cookie', user.cookie).send({})).status,
    ).toBe(401);
    expect((await me(user.token)).status).toBe(401);
    expect(
      await db.client.authSession.count({
        where: { userId: user.id, revokedAt: { not: null } },
      }),
    ).toBe(1);
  });
  it('logout-all revokes only the authenticated user, including multiple devices', async () => {
    const user = await registered();
    const other = await registered();
    const second = await post('login').send({
      emailOrUsername: user.input.username,
      password,
    });
    expect(second.status).toBe(200);
    expect(
      (
        await post('logout-all')
          .set('Authorization', `Bearer ${user.token}`)
          .send({})
      ).status,
    ).toBe(204);
    for (const token of [user.token, second.body.accessToken])
      expect((await me(token)).status).toBe(401);
    for (const value of [user.cookie, cookie(second)])
      expect((await post('refresh').set('Cookie', value).send({})).status).toBe(
        401,
      );
    expect(
      (await post('refresh').set('Cookie', other.cookie).send({})).status,
    ).toBe(200);
    expect((await post('logout-all').send({})).status).toBe(401);
  });
});

describe('request defenses', () => {
  it('fails closed on limiter connection loss while liveness stays available', async () => {
    redis.client.disconnect();
    try {
      const result = await post('login').send({
        emailOrUsername: 'unknown@example.test',
        password,
      });
      expect(result.status).toBe(503);
      expect(result.body.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(
        (await request(app.getHttpServer()).get('/health/live')).status,
      ).toBe(200);
      expect(
        (await request(app.getHttpServer()).get('/health/ready')).status,
      ).toBe(503);
    } finally {
      await redis.client.connect();
    }
  });
  it('rejects absent or hostile CSRF origins and missing custom header', async () => {
    expect(
      (await request(app.getHttpServer()).post('/api/v1/auth/login').send({}))
        .status,
    ).toBe(403);
    expect(
      (await post('login').set('Origin', 'https://evil.example').send({}))
        .status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .set('Origin', configuration.values.webOrigin)
          .send({})
      ).status,
    ).toBe(403);
  });
  it('limits auth attempts through Redis and returns the standard envelope', async () => {
    const keys = await redis.client.keys('auth:rate:login:*');
    if (keys.length) await redis.client.del(...keys);
    configuration.values.authRateLimit = 2;
    try {
      for (let i = 0; i < 2; i++)
        expect(
          (
            await post('login').send({
              emailOrUsername: 'unknown@example.test',
              password,
            })
          ).status,
        ).toBe(401);
      const result = await post('login').send({
        emailOrUsername: 'unknown@example.test',
        password,
      });
      expect(result.status).toBe(429);
      expect(result.body.error.code).toBe('RATE_LIMITED');
      expect(result.body.error.requestId).toBe(result.headers['x-request-id']);
    } finally {
      configuration.values.authRateLimit = 1000;
    }
  });
  it('keeps the database scoped to implemented account, character, economy, job and skill domains', async () => {
    const rows = await db.client.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
    expect(rows.map((row) => row.tablename)).toEqual([
      '_prisma_migrations',
      'auth_sessions',
      'character_skills',
      'character_stats',
      'characters',
      'hustle_attempts',
      'hustles',
      'idempotency_records',
      'job_assignments',
      'jobs',
      'skills',
      'users',
      'wallet_transactions',
      'wallets',
    ]);
  });
});
