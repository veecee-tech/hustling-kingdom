import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { decodeJwt } from 'jose';
import request from 'supertest';
import { defaultAppearance } from '@hk/shared';
import { AppModule } from '../src/app.module.js';
import { AppConfig } from '../src/config/config.module.js';
import { DatabaseService } from '../src/database/database.module.js';
import { EconomyService } from '../src/economy/economy.service.js';
import { MAX_MONEY } from '../src/economy/economy.rules.js';
import { setupApplication } from '../src/setup.js';
let app: INestApplication;
let db: DatabaseService;
let economy: EconomyService;
let config: AppConfig;
const prefix = `ph3_${randomUUID().slice(0, 8)}_`;
let sequence = 0;
async function player(withCharacter = true) {
  const username = `${prefix}${sequence++}`;
  const registration = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .set('Origin', config.values.webOrigin)
    .set('X-HK-Client', 'web')
    .send({
      username,
      email: `${username}@example.test`,
      password: `fixture ${randomUUID()}`,
    });
  expect(registration.status).toBe(201);
  const token = String(registration.body.accessToken);
  const userId = String(registration.body.user.id);
  const actor = { userId, familyId: String(decodeJwt(token).sid) };
  let characterId = '';
  if (withCharacter) {
    const created = await request(app.getHttpServer())
      .post('/api/v1/characters')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        name: 'Nneka Ọlá',
        gender: 'FEMALE',
        appearance: defaultAppearance,
      });
    expect(created.status).toBe(201);
    characterId = String(created.body.id);
  }
  return { token, userId, actor, characterId };
}
function read(token: string, path = '/wallet') {
  return request(app.getHttpServer())
    .get(`/api/v1${path}`)
    .set('Authorization', `Bearer ${token}`);
}
function move(
  token: string,
  amount: unknown = '1000',
  direction = 'deposit',
  key: string = randomUUID(),
  extra: object = {},
) {
  return request(app.getHttpServer())
    .post(`/api/v1/wallet/${direction}`)
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', key)
    .send({ amount, ...extra });
}
function intent(
  actor: { userId: string; familyId: string },
  amount: bigint,
  account: 'CASH' | 'BANK' = 'CASH',
  key: string = randomUUID(),
) {
  return {
    ...actor,
    amount,
    account,
    idempotencyKey: key,
    reference: { type: 'integration', id: randomUUID() },
  };
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
  economy = app.get(EconomyService);
});
afterAll(async () => {
  // Economic history is retained: never disable protections just to clean fixtures.
  if (db)
    await db.client.user.deleteMany({
      where: { username: { startsWith: prefix }, character: { is: null } },
    });
  await app?.close();
});
describe('authoritative economy', () => {
  it('funds new characters with exactly two origins and initializes legacy characters exactly once', async () => {
    const user = await player();
    expect((await read(user.token)).body).toMatchObject({
      cash: '15000',
      bank: '5000',
      total: '20000',
    });
    expect(
      await db.client.walletTransaction.findMany({
        where: { characterId: user.characterId },
        orderBy: { sequence: 'asc' },
      }),
    ).toMatchObject([
      {
        transactionType: 'STARTING_CASH',
        amount: 15000n,
        balanceBefore: 0n,
        balanceAfter: 15000n,
      },
      {
        transactionType: 'STARTING_BANK',
        amount: 5000n,
        balanceBefore: 0n,
        balanceAfter: 5000n,
      },
    ]);
    const legacy = await player(false);
    const char = await db.client.character.create({
      data: {
        userId: legacy.userId,
        name: 'Legacy fixture',
        slug: randomUUID(),
        gender: 'MALE',
        appearance: defaultAppearance,
        creationKey: randomUUID(),
        creationHash: 'a'.repeat(64),
        creationResponse: {},
        stats: { create: {} },
      },
    });
    expect((await read(legacy.token)).body.error.code).toBe('WALLET_REQUIRED');
    await economy.backfill();
    await economy.backfill();
    expect((await read(legacy.token)).body.total).toBe('20000');
    expect(
      await db.client.walletTransaction.count({
        where: { characterId: char.id },
      }),
    ).toBe(2);
    await expect(
      db.client.wallet.create({ data: { characterId: user.characterId } }),
    ).rejects.toThrow();
    expect((await economy.reconcile(char.id)).ok).toBe(true);
  });
  it('rolls character creation back if economy initialization fails', async () => {
    const user = await player(false);
    const spy = vi
      .spyOn(economy, 'initializeInTransaction')
      .mockRejectedValueOnce(new Error('private failure'));
    try {
      const result = await request(app.getHttpServer())
        .post('/api/v1/characters')
        .set('Authorization', `Bearer ${user.token}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          name: 'Atomic fixture',
          gender: 'MALE',
          appearance: defaultAppearance,
        });
      expect(result.status).toBe(500);
      expect(JSON.stringify(result.body)).not.toContain('private failure');
      expect(
        await db.client.character.count({ where: { userId: user.userId } }),
      ).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
  it('supports atomic credits, debits, exact balance and durable retry receipts', async () => {
    const user = await player();
    const credit = intent(user.actor, 2000n);
    expect((await economy.credit(credit)).cash).toBe('17000');
    expect((await economy.credit(credit)).cash).toBe('17000');
    const debit = intent(user.actor, 17000n);
    expect((await economy.debit(debit)).cash).toBe('0');
    expect((await economy.debit(debit)).cash).toBe('0');
    await expect(economy.debit(intent(user.actor, 1n))).rejects.toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
    });
    const ledger = await db.client.walletTransaction.findMany({
      where: { characterId: user.characterId },
      orderBy: { sequence: 'asc' },
    });
    expect(ledger.at(-2)).toMatchObject({
      balanceBefore: 15000n,
      balanceAfter: 17000n,
      amount: 2000n,
    });
    expect(ledger.at(-1)).toMatchObject({
      balanceBefore: 17000n,
      balanceAfter: 0n,
      amount: 17000n,
    });
    expect((await economy.reconcile(user.characterId)).ok).toBe(true);
  });
  it('keeps transfer total constant and correlates two sides', async () => {
    const user = await player();
    expect((await move(user.token, '5000')).body).toMatchObject({
      cash: '10000',
      bank: '10000',
      total: '20000',
    });
    expect((await move(user.token, '10000', 'withdraw')).body).toMatchObject({
      cash: '20000',
      bank: '0',
      total: '20000',
    });
    const rows = await db.client.walletTransaction.findMany({
      where: { characterId: user.characterId, transactionType: 'CASH_DEPOSIT' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.correlationId).toBe(rows[1]?.correlationId);
    expect(rows[0]?.idempotencyKey).toBe(rows[1]?.idempotencyKey);
    expect((await economy.reconcile(user.characterId)).ok).toBe(true);
  });
  it('replays original success after further changes, rejects conflicting reuse, and permits retry after failure', async () => {
    const user = await player();
    const key = randomUUID();
    const first = await move(user.token, '1000', 'deposit', key);
    expect(first.status).toBe(200);
    await move(user.token, '2000', 'deposit');
    expect((await move(user.token, '1000', 'deposit', key)).body).toEqual(
      first.body,
    );
    const conflict = await move(user.token, '1001', 'deposit', key);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    const failedKey = randomUUID();
    expect(
      (await move(user.token, '13000', 'deposit', failedKey)).body.error.code,
    ).toBe('INSUFFICIENT_FUNDS');
    await economy.credit(intent(user.actor, 1000n));
    expect((await move(user.token, '13000', 'deposit', failedKey)).status).toBe(
      200,
    );
    expect((await economy.reconcile(user.characterId)).ok).toBe(true);
  });
  it('serializes parallel same-key requests and 20 overlapping spends', async () => {
    const retryUser = await player();
    const key = randomUUID();
    const retries = await Promise.all(
      Array.from({ length: 5 }, () =>
        move(retryUser.token, '500', 'deposit', key),
      ),
    );
    expect(retries.every((r) => r.status === 200)).toBe(true);
    expect(new Set(retries.map((r) => r.body.cash)).size).toBe(1);
    expect(
      await db.client.walletTransaction.count({
        where: { characterId: retryUser.characterId },
      }),
    ).toBe(4);
    const user = await player();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => move(user.token, '1000')),
    );
    const successes = results.filter((r) => r.status === 200).length;
    expect(successes).toBe(15);
    expect(results.filter((r) => r.status === 409)).toHaveLength(5);
    expect((await read(user.token)).body).toMatchObject({
      cash: '0',
      bank: '20000',
      total: '20000',
    });
    expect(
      await db.client.walletTransaction.count({
        where: { characterId: user.characterId },
      }),
    ).toBe(2 + successes * 2);
    expect((await economy.reconcile(user.characterId)).ok).toBe(true);
  });
  it('rolls a debit and ledger back if the destination would overflow', async () => {
    const user = await player();
    await economy.credit(intent(user.actor, MAX_MONEY - 5000n, 'BANK'));
    const before = await read(user.token);
    const count = await db.client.walletTransaction.count({
      where: { characterId: user.characterId },
    });
    expect((await move(user.token, '1')).body.error.code).toBe(
      'TRANSACTION_CONFLICT',
    );
    expect((await read(user.token)).body).toEqual(before.body);
    expect(
      await db.client.walletTransaction.count({
        where: { characterId: user.characterId },
      }),
    ).toBe(count);
    expect((await economy.reconcile(user.characterId)).ok).toBe(true);
  });
  it('rejects direct wallet changes, ledger rewrite/delete and unbalanced transfer SQL', async () => {
    const user = await player();
    const wallet = await db.client.wallet.findUniqueOrThrow({
      where: { characterId: user.characterId },
    });
    const row = await db.client.walletTransaction.findFirstOrThrow({
      where: { walletId: wallet.id },
    });
    await expect(
      db.client.wallet.update({
        where: { id: wallet.id },
        data: { cashBalance: 999999n },
      }),
    ).rejects.toThrow();
    await expect(
      db.client.walletTransaction.update({
        where: { id: row.id },
        data: { amount: 1n },
      }),
    ).rejects.toThrow();
    await expect(
      db.client.walletTransaction.delete({ where: { id: row.id } }),
    ).rejects.toThrow();
    await expect(
      db.client.walletTransaction.create({
        data: {
          walletId: wallet.id,
          characterId: user.characterId,
          account: 'CASH',
          direction: 'DEBIT',
          amount: 1n,
          balanceBefore: 15000n,
          balanceAfter: 14999n,
          transactionType: 'CASH_DEPOSIT',
          idempotencyKey: randomUUID(),
          correlationId: randomUUID(),
        },
      }),
    ).rejects.toThrow();
    expect((await read(user.token)).body.cash).toBe('15000');
    expect((await economy.reconcile(user.characterId)).ok).toBe(true);
  });
  it('enforces authorization, ownership, input bounds and private pagination', async () => {
    expect(
      (await request(app.getHttpServer()).get('/api/v1/wallet')).status,
    ).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/wallet/deposit')
          .send({ amount: '1' })
      ).status,
    ).toBe(401);
    const empty = await player(false);
    expect((await read(empty.token)).body.error.code).toBe(
      'CHARACTER_REQUIRED',
    );
    const user = await player();
    const other = await player();
    for (const amount of [
      '0',
      '-1',
      '1.2',
      '1e3',
      '01',
      '9223372036854775808',
      10,
      null,
    ])
      expect((await move(user.token, amount)).status).toBe(400);
    for (const key of [
      'userId',
      'characterId',
      'walletId',
      'balance',
      'reward',
      'transactionType',
      'balanceAfter',
    ])
      expect(
        (
          await move(user.token, '1', 'deposit', randomUUID(), {
            [key]: other.userId,
          })
        ).status,
      ).toBe(400);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/wallet/deposit')
          .set('Authorization', `Bearer ${user.token}`)
          .send({ amount: '1' })
      ).status,
    ).toBe(400);
    await move(user.token, '100');
    const first = await read(user.token, '/wallet/transactions?limit=2');
    const second = await read(
      user.token,
      `/wallet/transactions?limit=2&cursor=${first.body.nextCursor}`,
    );
    expect(first.body.items).toHaveLength(2);
    expect(second.body.items).toHaveLength(2);
    expect(second.body.nextCursor).toBeNull();
    expect(
      new Set([...first.body.items, ...second.body.items].map((r) => r.id))
        .size,
    ).toBe(4);
    expect(
      (
        await read(
          other.token,
          `/wallet/transactions?cursor=${first.body.nextCursor}`,
        )
      ).status,
    ).toBe(400);
    expect(
      (await read(other.token, `/wallet?userId=${user.userId}`)).body.cash,
    ).toBe('15000');
    expect(
      (await read(user.token, '/wallet/transactions?limit=100')).status,
    ).toBe(400);
    expect(
      (await read(user.token, '/wallet/transactions?cursor=bad')).status,
    ).toBe(400);
    expect(JSON.stringify(first.body)).not.toMatch(
      /userId|walletId|characterId|metadata|requestHash|referenceId/,
    );
  });
});
