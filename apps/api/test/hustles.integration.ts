import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  defaultAppearance,
  hustleOutcomes,
  type HustleOutcome,
} from '@hk/shared';
import { AppModule } from '../src/app.module.js';
import { AppConfig } from '../src/config/config.module.js';
import { DatabaseService } from '../src/database/database.module.js';
import { EconomyService } from '../src/economy/economy.service.js';
import { SkillsService } from '../src/skills/skills.service.js';
import { HustlesService } from '../src/hustles/hustles.service.js';
import { RandomService } from '../src/hustles/random.service.js';
import { RedisService } from '../src/redis/redis.module.js';
import { setupApplication } from '../src/setup.js';
let app: INestApplication,
  db: DatabaseService,
  config: AppConfig,
  economy: EconomyService;
const prefix = `ph6_${randomUUID().slice(0, 8)}_`;
let sequence = 0;
const profile = {
  BIG_WIN: { weight: 400, xp: 30 },
  SUCCESS: { weight: 3600, xp: 20 },
  PARTIAL_SUCCESS: { weight: 2500, xp: 12 },
  FAILURE: { weight: 2500, xp: 4 },
  DISASTER: { weight: 1000, xp: 2 },
};
let draws: bigint[] = [];
const random = {
  below: vi.fn((upper: bigint) => {
    const value = draws.shift() ?? 0n;
    if (value >= upper) throw new Error('Invalid fixture draw');
    return value;
  }),
};
function force(outcome: HustleOutcome, payout: bigint = 0n) {
  let roll = 0;
  for (const key of hustleOutcomes) {
    if (key === outcome) break;
    roll += profile[key].weight;
  }
  draws = [BigInt(roll), payout];
}
function get(token: string, path: string) {
  return request(app.getHttpServer())
    .get(`/api/v1${path}`)
    .set('Authorization', `Bearer ${token}`);
}
function post(
  token: string,
  path: string,
  body: unknown = {},
  key: string = randomUUID(),
) {
  return request(app.getHttpServer())
    .post(`/api/v1${path}`)
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', key)
    .set('Content-Type', 'application/json')
    .send(JSON.stringify(body));
}
async function player() {
  const username = `${prefix}${sequence++}`;
  const r = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .set('Origin', config.values.webOrigin)
    .set('X-HK-Client', 'web')
    .send({
      username,
      email: `${username}@example.test`,
      password: `fixture ${randomUUID()}`,
    });
  expect(r.status).toBe(201);
  const token = String(r.body.accessToken);
  const c = await post(token, '/characters', {
    name: 'Street fixture',
    gender: 'FEMALE',
    appearance: defaultAppearance,
  });
  expect(c.status).toBe(201);
  return { token, characterId: String(c.body.id) };
}
async function hustle(extra: object = {}) {
  return db.client.hustle.create({
    data: {
      code: `${prefix}${sequence++}`,
      name: 'Fictional test opportunity',
      description: 'An abstract risk.',
      locationLabel: 'Test Old Town',
      tier: 1,
      entryCost: 1000n,
      rewardMin: 20000n,
      rewardMax: 80000n,
      disasterLoss: 2000n,
      outcomeProfile: profile,
      riskLabel: 'MEDIUM',
      energyCost: 15,
      requiredSkillId: '55000000-0000-4000-8000-000000000006',
      requiredSkillLevel: 1,
      cooldownSeconds: 0,
      testOnly: true,
      ...extra,
    },
  });
}
const path = (id: string) => `/hustles/${id}/attempt`;
async function snapshot(characterId: string) {
  return {
    stats: await db.client.characterStats.findUniqueOrThrow({
      where: { characterId },
    }),
    wallet: await db.client.wallet.findUniqueOrThrow({
      where: { characterId },
    }),
    skills: await db.client.characterSkill.findMany({
      where: { characterId },
      orderBy: { skillId: 'asc' },
    }),
    attempts: await db.client.hustleAttempt.findMany({
      where: { characterId },
      orderBy: { id: 'asc' },
    }),
    ledger: await db.client.walletTransaction.count({ where: { characterId } }),
    receipts: await db.client.idempotencyRecord.count({
      where: { user: { character: { id: characterId } } },
    }),
  };
}
beforeAll(async () => {
  const values = {
    ...new AppConfig().values,
    nodeEnv: 'test' as const,
    authRateLimit: 1000,
  };
  const redis = new URL(values.redisUrl);
  redis.pathname = '/1';
  values.redisUrl = redis.toString();
  config = { values };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppConfig)
    .useValue(config)
    .overrideProvider(RandomService)
    .useValue(random)
    .compile();
  app = module.createNestApplication({ logger: false });
  setupApplication(app);
  await app.init();
  db = app.get(DatabaseService);
  economy = app.get(EconomyService);
});
beforeEach(() => {
  draws = [];
  random.below.mockClear();
});
afterAll(async () => {
  if (db)
    await db.client.hustle.updateMany({
      where: { code: { startsWith: prefix } },
      data: { isActive: false },
    });
  await app?.close();
});
describe('authoritative abstract hustle boundary', () => {
  it('authenticates and exposes safe requirements without probabilities or snapshots', async () => {
    expect(
      (await request(app.getHttpServer()).get('/api/v1/hustles')).status,
    ).toBe(401);
    const a = await player(),
      h = await hustle(),
      high = await hustle({ requiredSkillLevel: 2 }),
      disabled = await hustle({ isActive: false });
    const r = await get(a.token, '/hustles');
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body.items).toContainEqual(
      expect.objectContaining({
        id: h.id,
        available: true,
        riskLabel: 'MEDIUM',
        entryCost: '1000',
        maximumLoss: '3000',
      }),
    );
    expect(r.body.items).toContainEqual(
      expect.objectContaining({
        id: high.id,
        available: false,
        lockCode: 'HUSTLE_REQUIREMENTS_NOT_MET',
      }),
    );
    expect(r.body.items.some((i: { id: string }) => i.id === disabled.id)).toBe(
      false,
    );
    for (const hidden of [
      'outcomeProfile',
      'weight',
      'baseSuccessBps',
      'configurationSnapshot',
      'rngVersion',
    ])
      expect(JSON.stringify(r.body)).not.toContain(hidden);
    expect((await get(a.token, '/hustles?reward=99999')).status).toBe(400);
  });
  it('hides deterministic test fixtures outside test mode', async () => {
    const a = await player(),
      h = await hustle();
    config.values.nodeEnv = 'production';
    try {
      expect(
        (await get(a.token, '/hustles')).body.items.some(
          (i: { id: string }) => i.id === h.id,
        ),
      ).toBe(false);
      expect(
        (await post(a.token, path(h.id), { attemptId: randomUUID() })).status,
      ).toBe(404);
      expect(random.below).not.toHaveBeenCalled();
    } finally {
      config.values.nodeEnv = 'test';
    }
  });
  it('rejects injected outcomes, resources, ownership and malformed attempt intent', async () => {
    const a = await player(),
      h = await hustle(),
      before = await snapshot(a.characterId);
    for (const field of [
      'outcome',
      'reward',
      'loss',
      'probability',
      'randomRoll',
      'streetXp',
      'energyCost',
      'heat',
      'reputation',
      'characterId',
    ])
      expect(
        (
          await post(a.token, path(h.id), {
            attemptId: randomUUID(),
            [field]: 999999,
          })
        ).status,
      ).toBe(400);
    for (const body of [{}, { attemptId: 'bad' }, { attemptId: 1 }])
      expect((await post(a.token, path(h.id), body)).status).toBe(400);
    expect(
      (await post(a.token, path(h.id), { attemptId: randomUUID() }, 'bad'))
        .status,
    ).toBe(400);
    expect(await snapshot(a.characterId)).toEqual(before);
    expect(random.below).not.toHaveBeenCalled();
  });
  it('rejects locked, disabled, unaffordable and exhausted attempts before any random draw', async () => {
    const a = await player();
    for (const [extra, code] of [
      [{ requiredSkillLevel: 2 }, 'HUSTLE_REQUIREMENTS_NOT_MET'],
      [{ isActive: false }, 'HUSTLE_DISABLED'],
      [{ disasterLoss: 6000n }, 'INSUFFICIENT_FUNDS'],
      [{ futureRequirement: 'Future location' }, 'HUSTLE_REQUIREMENTS_NOT_MET'],
    ] as const) {
      const h = await hustle(extra);
      const before = await snapshot(a.characterId);
      expect(
        (await post(a.token, path(h.id), { attemptId: randomUUID() })).body
          .error.code,
      ).toBe(code);
      expect(await snapshot(a.characterId)).toEqual(before);
    }
    const h = await hustle();
    await db.client.characterStats.update({
      where: { characterId: a.characterId },
      data: { energy: 0 },
    });
    const before = await snapshot(a.characterId);
    expect(
      (await post(a.token, path(h.id), { attemptId: randomUUID() })).body.error
        .code,
    ).toBe('INSUFFICIENT_ENERGY');
    expect(await snapshot(a.characterId)).toEqual(before);
    expect(random.below).not.toHaveBeenCalled();
  });
  it.each(hustleOutcomes)(
    'resolves %s with exact money, ledger, Energy, XP and dormant Phase 7 state',
    async (outcome) => {
      const a = await player(),
        h = await hustle(),
        id = randomUUID();
      force(outcome);
      const r = await post(a.token, path(h.id), { attemptId: id });
      expect(r.status).toBe(200);
      const reward = {
          BIG_WIN: 68000n,
          SUCCESS: 35000n,
          PARTIAL_SUCCESS: 20000n,
          FAILURE: 0n,
          DISASTER: 0n,
        }[outcome],
        loss = outcome === 'DISASTER' ? 3000n : 1000n;
      expect(r.body.attempt).toMatchObject({
        id,
        outcome,
        reward: reward.toString(),
        loss: loss.toString(),
        net: (reward - loss).toString(),
        energySpent: 15,
        skillProgress: {
          skill: 'STREET',
          xpAwarded: String(profile[outcome].xp),
        },
      });
      const state = await snapshot(a.characterId);
      expect(state.wallet.bankBalance).toBe(5000n + reward - loss);
      expect(state.stats).toMatchObject({
        energy: 85,
        heat: 0,
        reputation: 0n,
        health: 100,
        stress: 10,
      });
      expect(
        state.skills.find(
          (s) => s.skillId === '55000000-0000-4000-8000-000000000006',
        )?.xp,
      ).toBe(BigInt(profile[outcome].xp));
      const ledger = await db.client.walletTransaction.findMany({
        where: { referenceType: 'hustle_attempt', referenceId: id },
      });
      expect(
        ledger.find((t) => t.transactionType === 'HUSTLE_LOSS'),
      ).toMatchObject({
        amount: loss,
        account: 'BANK',
        direction: 'DEBIT',
        characterId: a.characterId,
      });
      if (reward > 0n)
        expect(
          ledger.find((t) => t.transactionType === 'HUSTLE_REWARD'),
        ).toMatchObject({
          amount: reward,
          account: 'BANK',
          direction: 'CREDIT',
        });
      else expect(ledger).toHaveLength(1);
      expect((await economy.reconcile(a.characterId)).ok).toBe(true);
      await expect(
        db.client.hustleAttempt.update({
          where: { id },
          data: { rewardAmount: 999999n },
        }),
      ).rejects.toThrow();
      await expect(
        db.client.hustleAttempt.delete({ where: { id } }),
      ).rejects.toThrow();
    },
  );
  it('supports a zero-cost failure with no fabricated zero-value ledger entry', async () => {
    const a = await player(),
      h = await hustle({ entryCost: 0n });
    force('FAILURE');
    const r = await post(a.token, path(h.id), { attemptId: randomUUID() });
    expect(r.status).toBe(200);
    expect(r.body.attempt).toMatchObject({ reward: '0', loss: '0', net: '0' });
    expect((await snapshot(a.characterId)).ledger).toBe(2);
  });
  it('replays original outcomes without reroll and enforces ownership and key fingerprints', async () => {
    const a = await player(),
      b = await player(),
      h = await hustle(),
      other = await hustle(),
      id = randomUUID(),
      key = randomUUID();
    force('SUCCESS');
    const first = await post(a.token, path(h.id), { attemptId: id }, key);
    expect(first.status).toBe(200);
    const drawsUsed = random.below.mock.calls.length;
    draws = [9999n];
    expect(
      (await post(a.token, path(h.id), { attemptId: id }, key)).body,
    ).toEqual(first.body);
    expect((await post(a.token, path(h.id), { attemptId: id })).body).toEqual(
      first.body,
    );
    expect(random.below).toHaveBeenCalledTimes(drawsUsed);
    expect(
      (await post(a.token, path(other.id), { attemptId: id })).body.error.code,
    ).toBe('IDEMPOTENCY_CONFLICT');
    expect(
      (await post(a.token, path(h.id), { attemptId: randomUUID() }, key)).body
        .error.code,
    ).toBe('IDEMPOTENCY_CONFLICT');
    expect((await get(b.token, `/hustles/attempts/${id}`)).status).toBe(404);
    expect((await post(b.token, path(h.id), { attemptId: id })).status).toBe(
      404,
    );
    expect((await get(b.token, `/hustles/history?cursor=${id}`)).status).toBe(
      400,
    );
    expect((await get(a.token, `/hustles/attempts/${id}`)).body).toEqual(
      first.body.attempt,
    );
  });
  it.each(['same', 'distinct'] as const)(
    'commits one reward and XP for 20 simultaneous %s-key requests',
    async (mode) => {
      const a = await player(),
        h = await hustle({ cooldownSeconds: 30 }),
        id = randomUUID(),
        key = randomUUID();
      force('SUCCESS');
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          post(
            a.token,
            path(h.id),
            { attemptId: id },
            mode === 'same' ? key : randomUUID(),
          ),
        ),
      );
      expect(results.map((r) => r.status)).toEqual(Array(20).fill(200));
      for (const r of results) expect(r.body).toEqual(results[0]!.body);
      const state = await snapshot(a.characterId);
      expect(state.attempts).toHaveLength(1);
      expect(state.stats.energy).toBe(85);
      expect(state.wallet.bankBalance).toBe(39000n);
      expect(
        state.skills.find(
          (s) => s.skillId === '55000000-0000-4000-8000-000000000006',
        )?.xp,
      ).toBe(20n);
      expect(random.below).toHaveBeenCalledTimes(2);
      expect((await economy.reconcile(a.characterId)).ok).toBe(true);
    },
  );
  it.each(['same', 'distinct'] as const)(
    'commits one loss for 20 simultaneous %s-key disaster requests',
    async (mode) => {
      const a = await player(),
        h = await hustle({ cooldownSeconds: 30 }),
        id = randomUUID(),
        key = randomUUID();
      force('DISASTER');
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          post(
            a.token,
            path(h.id),
            { attemptId: id },
            mode === 'same' ? key : randomUUID(),
          ),
        ),
      );
      expect(results.map((r) => r.status)).toEqual(Array(20).fill(200));
      const state = await snapshot(a.characterId);
      expect(state.attempts).toHaveLength(1);
      expect(state.wallet.bankBalance).toBe(2000n);
      expect(state.stats.energy).toBe(85);
      expect(
        state.skills.find(
          (s) => s.skillId === '55000000-0000-4000-8000-000000000006',
        )?.xp,
      ).toBe(2n);
      expect(state.ledger).toBe(3);
      expect(random.below).toHaveBeenCalledTimes(1);
    },
  );
  it('rolls back every effect after ledger writes or after Street mutation fails', async () => {
    const a = await player(),
      h = await hustle(),
      id = randomUUID(),
      key = randomUUID(),
      before = await snapshot(a.characterId);
    const settle = economy.settleHustleInTransaction.bind(economy);
    const fail = vi
      .spyOn(economy, 'settleHustleInTransaction')
      .mockImplementationOnce(async (...args) => {
        await settle(...args);
        throw new Error('private after ledger');
      });
    try {
      force('SUCCESS');
      expect(
        (await post(a.token, path(h.id), { attemptId: id }, key)).status,
      ).toBe(500);
      expect(await snapshot(a.characterId)).toEqual(before);
    } finally {
      fail.mockRestore();
    }
    const skills = app.get(SkillsService),
      award = skills.awardStreetInTransaction.bind(skills);
    const xpFail = vi
      .spyOn(skills, 'awardStreetInTransaction')
      .mockImplementationOnce(async (...args) => {
        await award(...args);
        throw new Error('private after XP');
      });
    try {
      force('SUCCESS');
      const r = await post(a.token, path(h.id), { attemptId: id }, key);
      expect(r.status).toBe(500);
      expect(JSON.stringify(r.body)).not.toContain('private');
      expect(await snapshot(a.characterId)).toEqual(before);
    } finally {
      xpFail.mockRestore();
    }
    force('SUCCESS');
    expect(
      (await post(a.token, path(h.id), { attemptId: id }, key)).status,
    ).toBe(200);
  });
  it('uses one global server cooldown across opportunities and serializes competing new intents', async () => {
    const a = await player(),
      h = await hustle({ cooldownSeconds: 30 }),
      other = await hustle();
    force('SUCCESS');
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        post(a.token, path(h.id), { attemptId: randomUUID() }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(
      results.filter((r) => r.body.error?.code === 'HUSTLE_NOT_READY'),
    ).toHaveLength(19);
    expect(
      (await post(a.token, path(other.id), { attemptId: randomUUID() })).body
        .error.code,
    ).toBe('HUSTLE_NOT_READY');
    expect(random.below).toHaveBeenCalledTimes(2);
  });
  it('levels Street through real participation and unlocks a higher opportunity', async () => {
    const a = await player(),
      entry = await hustle({ entryCost: 0n }),
      higher = await hustle({ requiredSkillLevel: 2 });
    expect(
      (await post(a.token, path(higher.id), { attemptId: randomUUID() })).body
        .error.code,
    ).toBe('HUSTLE_REQUIREMENTS_NOT_MET');
    for (let n = 0; n < 2; n++) {
      force('SUCCESS');
      const r = await post(a.token, path(entry.id), {
        attemptId: randomUUID(),
      });
      expect(r.status).toBe(200);
      if (n === 1) {
        expect(r.body.attempt.skillProgress).toMatchObject({
          currentLevel: 2,
          leveledUp: true,
        });
        expect(r.body.attempt.unlocks).toContainEqual(
          expect.objectContaining({ id: higher.id }),
        );
      }
    }
    const catalog = await get(a.token, '/hustles');
    expect(
      catalog.body.items.find((i: { id: string }) => i.id === higher.id),
    ).toMatchObject({ available: true, currentStreetLevel: 2 });
    force('SUCCESS');
    expect(
      (await post(a.token, path(higher.id), { attemptId: randomUUID() }))
        .status,
    ).toBe(200);
    const history = await get(a.token, '/hustles/history?limit=2');
    expect(history.body.items).toHaveLength(2);
    expect(history.body.nextCursor).toBeTruthy();
    expect(
      (
        await get(
          a.token,
          `/hustles/history?limit=2&cursor=${history.body.nextCursor}`,
        )
      ).body.items,
    ).toHaveLength(1);
    expect(
      (await get(a.token, '/skills')).body.skills.find(
        (s: { code: string }) => s.code === 'STREET',
      ),
    ).toMatchObject({ level: 2, xp: '60' });
  });
  it('rejects invalid profiles at the database boundary and fails closed on rate-limit outage', async () => {
    await expect(
      hustle({
        outcomeProfile: { ...profile, SUCCESS: { weight: 3500, xp: 20 } },
      }),
    ).rejects.toThrow();
    const a = await player(),
      h = await hustle(),
      redis = app.get(RedisService);
    const fail = vi
      .spyOn(redis.client, 'eval')
      .mockRejectedValueOnce(new Error('private redis'));
    try {
      expect(
        (await post(a.token, path(h.id), { attemptId: randomUUID() })).status,
      ).toBe(503);
    } finally {
      fail.mockRestore();
    }
    for (let n = 0; n < 60; n++)
      expect(
        (await post(a.token, path(randomUUID()), { attemptId: randomUUID() }))
          .status,
      ).toBe(404);
    expect(
      (await post(a.token, path(h.id), { attemptId: randomUUID() })).status,
    ).toBe(429);
    expect(random.below).not.toHaveBeenCalled();
    await app.get(HustlesService).onModuleInit();
  });
});
