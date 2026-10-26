import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { WalletSummary, WalletHistory, WalletAccount } from '@hk/shared';
import { DatabaseService } from '../database/database.module.js';
import type {
  Prisma,
  Wallet,
  WalletTransactionType,
} from '../generated/prisma/client.js';
import { PublicHttpError } from '../common/error.filter.js';
import { requestContext, StructuredLogger } from '../common/logging.js';
import {
  balanceAfter,
  parseAmount,
  requireKey,
  STARTING_FUNDS,
} from './economy.rules.js';

const summary = (wallet: Wallet): WalletSummary => ({
  cash: wallet.cashBalance.toString(),
  bank: wallet.bankBalance.toString(),
  total: (wallet.cashBalance + wallet.bankBalance).toString(),
  version: wallet.version.toString(),
});
export interface EconomyActor {
  userId: string;
  familyId: string;
}
export interface InternalMoneyIntent extends EconomyActor {
  account: WalletAccount;
  amount: bigint;
  idempotencyKey: string;
  reference: { type: string; id: string };
}
@Injectable()
export class EconomyService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  private readonly logger = new StructuredLogger();

  private async lockActor(
    tx: Prisma.TransactionClient,
    actor: EconomyActor,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.userId}::uuid FOR UPDATE`;
    const eligible = await tx.authSession.findFirst({
      where: {
        userId: actor.userId,
        familyId: actor.familyId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: 'ACTIVE' },
      },
    });
    if (!eligible)
      throw new PublicHttpError(
        401,
        'UNAUTHORIZED',
        'Authentication required.',
      );
  }
  private async wallet(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<Wallet> {
    const character = await tx.character.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!character)
      throw new PublicHttpError(
        404,
        'CHARACTER_REQUIRED',
        'Create your character first.',
      );
    await tx.$queryRaw`SELECT id FROM wallets WHERE character_id = ${character.id}::uuid FOR UPDATE`;
    const wallet = await tx.wallet.findUnique({
      where: { characterId: character.id },
    });
    if (!wallet)
      throw new PublicHttpError(
        404,
        'WALLET_REQUIRED',
        'Your game wallet is not ready. Please try again shortly.',
      );
    return wallet;
  }
  async getWallet(userId: string): Promise<WalletSummary> {
    const wallet = await this.db.client.wallet.findFirst({
      where: { character: { userId } },
    });
    if (!wallet) {
      const character = await this.db.client.character.findUnique({
        where: { userId },
        select: { id: true },
      });
      throw new PublicHttpError(
        404,
        character ? 'WALLET_REQUIRED' : 'CHARACTER_REQUIRED',
        'Your game wallet is not ready.',
      );
    }
    return summary(wallet);
  }

  // Participates in the caller's character-creation transaction; caller holds User lock.
  // Also used by the explicit backfill, which acquires that same lock first.
  async initializeInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    characterId: string,
  ): Promise<void> {
    const character = await tx.character.findFirst({
      where: { id: characterId, userId },
    });
    if (!character)
      throw new Error('Character initialization ownership mismatch.');
    if (await tx.wallet.findUnique({ where: { characterId } })) return;
    const wallet = await tx.wallet.create({ data: { characterId } });
    const correlationId = `init_${randomUUID()}`;
    for (const account of ['CASH', 'BANK'] as const)
      await this.append(
        tx,
        wallet.id,
        account,
        STARTING_FUNDS[account],
        'CREDIT',
        account === 'CASH' ? 'STARTING_CASH' : 'STARTING_BANK',
        `starting_${characterId}`,
        correlationId,
      );
  }
  async backfill(): Promise<number> {
    let cursor: string | undefined;
    let initialized = 0;
    for (;;) {
      const characters = await this.db.client.character.findMany({
        orderBy: { id: 'asc' },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, userId: true },
      });
      if (!characters.length) return initialized;
      for (const character of characters)
        await this.db.client.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${character.userId}::uuid FOR UPDATE`;
          if (
            !(await tx.wallet.findUnique({
              where: { characterId: character.id },
            }))
          ) {
            await this.initializeInTransaction(
              tx,
              character.userId,
              character.id,
            );
            initialized++;
          }
        });
      cursor = characters.at(-1)!.id;
    }
  }

  private async append(
    tx: Prisma.TransactionClient,
    walletId: string,
    account: WalletAccount,
    amount: bigint,
    direction: 'CREDIT' | 'DEBIT',
    transactionType: WalletTransactionType,
    key: string,
    correlationId: string,
    reference?: { type: string; id: string },
  ): Promise<void> {
    if (account !== 'CASH' && account !== 'BANK')
      throw new PublicHttpError(
        400,
        'VALIDATION_ERROR',
        'Invalid game account.',
      );
    const wallet = await tx.wallet.findUniqueOrThrow({
      where: { id: walletId },
    });
    const before = account === 'CASH' ? wallet.cashBalance : wallet.bankBalance;
    const after = balanceAfter(before, amount, direction);
    // Database BEFORE INSERT validates the chain and materializes balances. No other module writes them.
    await tx.walletTransaction.create({
      data: {
        walletId,
        characterId: wallet.characterId,
        account,
        amount,
        direction,
        transactionType,
        balanceBefore: before,
        balanceAfter: after,
        idempotencyKey: key,
        correlationId,
        referenceType: reference?.type,
        referenceId: reference?.id,
      },
    });
  }

  private async mutate(
    actor: EconomyActor,
    keyValue: string,
    operation: string,
    payload: string[],
    execute: (
      tx: Prisma.TransactionClient,
      wallet: Wallet,
      key: string,
      correlation: string,
    ) => Promise<void>,
  ): Promise<WalletSummary> {
    const key = requireKey(keyValue);
    const requestHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    const result = await this.db.client.$transaction(
      async (tx) => {
        await this.lockActor(tx, actor);
        const wallet = await this.wallet(tx, actor.userId);
        const previous = await tx.idempotencyRecord.findUnique({
          where: {
            userId_operation_key: { userId: actor.userId, operation, key },
          },
        });
        if (previous) {
          if (previous.requestHash !== requestHash)
            throw new PublicHttpError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'This request key was already used for a different money move.',
            );
          return previous.responseBody as unknown as WalletSummary;
        }
        const correlation =
          requestContext.getStore()?.requestId ?? `econ_${randomUUID()}`;
        await execute(tx, wallet, key, correlation);
        const response = summary(
          await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } }),
        );
        await tx.idempotencyRecord.create({
          data: {
            userId: actor.userId,
            key,
            operation,
            requestHash,
            responseStatus: 200,
            responseBody: response as unknown as Prisma.InputJsonValue,
            resourceType: 'wallet',
            resourceId: wallet.id,
          },
        });
        return response;
      },
      { timeout: 15000 },
    );
    this.logger.log(`Economy operation committed: ${operation}`, 'Economy');
    return result;
  }
  transfer(
    actor: EconomyActor,
    amountInput: unknown,
    direction: 'deposit' | 'withdraw',
    key: string,
  ): Promise<WalletSummary> {
    const amount = parseAmount(amountInput);
    if (!['deposit', 'withdraw'].includes(direction))
      throw new PublicHttpError(
        400,
        'VALIDATION_ERROR',
        'Invalid transfer direction.',
      );
    return this.mutate(
      actor,
      key,
      `wallet.${direction}`,
      [amount.toString()],
      async (tx, wallet, validKey, correlation) => {
        const source = direction === 'deposit' ? 'CASH' : 'BANK';
        const destination = source === 'CASH' ? 'BANK' : 'CASH';
        const type =
          direction === 'deposit' ? 'CASH_DEPOSIT' : 'CASH_WITHDRAWAL';
        await this.append(
          tx,
          wallet.id,
          source,
          amount,
          'DEBIT',
          type,
          validKey,
          correlation,
        );
        await this.append(
          tx,
          wallet.id,
          destination,
          amount,
          'CREDIT',
          type,
          validKey,
          correlation,
        );
      },
    );
  }
  // Trusted server-only entry points: no public credit/debit controller or balance setter.
  credit(intent: InternalMoneyIntent): Promise<WalletSummary> {
    return this.internal(intent, 'CREDIT');
  }
  debit(intent: InternalMoneyIntent): Promise<WalletSummary> {
    return this.internal(intent, 'DEBIT');
  }
  private internal(
    intent: InternalMoneyIntent,
    direction: 'CREDIT' | 'DEBIT',
  ): Promise<WalletSummary> {
    if (
      typeof intent.amount !== 'bigint' ||
      intent.amount <= 0n ||
      !intent.reference?.type ||
      intent.reference.type.length > 64 ||
      !/^[0-9a-f-]{36}$/i.test(intent.reference.id)
    )
      throw new PublicHttpError(
        400,
        'INVALID_AMOUNT',
        'Invalid internal economic intent.',
      );
    return this.mutate(
      intent,
      intent.idempotencyKey,
      `wallet.${direction.toLowerCase()}`,
      [
        intent.account,
        intent.amount.toString(),
        intent.reference.type,
        intent.reference.id,
      ],
      async (tx, wallet, key, correlation) => {
        await this.append(
          tx,
          wallet.id,
          intent.account,
          intent.amount,
          direction,
          direction === 'CREDIT' ? 'SYSTEM_CREDIT' : 'SYSTEM_DEBIT',
          key,
          correlation,
          intent.reference,
        );
      },
    );
  }
  async getTransactions(
    userId: string,
    limit: number,
    cursor?: string,
  ): Promise<WalletHistory> {
    const wallet = await this.db.client.wallet.findFirst({
      where: { character: { userId } },
    });
    if (!wallet) {
      await this.getWallet(userId);
      throw new Error('Wallet missing.');
    }
    let sequence: bigint | undefined;
    if (cursor) {
      if (!/^[0-9a-f-]{36}$/i.test(cursor))
        throw new PublicHttpError(
          400,
          'VALIDATION_ERROR',
          'Invalid history cursor.',
        );
      const row = await this.db.client.walletTransaction.findFirst({
        where: { id: cursor, walletId: wallet.id },
      });
      if (!row)
        throw new PublicHttpError(
          400,
          'VALIDATION_ERROR',
          'Invalid history cursor.',
        );
      sequence = row.sequence;
    }
    const rows = await this.db.client.walletTransaction.findMany({
      where: {
        walletId: wallet.id,
        ...(sequence ? { sequence: { lt: sequence } } : {}),
      },
      orderBy: { sequence: 'desc' },
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map((row) => ({
        id: row.id,
        account: row.account,
        transactionType: row.transactionType,
        direction: row.direction,
        amount: row.amount.toString(),
        balanceAfter: row.balanceAfter.toString(),
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: rows.length > limit ? page.at(-1)!.id : null,
    };
  }
  async reconcile(
    characterId: string,
  ): Promise<{ ok: boolean; cash: string; bank: string }> {
    // Repeatable snapshot prevents false alarms while concurrent writes commit.
    return this.db.client.$transaction(
      async (tx) => {
        const wallet = await tx.wallet.findUniqueOrThrow({
          where: { characterId },
        });
        const sums = await tx.walletTransaction.groupBy({
          by: ['account', 'direction'],
          where: { walletId: wallet.id },
          _sum: { amount: true },
        });
        const totals = { CASH: 0n, BANK: 0n };
        for (const row of sums)
          totals[row.account] +=
            (row.direction === 'CREDIT' ? 1n : -1n) * (row._sum.amount ?? 0n);
        return {
          ok:
            totals.CASH === wallet.cashBalance &&
            totals.BANK === wallet.bankBalance,
          cash: totals.CASH.toString(),
          bank: totals.BANK.toString(),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
