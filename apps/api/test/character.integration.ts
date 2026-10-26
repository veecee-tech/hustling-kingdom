import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { defaultAppearance, type CharacterResponse } from '@hk/shared';
import { AppModule } from '../src/app.module.js';
import { AppConfig } from '../src/config/config.module.js';
import { DatabaseService } from '../src/database/database.module.js';
import { setupApplication } from '../src/setup.js';

let app: INestApplication;
let db: DatabaseService;
let config: AppConfig;
const prefix = `ph2_${randomUUID().slice(0, 8)}_`;
let sequence = 0;
const password = `character fixture ${randomUUID()}`;
const input = {
  name: '  Adé  Ọlá  ',
  gender: 'NON_BINARY',
  appearance: defaultAppearance,
};
async function account() {
  const username = `${prefix}${sequence++}`;
  const result = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .set('Origin', config.values.webOrigin)
    .set('X-HK-Client', 'web')
    .send({ username, email: `${username}@example.test`, password });
  expect(result.status).toBe(201);
  return {
    id: String(result.body.user.id),
    token: String(result.body.accessToken),
    username,
  };
}
function create(
  token: string,
  key: string = randomUUID(),
  body: object = input,
) {
  return request(app.getHttpServer())
    .post('/api/v1/characters')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', key)
    .send(body);
}
function own(token: string, suffix = '') {
  return request(app.getHttpServer())
    .get(`/api/v1/characters/me${suffix}`)
    .set('Authorization', `Bearer ${token}`);
}
function patch(token: string, body: object) {
  return request(app.getHttpServer())
    .patch('/api/v1/characters/me/appearance')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}
function me(token: string) {
  return request(app.getHttpServer())
    .get('/api/v1/me')
    .set('Authorization', `Bearer ${token}`);
}
beforeAll(async () => {
  const values = { ...new AppConfig().values, authRateLimit: 1000 };
  const url = new URL(values.redisUrl);
  url.pathname = '/1';
  values.redisUrl = url.toString();
  config = { values };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppConfig)
    .useValue(config)
    .compile();
  app = module.createNestApplication({ logger: false });
  setupApplication(app);
  await app.init();
  db = app.get(DatabaseService);
});
afterAll(async () => {
  if (db)
    await db.client.user.deleteMany({
      where: { username: { startsWith: prefix } },
    });
  await app?.close();
});

