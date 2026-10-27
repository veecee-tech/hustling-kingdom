import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { defaultAppearance } from '@hk/shared';
import { AppModule } from '../src/app.module.js';
import { AppConfig } from '../src/config/config.module.js';
import { DatabaseService } from '../src/database/database.module.js';
import { EconomyService } from '../src/economy/economy.service.js';
import { SkillsService } from '../src/skills/skills.service.js';
import { setupApplication } from '../src/setup.js';
let app: INestApplication;
let db: DatabaseService;
let economy: EconomyService;
let config: AppConfig;
const prefix = `ph5_${randomUUID().slice(0, 8)}_`;
let sequence = 0;
async function player(withCharacter = true) {
  const username = `${prefix}${sequence++}`;
  const result = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .set('Origin', config.values.webOrigin)
    .set('X-HK-Client', 'web')
    .send({
      username,
      email: `${username}@example.test`,
      password: `fixture ${randomUUID()}`,
    });
  expect(result.status).toBe(201);
  const token = String(result.body.accessToken);
  const userId = String(result.body.user.id);
  let characterId = '';
  if (withCharacter) {
    const c = await request(app.getHttpServer())
      .post('/api/v1/characters')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        name: 'Work fixture',
        gender: 'FEMALE',
        appearance: defaultAppearance,
      });
    expect(c.status).toBe(201);
    characterId = String(c.body.id);
  }
  return { token, userId, characterId };
}
async function job(extra: object = {}) {
  return db.client.job.create({
    data: {
      code: `${prefix}${sequence++}`,
      name: 'Fixture cleaner',
      description: 'Test work',
      locationLabel: 'Test Old Town',
      baseReward: 8000n,
      energyCost: 10,
      cooldownSeconds: 30,
      xpSkillId: '55000000-0000-4000-8000-000000000005',
      xpReward: 15n,
      ...extra,
    },
  });
}
function get(token: string, path: string) {
  return request(app.getHttpServer())
    .get(`/api/v1${path}`)
    .set('Authorization', `Bearer ${token}`);
}
function post(
  token: string,
  path: string,
  key: string = randomUUID(),
  body: unknown = {},
) {
  return request(app.getHttpServer())
    .post(`/api/v1${path}`)
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', key)
    .set('Content-Type', 'application/json')
    .send(JSON.stringify(body));
}
const wait = () => new Promise((resolve) => setTimeout(resolve, 1100));
async function start(token: string, id: string, key: string = randomUUID()) {
  const response = await post(token, `/jobs/${id}/start`, key);
  expect(response.status).toBe(200);
  return response.body as { id: string; completesAt: string };
}
async function snapshot(characterId: string) {
  return {
    stats: await db.client.characterStats.findUniqueOrThrow({
      where: { characterId },
    }),
    wallet: await db.client.wallet.findUniqueOrThrow({
      where: { characterId },
    }),
    entries: await db.client.walletTransaction.count({
      where: { characterId },
    }),
    assignments: await db.client.jobAssignment.findMany({
      where: { characterId },
    }),
    receipts: await db.client.idempotencyRecord.count({
      where: { user: { character: { id: characterId } } },
    }),
    skills: await db.client.characterSkill.findMany({
      where: { characterId },
      orderBy: { skillId: 'asc' },
    }),
  };
}
beforeAll(async () => {
  const values = {
    ...new AppConfig().values,
    nodeEnv: 'test' as const,
    authRateLimit: 1000,
    jobsDevDurationSeconds: 1,
  };
  const redis = new URL(values.redisUrl);
  redis.pathname = '/1';
  values.redisUrl = redis.toString();
  config = { values };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppConfig)
    .useValue(config)
    .compile();
  app = module.createNestApplication({ logger: false });
  setupApplication(app);
  await app.init();
  db = app.get(DatabaseService);
  economy = app.get(EconomyService);
});
afterAll(async () => {
  if (db) {
    await db.client.job.updateMany({
      where: { code: { startsWith: prefix } },
      data: { isActive: false },
    });
    await db.client.user.deleteMany({
      where: { username: { startsWith: prefix }, character: { is: null } },
    });
  }
  await app?.close();
});
describe('durable skill progression', () => {
  it('initializes all six states, safely backfills missing beginners and rejects public setters', async () => {
    expect(
      (await request(app.getHttpServer()).get('/api/v1/skills')).status,
    ).toBe(401);
    const a = await player();
    const first = await get(a.token, '/skills');
    expect(first.status).toBe(200);
    expect(first.body.skills).toHaveLength(6);
    expect(
      first.body.skills.every(
        (s: { level: number; xp: string }) => s.level === 1 && s.xp === '0',
      ),
    ).toBe(true);
    expect((await get(a.token, '/skills?xp=999999')).status).toBe(400);
    expect(
      (await post(a.token, '/skills/xp', randomUUID(), { xp: 999999 })).status,
    ).toBe(404);
    expect((await get(a.token, '/skills/catalog')).body).toEqual(first.body);
    await db.client.characterSkill.deleteMany({
      where: { characterId: a.characterId },
    });
    const service = app.get(SkillsService);
    const fill = await service.backfill(a.characterId);
    expect(fill.created).toBeGreaterThanOrEqual(6);
    expect((await service.backfill(a.characterId)).created).toBe(0);
    await expect(
      db.client.characterSkill.create({
        data: {
          characterId: a.characterId,
          skillId: '55000000-0000-4000-8000-000000000005',
        },
      }),
    ).rejects.toThrow();
    expect((await get(a.token, '/skills')).body).toEqual(first.body);
  });
  it('earns two real shifts, levels up, unlocks and starts higher work inside starting Energy', async () => {
    const a = await player();
    const shop = await db.client.job.findUniqueOrThrow({
      where: { code: 'SHOP_ASSISTANT' },
    });
    const sales = await db.client.job.findUniqueOrThrow({
      where: { code: 'SALES_REP' },
    });
    const catalog = await get(a.token, '/jobs');
    expect(
      catalog.body.items.find((j: { id: string }) => j.id === sales.id),
    ).toMatchObject({
      available: false,
      skillRequirement: { currentLevel: 1, requiredLevel: 2, met: false },
    });
    expect(
      (await post(a.token, `/jobs/${sales.id}/start`)).body.error.code,
    ).toBe('JOB_REQUIREMENTS_NOT_MET');
    for (const body of [
      { xp: 99999 },
      { level: 10 },
      { skillMultiplier: 50 },
      { xpReward: 1350 },
    ])
      expect(
        (await post(a.token, `/jobs/${shop.id}/start`, randomUUID(), body))
          .status,
      ).toBe(400);
    for (let n = 0; n < 2; n++) {
      const shift = await start(a.token, shop.id);
      await wait();
      const key = randomUUID();
      const response = await post(
        a.token,
        `/jobs/assignments/${shift.id}/complete`,
        key,
      );
      expect(response.status).toBe(200);
      expect(response.body.assignment.skillProgress).toMatchObject({
        skill: 'SOCIAL',
        xpAwarded: '15',
        currentLevel: n === 0 ? 1 : 2,
        leveledUp: n === 1,
      });
      if (n === 1)
        expect(response.body.assignment.unlocks).toContainEqual(
          expect.objectContaining({ id: sales.id, name: 'Sales Rep' }),
        );
      const before = await snapshot(a.characterId);
      expect(
        (await post(a.token, `/jobs/assignments/${shift.id}/complete`, key))
          .body,
      ).toEqual(response.body);
      expect(
        (await post(a.token, `/jobs/assignments/${shift.id}/complete`)).body,
      ).toEqual(response.body);
      // A distinct retry receipt is allowed; gameplay state is unchanged.
      const after = await snapshot(a.characterId);
      expect({ ...after, receipts: before.receipts }).toEqual(before);
    }
    const states = (await get(a.token, '/skills')).body.skills;
    expect(
      states.find((s: { code: string }) => s.code === 'SOCIAL'),
    ).toMatchObject({ xp: '30', level: 2 });
    expect(
      (await get(a.token, '/jobs')).body.items.find(
        (j: { id: string }) => j.id === sales.id,
      ),
    ).toMatchObject({ available: true, skillRequirement: { met: true } });
    await start(a.token, sales.id);
    expect((await economy.reconcile(a.characterId)).ok).toBe(true);
  });
  it('snapshots XP configuration, protects ownership and retains durable award references', async () => {
    const a = await player(),
      b = await player();
    const j = await job();
    const shift = await start(a.token, j.id);
    await db.client.job.update({
      where: { id: j.id },
      data: { xpReward: 100n },
    });
    await wait();
    const before = await snapshot(a.characterId);
    expect(
      (await post(b.token, `/jobs/assignments/${shift.id}/complete`)).status,
    ).toBe(404);
    expect(await snapshot(a.characterId)).toEqual(before);
    expect(
      (await post(a.token, `/jobs/assignments/${shift.id}/complete`)).body
        .assignment.skillProgress.xpAwarded,
    ).toBe('15');
    const record = await db.client.jobAssignment.findUniqueOrThrow({
      where: { id: shift.id },
    });
    expect(record).toMatchObject({
      xpSkillId: j.xpSkillId,
      xpReward: 15n,
      xpAwarded: 15n,
      previousLevel: 1,
      currentLevel: 1,
    });
    await expect(
      db.client.characterSkill.update({
        where: {
          characterId_skillId: {
            characterId: a.characterId,
            skillId: j.xpSkillId!,
          },
        },
        data: { xp: 0n },
      }),
    ).rejects.toThrow();
  });
  it('has reachable V1 job skill paths and keeps vehicle gates locked', async () => {
    const jobs = await db.client.job.findMany({
      where: {
        code: {
          in: [
            'CLEANER',
            'SHOP_ASSISTANT',
            'DELIVERY_RIDER',
            'SALES_REP',
            'PHOTOGRAPHER',
            'DESIGNER',
            'JUNIOR_DEVELOPER',
            'ACCOUNTANT',
            'SOFTWARE_ENGINEER',
            'MANAGER',
            'CONSULTANT',
          ],
        },
      },
    });
    expect(jobs).toHaveLength(11);
    const reachable = new Set<string>();
    for (let pass = 0; pass < 6; pass++)
      for (const j of jobs)
        if (
          !j.futureRequirement &&
          j.reputationRequired === 0n &&
          (!j.requiredSkillId || reachable.has(j.requiredSkillId))
        ) {
          if (j.xpSkillId) reachable.add(j.xpSkillId);
        }
    for (const j of jobs.filter(
      (j) => !j.futureRequirement && j.requiredSkillId,
    ))
      expect(reachable.has(j.requiredSkillId!)).toBe(true);
    expect(
      jobs.find((j) => j.code === 'DELIVERY_RIDER')?.futureRequirement,
    ).toContain('vehicle');
    expect(reachable.has('55000000-0000-4000-8000-000000000003')).toBe(false);
    expect(reachable.has('55000000-0000-4000-8000-000000000006')).toBe(false);
  });
});
