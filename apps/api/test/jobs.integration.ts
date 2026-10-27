import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { defaultAppearance } from '@hk/shared';
import { AppModule } from '../src/app.module.js';
import { AppConfig } from '../src/config/config.module.js';
import { DatabaseService } from '../src/database/database.module.js';
import { EconomyService } from '../src/economy/economy.service.js';
import { CharacterService } from '../src/characters/character.service.js';
import { SkillsService } from '../src/skills/skills.service.js';
import { RedisService } from '../src/redis/redis.module.js';
import { setupApplication } from '../src/setup.js';
let app: INestApplication;
let db: DatabaseService;
let economy: EconomyService;
let config: AppConfig;
const prefix = `ph4_${randomUUID().slice(0, 8)}_`;
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
describe('first playable work boundary', () => {
  it('authenticates, derives the character, rejects query tampering and serializes safe catalog values', async () => {
    expect(
      (await request(app.getHttpServer()).get('/api/v1/jobs')).status,
    ).toBe(401);
    const account = await player(false);
    expect((await get(account.token, '/jobs')).body.error.code).toBe(
      'CHARACTER_REQUIRED',
    );
    const a = await player();
    const enabled = await job();
    const disabled = await job({ isActive: false });
    const locked = await job({
      futureRequirement: 'Requires Technology progression',
    });
    const response = await get(a.token, '/jobs');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.items).toContainEqual(
      expect.objectContaining({
        id: enabled.id,
        baseReward: '8000',
        available: true,
        energyCost: 10,
        durationSeconds: 1,
      }),
    );
    expect(response.body.items).toContainEqual(
      expect.objectContaining({
        id: locked.id,
        available: false,
        lockCode: 'JOB_REQUIREMENTS_NOT_MET',
      }),
    );
    expect(response.body.items.map((j: { id: string }) => j.id)).not.toContain(
      disabled.id,
    );
    expect((await get(a.token, '/jobs?characterId=other')).status).toBe(400);
    const dashboard = await get(a.token, '/dashboard');
    expect(dashboard.body).toMatchObject({
      hasWorked: false,
      activeJob: null,
      wallet: { total: '20000' },
      character: { stats: { energy: 100 } },
    });
    expect(JSON.stringify(dashboard.body)).not.toMatch(
      /password|session|userId|creationHash/,
    );
  });
  it('enforces job existence, enabled/requirement/reputation/energy gates and validates mutation intent', async () => {
    const a = await player();
    const normal = await job();
    expect(
      (await post(a.token, `/jobs/${randomUUID()}/start`)).body.error.code,
    ).toBe('JOB_NOT_FOUND');
    for (const [extra, code] of [
      [{ isActive: false }, 'JOB_DISABLED'],
      [{ futureRequirement: 'Vehicle' }, 'JOB_REQUIREMENTS_NOT_MET'],
      [{ reputationRequired: 1n }, 'REPUTATION_REQUIRED'],
    ] as const) {
      const j = await job(extra);
      expect((await post(a.token, `/jobs/${j.id}/start`)).body.error.code).toBe(
        code,
      );
    }
    for (const body of [
      { salary: '10000000' },
      { energyCost: 0 },
      { startedAt: new Date().toISOString() },
      { completesAt: new Date().toISOString() },
      { characterId: a.characterId },
      null,
      [],
    ])
      expect(
        (await post(a.token, `/jobs/${normal.id}/start`, randomUUID(), body))
          .status,
      ).toBe(400);
    expect(
      (await post(a.token, `/jobs/${normal.id}/start`, 'bad')).status,
    ).toBe(400);
    await db.client.characterStats.update({
      where: { characterId: a.characterId },
      data: { energy: 9 },
    });
    expect(
      (await post(a.token, `/jobs/${normal.id}/start`)).body.error.code,
    ).toBe('INSUFFICIENT_ENERGY');
  });
  it('makes starts idempotent and structurally permits one active assignment only', async () => {
    const a = await player();
    const first = await job();
    const second = await job();
    const key = randomUUID();
    const original = await start(a.token, first.id, key);
    expect((await post(a.token, `/jobs/${first.id}/start`, key)).body).toEqual(
      original,
    );
    expect(
      (await post(a.token, `/jobs/${second.id}/start`, key)).body.error.code,
    ).toBe('IDEMPOTENCY_CONFLICT');
    expect(
      (await post(a.token, `/jobs/${second.id}/start`)).body.error.code,
    ).toBe('JOB_ALREADY_ACTIVE');
    expect((await get(a.token, '/jobs/active')).body.assignment.id).toBe(
      original.id,
    );
    await expect(
      db.client.jobAssignment.create({
        data: {
          characterId: a.characterId,
          jobId: second.id,
          startedAt: new Date(),
          completesAt: new Date(Date.now() + 1000),
          baseReward: 8000n,
          energyCost: 10,
        },
      }),
    ).rejects.toThrow();
    expect((await snapshot(a.characterId)).stats.energy).toBe(100);
  });
  it('serializes simultaneous starts without multiplying assignments', async () => {
    const a = await player();
    const first = await job();
    const second = await job();
    const results = await Promise.all([
      post(a.token, `/jobs/${first.id}/start`),
      post(a.token, `/jobs/${second.id}/start`),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await db.client.jobAssignment.count({
        where: { characterId: a.characterId, status: 'ACTIVE' },
      }),
    ).toBe(1);
  });
  it('uses server time, rejects injected outcomes and hides assignments belonging to others', async () => {
    const a = await player();
    const b = await player();
    const j = await job();
    const shift = await start(a.token, j.id);
    expect(
      (await post(a.token, `/jobs/assignments/${shift.id}/complete`)).body.error
        .code,
    ).toBe('JOB_NOT_READY');
    for (const body of [
      { salary: '9999999' },
      { energyCost: 0 },
      { completedAt: '2100-01-01T00:00:00Z' },
      { characterId: b.characterId },
    ])
      expect(
        (
          await post(
            a.token,
            `/jobs/assignments/${shift.id}/complete`,
            randomUUID(),
            body,
          )
        ).status,
      ).toBe(400);
    expect(
      (await post(b.token, `/jobs/assignments/${shift.id}/complete`)).body.error
        .code,
    ).toBe('JOB_ASSIGNMENT_NOT_FOUND');
    expect((await get(b.token, '/jobs/active')).body.assignment).toBeNull();
    expect((await snapshot(a.characterId)).stats.energy).toBe(100);
  });
  it('atomically pays the snapshotted salary into Bank, records its reference, and restores current state', async () => {
    const a = await player();
    const j = await job();
    const shift = await start(a.token, j.id);
    await db.client.job.update({
      where: { id: j.id },
      data: { baseReward: 9000n, energyCost: 20 },
    });
    await wait();
    const key = randomUUID();
    const paid = await post(
      a.token,
      `/jobs/assignments/${shift.id}/complete`,
      key,
    );
    expect(paid.status).toBe(200);
    expect(paid.body).toMatchObject({
      result: { salary: '8000', energySpent: 10, account: 'BANK' },
      wallet: { cash: '15000', bank: '13000', total: '28000' },
      character: {
        stats: {
          energy: 90,
          heat: 0,
          reputation: '0',
          health: 100,
          stress: 10,
        },
      },
      assignment: { status: 'COMPLETED', rewardAmount: '8000' },
    });
    const row = await db.client.jobAssignment.findUniqueOrThrow({
      where: { id: shift.id },
    });
    const ledger = await db.client.walletTransaction.findUniqueOrThrow({
      where: { id: row.transactionId! },
    });
    expect(ledger).toMatchObject({
      characterId: a.characterId,
      transactionType: 'JOB_SALARY',
      referenceType: 'job_assignment',
      referenceId: shift.id,
      amount: 8000n,
      account: 'BANK',
      direction: 'CREDIT',
    });
    expect(
      (await get(a.token, '/wallet/transactions')).body.items[0],
    ).toMatchObject({ transactionType: 'JOB_SALARY', amount: '8000' });
    expect((await get(a.token, '/dashboard')).body).toMatchObject({
      hasWorked: true,
      activeJob: null,
      lastCompletedJob: { id: shift.id },
      character: { stats: { energy: 90 } },
      wallet: { total: '28000' },
    });
    expect(
      (await post(a.token, `/jobs/assignments/${shift.id}/complete`, key)).body,
    ).toEqual(paid.body);
    expect(
      (await post(a.token, `/jobs/assignments/${shift.id}/complete`)).body,
    ).toEqual(paid.body);
    const next = await start(a.token, j.id);
    expect(
      (await post(a.token, `/jobs/assignments/${next.id}/complete`, key)).body
        .error.code,
    ).toBe('IDEMPOTENCY_CONFLICT');
    expect((await economy.reconcile(a.characterId)).ok).toBe(true);
    await expect(
      db.client.jobAssignment.update({
        where: { id: shift.id },
        data: { rewardAmount: 1n },
      }),
    ).rejects.toThrow();
    await expect(
      db.client.walletTransaction.delete({ where: { id: ledger.id } }),
    ).rejects.toThrow();
  });
  it.each(['same', 'distinct'] as const)(
    'awards once for 20 simultaneous %s-key completions and cannot deduct below zero',
    async (mode) => {
      const a = await player();
      const j = await job();
      await db.client.characterStats.update({
        where: { characterId: a.characterId },
        data: { energy: 10 },
      });
      const shift = await start(a.token, j.id);
      await wait();
      const key = randomUUID();
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          post(
            a.token,
            `/jobs/assignments/${shift.id}/complete`,
            mode === 'same' ? key : randomUUID(),
          ),
        ),
      );
      expect(results.map((r) => r.status)).toEqual(Array(20).fill(200));
      for (const result of results)
        expect(result.body).toEqual(results[0]!.body);
      const state = await snapshot(a.characterId);
      expect(state.stats.energy).toBe(0);
      expect(state.wallet.bankBalance).toBe(13000n);
      expect(state.entries).toBe(3);
      expect(
        state.skills.find(
          (s) => s.skillId === '55000000-0000-4000-8000-000000000005',
        ),
      ).toMatchObject({ xp: 15n, level: 1 });
      expect(state.assignments[0]?.xpAwarded).toBe(15n);
      expect(
        state.assignments.filter((r) => r.status === 'COMPLETED'),
      ).toHaveLength(1);
      expect((await post(a.token, `/jobs/${j.id}/start`)).body.error.code).toBe(
        'INSUFFICIENT_ENERGY',
      );
      expect((await economy.reconcile(a.characterId)).ok).toBe(true);
    },
  );
  it('rolls back energy, assignment, wallet, ledger and receipt when payment or a later boundary fails', async () => {
    const a = await player();
    const j = await job();
    const shift = await start(a.token, j.id);
    await wait();
    const before = await snapshot(a.characterId);
    const key = randomUUID();
    const skills = app.get(SkillsService);
    const award = skills.awardJobInTransaction.bind(skills);
    const xpFailure = vi
      .spyOn(skills, 'awardJobInTransaction')
      .mockImplementationOnce(async (...args) => {
        await award(...args);
        throw new Error('private after XP');
      });
    try {
      expect(
        (await post(a.token, `/jobs/assignments/${shift.id}/complete`, key))
          .status,
      ).toBe(500);
      expect(await snapshot(a.characterId)).toEqual(before);
    } finally {
      xpFailure.mockRestore();
    }
    const fail = vi
      .spyOn(economy, 'creditJobSalaryInTransaction')
      .mockRejectedValueOnce(new Error('private database failure'));
    try {
      const response = await post(
        a.token,
        `/jobs/assignments/${shift.id}/complete`,
        key,
      );
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain('private database');
      expect(await snapshot(a.characterId)).toEqual(before);
    } finally {
      fail.mockRestore();
    }
    const characters = app.get(CharacterService);
    const own = characters.ownInTransaction.bind(characters);
    let calls = 0;
    const later = vi
      .spyOn(characters, 'ownInTransaction')
      .mockImplementation((tx, id) => {
        if (++calls === 2) throw new Error('private after payment');
        return own(tx, id);
      });
    try {
      expect(
        (await post(a.token, `/jobs/assignments/${shift.id}/complete`, key))
          .status,
      ).toBe(500);
      expect(await snapshot(a.characterId)).toEqual(before);
    } finally {
      later.mockRestore();
    }
    expect(
      (await post(a.token, `/jobs/assignments/${shift.id}/complete`, key))
        .status,
    ).toBe(200);
  });
  it('checks current energy again at completion and rejects non-active assignments', async () => {
    const a = await player();
    const j = await job();
    const shift = await start(a.token, j.id);
    await wait();
    await db.client.characterStats.update({
      where: { characterId: a.characterId },
      data: { energy: 9 },
    });
    const before = await snapshot(a.characterId);
    expect(
      (await post(a.token, `/jobs/assignments/${shift.id}/complete`)).body.error
        .code,
    ).toBe('INSUFFICIENT_ENERGY');
    expect(await snapshot(a.characterId)).toEqual(before);
    await db.client.jobAssignment.update({
      where: { id: shift.id },
      data: { status: 'CANCELLED' },
    });
    expect(
      (await post(a.token, `/jobs/assignments/${shift.id}/complete`)).body.error
        .code,
    ).toBe('JOB_NOT_ACTIVE');
  });
  it('fails closed on Redis outage and rate-limits work mutation attempts', async () => {
    const a = await player(false);
    const path = `/jobs/${randomUUID()}/start`;
    const redis = app.get(RedisService);
    const fail = vi
      .spyOn(redis.client, 'eval')
      .mockRejectedValueOnce(new Error('private Redis'));
    try {
      expect((await post(a.token, path)).status).toBe(503);
    } finally {
      fail.mockRestore();
    }
    for (let i = 0; i < 60; i++)
      expect((await post(a.token, path)).status).toBe(404);
    expect((await post(a.token, path)).body.error.code).toBe('RATE_LIMITED');
  });
});
