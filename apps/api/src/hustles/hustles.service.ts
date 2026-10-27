import { createHash } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  validateOutcomeProfile,
  selectHustleOutcome,
  hustleRewardRange,
  hustleLoss,
  hustleLockReason,
} from '@hk/game-rules';
import type {
  HustleOpportunity,
  HustleCatalog,
  HustleAttemptView,
  HustleResult,
  HustleHistory,
  HustleUnlock,
} from '@hk/shared';
import type {
  Prisma,
  Hustle,
  HustleAttempt,
} from '../generated/prisma/client.js';
import { DatabaseService } from '../database/database.module.js';
import {
  EconomyService,
  type EconomyActor,
} from '../economy/economy.service.js';
import { requireKey } from '../economy/economy.rules.js';
import { CharacterService } from '../characters/character.service.js';
import { CharacterStatsService } from '../characters/character-stats.service.js';
import { SkillsService } from '../skills/skills.service.js';
import { AppConfig } from '../config/config.module.js';
import { PublicHttpError } from '../common/error.filter.js';
import { StructuredLogger } from '../common/logging.js';
import { RandomService } from './random.service.js';
const message: Record<string, string> = {
  HUSTLE_DISABLED: 'This opportunity is unavailable.',
  HUSTLE_REQUIREMENTS_NOT_MET:
    'Your Street level does not meet this opportunity.',
  HUSTLE_NOT_READY:
    'Take a breather. Your underground cooldown is still running.',
  INSUFFICIENT_ENERGY:
    'Not enough Energy. Recovery remains unavailable in this alpha.',
  INSUFFICIENT_FUNDS:
    'Your Bank must cover the entry cost and maximum possible loss.',
};
function view(
  row: HustleAttempt,
  unlocks: HustleUnlock[] = [],
): HustleAttemptView {
  return {
    id: row.id,
    hustleId: row.hustleId,
    hustleName: row.hustleName,
    tier: row.tier,
    outcome: row.outcome,
    entryCost: row.entryCost.toString(),
    reward: row.rewardAmount.toString(),
    loss: row.lossAmount.toString(),
    net: (row.rewardAmount - row.lossAmount).toString(),
    energySpent: row.energySpent,
    startedAt: row.startedAt.toISOString(),
    resolvedAt: row.resolvedAt.toISOString(),
    cooldownUntil: row.cooldownUntil.toISOString(),
    skillProgress: {
      skill: 'STREET',
      name: 'Street',
      xpAwarded: row.xpAwarded.toString(),
      previousLevel: row.previousLevel,
      currentLevel: row.currentLevel,
      leveledUp: row.currentLevel > row.previousLevel,
    },
    unlocks,
  };
}
@Injectable()
export class HustlesService implements OnModuleInit {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(EconomyService) private readonly economy: EconomyService,
    @Inject(CharacterService) private readonly characters: CharacterService,
    @Inject(CharacterStatsService)
    private readonly stats: CharacterStatsService,
    @Inject(SkillsService) private readonly skills: SkillsService,
    @Inject(RandomService) private readonly random: RandomService,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}
  private readonly logger = new StructuredLogger();
  async onModuleInit() {
    for (const hustle of await this.db.client.hustle.findMany({
      where: { isActive: true },
    }))
      validateOutcomeProfile(hustle.outcomeProfile);
  }
  private visible() {
    return this.config.values.nodeEnv === 'test' ? {} : { testOnly: false };
  }
  private transaction<T>(
    actor: EconomyActor,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.db.client.$transaction(
      async (tx) => {
        await this.economy.lockActor(tx, actor);
        return work(tx);
      },
      { timeout: 15000, maxWait: 15000 },
    );
  }
  private async state(tx: Prisma.TransactionClient, userId: string) {
    const character = await this.characters.ownInTransaction(tx, userId);
    await this.skills.initializeInTransaction(tx, character.id);
    const street = await tx.skill.findUniqueOrThrow({
      where: { code: 'STREET' },
    });
    const skill = await tx.characterSkill.findUniqueOrThrow({
      where: {
        characterId_skillId: { characterId: character.id, skillId: street.id },
      },
    });
    const wallet = await this.economy.getWalletInTransaction(tx, userId);
    const last = await tx.hustleAttempt.findFirst({
      where: { characterId: character.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return { character, street, skill, wallet, last };
  }
  private gate(
    h: Hustle,
    state: Awaited<ReturnType<HustlesService['state']>>,
    now: number,
  ) {
    return hustleLockReason({
      enabled:
        h.isActive && (!h.testOnly || this.config.values.nodeEnv === 'test'),
      futureRequirement:
        h.futureRequirement ||
        (h.requiredReputation > 0n ||
        h.requiredSkillId !== state.street.id ||
        !state.street.isActive
          ? 'Future requirements unavailable'
          : null),
      streetLevel: state.skill.level,
      requiredLevel: h.requiredSkillLevel,
      energy: state.character.stats.energy,
      energyCost: h.energyCost,
      bank: BigInt(state.wallet.bank),
      bankRequired: h.entryCost + h.disasterLoss,
      cooldownUntil: state.last?.cooldownUntil.getTime() ?? 0,
      now,
    });
  }
  catalog(actor: EconomyActor): Promise<HustleCatalog> {
    return this.transaction(actor, async (tx) => {
      const state = await this.state(tx, actor.userId),
        now = Date.now();
      const rows = await tx.hustle.findMany({
        where: { isActive: true, ...this.visible() },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      });
      return {
        serverNow: new Date(now).toISOString(),
        items: rows.map((h) => {
          const lockCode = this.gate(h, state, now);
          const opportunity: HustleOpportunity = {
            id: h.id,
            code: h.code,
            name: h.name,
            description: h.description,
            locationLabel: h.locationLabel,
            tier: h.tier,
            rewardMin: h.rewardMin.toString(),
            rewardMax: h.rewardMax.toString(),
            entryCost: h.entryCost.toString(),
            maximumLoss: (h.entryCost + h.disasterLoss).toString(),
            bankRequired: (h.entryCost + h.disasterLoss).toString(),
            energyCost: h.energyCost,
            riskLabel: h.riskLabel,
            requiredStreetLevel: h.requiredSkillLevel,
            currentStreetLevel: state.skill.level,
            available: !lockCode,
            lockCode,
            lockReason: lockCode
              ? (h.futureRequirement ?? message[lockCode]!)
              : null,
            cooldownUntil:
              state.last && state.last.cooldownUntil.getTime() > now
                ? state.last.cooldownUntil.toISOString()
                : null,
          };
          return opportunity;
        }),
      };
    });
  }
  private async original(
    tx: Prisma.TransactionClient,
    userId: string,
    row: HustleAttempt,
  ): Promise<HustleResult> {
    const receipt = await tx.idempotencyRecord.findFirst({
      where: { userId, operation: 'hustles.attempt', resourceId: row.id },
      orderBy: { createdAt: 'asc' },
    });
    if (!receipt) throw new Error('Missing hustle receipt.');
    return receipt.responseBody as unknown as HustleResult;
  }
  attempt(
    actor: EconomyActor,
    hustleId: string,
    attemptId: string,
    keyValue: string | undefined,
  ): Promise<HustleResult> {
    const key = requireKey(keyValue),
      operation = 'hustles.attempt';
    const requestHash = createHash('sha256')
      .update(JSON.stringify([hustleId, attemptId]))
      .digest('hex');
    return this.transaction(actor, async (tx) => {
      const prior = await tx.idempotencyRecord.findUnique({
        where: {
          userId_operation_key: { userId: actor.userId, operation, key },
        },
      });
      if (prior) {
        if (prior.requestHash !== requestHash)
          throw new PublicHttpError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'This key was used for another attempt.',
          );
        return prior.responseBody as unknown as HustleResult;
      }
      const character = await this.characters.ownInTransaction(
        tx,
        actor.userId,
      );
      const existing = await tx.hustleAttempt.findUnique({
        where: { id: attemptId },
      });
      let response: HustleResult;
      if (existing) {
        if (existing.characterId !== character.id)
          throw new PublicHttpError(
            404,
            'HUSTLE_ATTEMPT_NOT_FOUND',
            'This attempt is unavailable.',
          );
        if (existing.hustleId !== hustleId)
          throw new PublicHttpError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'This attempt identifies another opportunity.',
          );
        response = await this.original(tx, actor.userId, existing);
      } else {
        const hustle = await tx.hustle.findFirst({
          where: { id: hustleId, ...this.visible() },
        });
        if (!hustle)
          throw new PublicHttpError(
            404,
            'HUSTLE_NOT_FOUND',
            'This opportunity is unavailable.',
          );
        const profile = validateOutcomeProfile(hustle.outcomeProfile);
        const state = await this.state(tx, actor.userId),
          startedAt = new Date();
        const reason = this.gate(hustle, state, startedAt.getTime());
        if (reason) throw new PublicHttpError(409, reason, message[reason]!);
        // All affordability and resource gates precede the first random draw.
        const outcome = selectHustleOutcome(
          profile,
          Number(this.random.below(10000n)),
        );
        const [minimum, maximum] = hustleRewardRange(
          outcome,
          hustle.rewardMin,
          hustle.rewardMax,
        );
        const reward =
          minimum === maximum
            ? minimum
            : minimum + this.random.below(maximum - minimum + 1n);
        const loss = hustleLoss(outcome, hustle.entryCost, hustle.disasterLoss);
        await this.stats.consumeEnergyInTransaction(
          tx,
          character.id,
          hustle.energyCost,
        );
        const progression = await this.skills.awardStreetInTransaction(
          tx,
          character.id,
          BigInt(profile[outcome].xp),
        );
        const resolvedAt = new Date();
        const row = await tx.hustleAttempt.create({
          data: {
            id: attemptId,
            characterId: character.id,
            hustleId,
            hustleName: hustle.name,
            tier: hustle.tier,
            outcome,
            entryCost: hustle.entryCost,
            rewardAmount: reward,
            lossAmount: loss,
            energySpent: hustle.energyCost,
            xpReward: BigInt(profile[outcome].xp),
            xpAwarded: BigInt(progression.xpAwarded),
            previousLevel: progression.previousLevel,
            currentLevel: progression.currentLevel,
            rngVersion: 'crypto-rejection-v1',
            configurationSnapshot: {
              version: 1,
              outcomeProfile: profile,
              rewardMin: hustle.rewardMin.toString(),
              rewardMax: hustle.rewardMax.toString(),
              entryCost: hustle.entryCost.toString(),
              disasterLoss: hustle.disasterLoss.toString(),
              energyCost: hustle.energyCost,
              cooldownSeconds: hustle.cooldownSeconds,
              heatMin: hustle.heatMin,
              heatMax: hustle.heatMax,
              reputationMin: hustle.reputationMin,
              reputationMax: hustle.reputationMax,
            },
            startedAt,
            resolvedAt,
            cooldownUntil: new Date(
              resolvedAt.getTime() + hustle.cooldownSeconds * 1000,
            ),
          },
        });
        const wallet = await this.economy.settleHustleInTransaction(
          tx,
          actor,
          row.id,
          key,
        );
        const unlocks = await tx.hustle.findMany({
          where: {
            isActive: true,
            requiredSkillId: state.street.id,
            requiredSkillLevel: {
              gt: progression.previousLevel,
              lte: progression.currentLevel,
            },
            futureRequirement: null,
            requiredReputation: 0,
            ...this.visible(),
          },
          orderBy: { sortOrder: 'asc' },
        });
        response = {
          attempt: view(
            row,
            unlocks.map((h) => ({
              id: h.id,
              name: h.name,
              requiredLevel: h.requiredSkillLevel,
            })),
          ),
          character: await this.characters.ownInTransaction(tx, actor.userId),
          wallet,
        };
      }
      await tx.idempotencyRecord.create({
        data: {
          userId: actor.userId,
          key,
          operation,
          requestHash,
          responseStatus: 200,
          responseBody: response as unknown as Prisma.InputJsonValue,
          resourceType: 'hustle_attempt',
          resourceId: attemptId,
        },
      });
      return response;
    }).then((result) => {
      this.logger.log('Hustle attempt committed.', 'Hustles');
      return result;
    });
  }
  history(
    actor: EconomyActor,
    limit: number,
    cursor?: string,
  ): Promise<HustleHistory> {
    return this.transaction(actor, async (tx) => {
      const character = await this.characters.ownInTransaction(
        tx,
        actor.userId,
      );
      if (
        cursor &&
        !(await tx.hustleAttempt.findFirst({
          where: { id: cursor, characterId: character.id },
        }))
      )
        throw new PublicHttpError(
          400,
          'VALIDATION_ERROR',
          'Invalid attempt cursor.',
        );
      const rows = await tx.hustleAttempt.findMany({
        where: { characterId: character.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const page = rows.slice(0, limit);
      return {
        items: page.map((row) => view(row)),
        nextCursor: rows.length > limit ? page.at(-1)!.id : null,
        serverNow: new Date().toISOString(),
      };
    });
  }
  ownAttempt(actor: EconomyActor, id: string): Promise<HustleAttemptView> {
    return this.transaction(actor, async (tx) => {
      const row = await tx.hustleAttempt.findFirst({
        where: { id, character: { userId: actor.userId } },
      });
      if (!row)
        throw new PublicHttpError(
          404,
          'HUSTLE_ATTEMPT_NOT_FOUND',
          'This attempt is unavailable.',
        );
      return (await this.original(tx, actor.userId, row)).attempt;
    });
  }
}