describe('character creation, privacy and persistence', () => {
  it('keeps existing accounts without characters, creates approved stats, restores through login and /me', async () => {
    const user = await account();
    expect((await me(user.token)).body.character).toBeNull();
    expect((await own(user.token)).body.error.code).toBe('CHARACTER_REQUIRED');
    expect((await patch(user.token, { hair: 'afro' })).status).toBe(404);
    const created = await create(user.token);
    expect(created.status).toBe(201);
    const character = created.body as CharacterResponse;
    expect(character.name).toBe('Adé  Ọlá');
    expect(character.stats).toEqual({
      reputation: '0',
      heat: 0,
      health: 100,
      energy: 100,
      stress: 10,
    });
    expect(character.residence).toBe('Family House');
    expect(character.status).toBe('ACTIVE');
    expect((await own(user.token)).body).toEqual(character);
    expect((await me(user.token)).body.character).toEqual(character);
    expect(JSON.stringify(character)).not.toMatch(
      /userId|creationKey|creationHash|creationResponse|highestNetWorth|wallet|balance/,
    );
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', config.values.webOrigin)
      .set('X-HK-Client', 'web')
      .send({ emailOrUsername: user.username, password });
    expect(login.status).toBe(200);
    expect((await me(login.body.accessToken)).body.character.id).toBe(
      character.id,
    );
    const row = await db.client.characterStats.findUniqueOrThrow({
      where: { characterId: character.id },
    });
    expect(row.highestNetWorth).toBe(0n);
    expect(created.headers['cache-control']).toBe('no-store');
  });
  it('rejects unauthenticated endpoints and invalid/missing idempotency keys', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/characters')
          .send(input)
      ).status,
    ).toBe(401);
    expect(
      (await request(app.getHttpServer()).get('/api/v1/characters/me')).status,
    ).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .patch('/api/v1/characters/me/appearance')
          .send({ hair: 'afro' })
      ).status,
    ).toBe(401);
    const user = await account();
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/characters')
          .set('Authorization', `Bearer ${user.token}`)
          .send(input)
      ).status,
    ).toBe(400);
    expect((await create(user.token, 'bad')).status).toBe(400);
  });
  it.each([
    'userId',
    'characterId',
    'reputation',
    'heat',
    'health',
    'energy',
    'stress',
    'stats',
    'status',
    'currentLocationId',
    'createdAt',
    'updatedAt',
    'wallet',
    'balance',
    'cash',
    'bank',
    'role',
  ])('rejects server-owned creation field %s', async (field) => {
    const user = await account();
    const result = await create(user.token, randomUUID(), {
      ...input,
      [field]: 999,
    });
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_ERROR');
    expect(
      await db.client.character.count({ where: { userId: user.id } }),
    ).toBe(0);
  });
  it.each([
    { name: 'a' },
    { name: 'Bad\u0000Name' },
    { name: 'x'.repeat(41) },
    { gender: 'ADMIN' },
    { appearance: { ...defaultAppearance, imageUrl: 'https://evil.test' } },
    { appearance: { ...defaultAppearance, hair: 'unknown' } },
    { appearance: { hair: 'afro' } },
    { appearance: null },
  ])('rejects invalid identity/appearance %#', async (extra) => {
    const user = await account();
    expect(
      (await create(user.token, randomUUID(), { ...input, ...extra })).status,
    ).toBe(400);
  });
  it('replays the original receipt after cosmetic changes and rejects changed intent or a second creation', async () => {
    const user = await account();
    const key = randomUUID();
    const original = await create(user.token, key);
    expect((await patch(user.token, { hair: 'braids' })).status).toBe(200);
    const replay = await create(user.token, key, {
      ...input,
      appearance: Object.fromEntries(
        Object.entries(defaultAppearance).reverse(),
      ),
    });
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(original.body);
    expect((await own(user.token)).body.appearance.hair).toBe('braids');
    const conflict = await create(user.token, key, {
      ...input,
      name: 'Different name',
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    const duplicate = await create(user.token);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CHARACTER_ALREADY_EXISTS');
  });
  it('serializes concurrent new keys and concurrent identical retries in PostgreSQL', async () => {
    const first = await account();
    const results = await Promise.all([
      create(first.token),
      create(first.token),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      await db.client.character.count({ where: { userId: first.id } }),
    ).toBe(1);
    const second = await account();
    const key = randomUUID();
    const retries = await Promise.all([
      create(second.token, key),
      create(second.token, key),
    ]);
    expect(retries.map((r) => r.status)).toEqual([201, 201]);
    expect(retries[0]?.body).toEqual(retries[1]?.body);
    expect(
      await db.client.character.count({ where: { userId: second.id } }),
    ).toBe(1);
  });
  it('enforces unique ownership, stat bounds, required stats and rollback at database level', async () => {
    const user = await account();
    const result = await create(user.token);
    const id = String(result.body.id);
    const data = {
      userId: user.id,
      name: 'Other name',
      gender: 'MALE' as const,
      slug: randomUUID(),
      appearance: defaultAppearance,
      creationKey: randomUUID(),
      creationHash: 'a'.repeat(64),
      stats: { create: {} },
    };
    await expect(db.client.character.create({ data })).rejects.toThrow();
    for (const change of [
      { heat: 101 },
      { health: -1 },
      { energy: 101 },
      { stress: -1 },
      { reputation: -1n },
    ])
      await expect(
        db.client.characterStats.update({
          where: { characterId: id },
          data: change,
        }),
      ).rejects.toThrow();
    await expect(
      db.client.characterStats.delete({ where: { characterId: id } }),
    ).rejects.toThrow();
    const other = await account();
    await expect(
      db.client.$transaction(async (tx) => {
        await tx.character.create({
          data: {
            ...data,
            userId: other.id,
            slug: randomUUID(),
            stats: undefined,
          },
        });
      }),
    ).rejects.toThrow();
    expect(
      await db.client.character.count({ where: { userId: other.id } }),
    ).toBe(0);
    // Force the second operation to fail after the character insert inside a real transaction.
    await expect(
      db.client.$transaction(async (tx) => {
        const row = await tx.character.create({
          data: {
            ...data,
            userId: other.id,
            slug: randomUUID(),
            stats: undefined,
          },
        });
        await tx.characterStats.create({
          data: { characterId: row.id, heat: 101 },
        });
      }),
    ).rejects.toThrow();
    expect(
      await db.client.character.count({ where: { userId: other.id } }),
    ).toBe(0);
    expect(
      await db.client.characterStats.count({ where: { characterId: id } }),
    ).toBe(1);
  });
  it('isolates owners and merges simultaneous partial appearance edits without lost categories', async () => {
    const first = await account();
    const second = await account();
    const a = await create(first.token);
    const b = await create(second.token);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.slug).not.toBe(b.body.slug);
    expect((await own(second.token, `?userId=${first.id}`)).body.id).toBe(
      b.body.id,
    );
    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/characters/${a.body.id}`)
          .set('Authorization', `Bearer ${second.token}`)
      ).status,
    ).toBe(404);
    for (const body of [
      {},
      { hair: null },
      { hair: 'invalid' },
      { userId: first.id, hair: 'afro' },
      { stats: { heat: 0 } },
      { status: 'ACTIVE' },
      { reputation: 10 },
      { heat: 0 },
      { balance: 1000 },
    ])
      expect((await patch(second.token, body)).status).toBe(400);
    const updates = await Promise.all([
      patch(second.token, { hair: 'braids' }),
      patch(second.token, { top: 'kaftan' }),
    ]);
    expect(updates.map((r) => r.status)).toEqual([200, 200]);
    const updated = await own(second.token);
    expect(updated.body.appearance).toEqual({
      ...defaultAppearance,
      hair: 'braids',
      top: 'kaftan',
    });
    expect(updated.body.stats).toEqual(b.body.stats);
    expect((await own(first.token)).body).toEqual(a.body);
  });
  it('describes the actual character routes and nullable /me in OpenAPI', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/docs-json',
    );
    expect(response.status).toBe(200);
    expect(
      response.body.paths['/api/v1/characters'].post.parameters[0].name,
    ).toBe('Idempotency-Key');
    expect(response.body.paths['/api/v1/characters/me'].get.security).toEqual([
      { bearer: [] },
    ]);
    expect(
      response.body.paths['/api/v1/characters/me/appearance'].patch,
    ).toBeDefined();
    expect(
      response.body.components.schemas.MeDto.properties.character.nullable,
    ).toBe(true);
  });
});
