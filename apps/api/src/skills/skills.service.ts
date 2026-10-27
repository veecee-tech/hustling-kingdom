import { Inject, Injectable } from '@nestjs/common';
import {
  awardSkillXp,
  skillProgress,
  meetsSkillRequirement,
} from '@hk/game-rules';
import {
  skillCodes,
  type SkillCode,
  type SkillsResponse,
  type SkillRequirement,
  type SkillProgressionResult,
  type SkillUnlock,
} from '@hk/shared';
import type { Prisma, Job } from '../generated/prisma/client.js';
import { DatabaseService } from '../database/database.module.js';
import {
  EconomyService,
  type EconomyActor,
} from '../economy/economy.service.js';
import { PublicHttpError } from '../common/error.filter.js';
import { AppConfig } from '../config/config.module.js';
function code(value: string): SkillCode {
  if (!skillCodes.includes(value as SkillCode))
    throw new Error('Unknown skill code.');
  return value as SkillCode;
}
@Injectable()
export class SkillsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(EconomyService) private readonly economy: EconomyService,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}
  // Caller holds the shared User lock; composite PK also protects concurrent initialization.
  async initializeInTransaction(
    tx: Prisma.TransactionClient,
    characterId: string,
  ): Promise<number> {
    const skills = await tx.skill.findMany({ where: { isActive: true } });
    if (skills.length !== skillCodes.length)
      throw new Error('Seed the six skill definitions before serving players.');
    const result = await tx.characterSkill.createMany({
      data: skills.map((skill) => ({ characterId, skillId: skill.id })),
      skipDuplicates: true,
    });
    return result.count;
  }
  async requirement(
    tx: Prisma.TransactionClient,
    characterId: string,
    job: Job,
  ): Promise<SkillRequirement | null> {
    if (!job.requiredSkillId || job.requiredSkillLvl === null) return null;
    const skill = await tx.skill.findUniqueOrThrow({
      where: { id: job.requiredSkillId },
    });
    const state = await tx.characterSkill.findUniqueOrThrow({
      where: { characterId_skillId: { characterId, skillId: skill.id } },
    });
    return {
      code: code(skill.code),
      name: skill.name,
      requiredLevel: job.requiredSkillLvl,
      currentLevel: state.level,
      met:
        skill.isActive &&
        meetsSkillRequirement(state.level, job.requiredSkillLvl),
    };
  }
  async awardJobInTransaction(
    tx: Prisma.TransactionClient,
    characterId: string,
    assignmentId: string,
  ): Promise<{
    skillProgress: SkillProgressionResult | null;
    unlocks: SkillUnlock[];
  }> {
    const assignment = await tx.jobAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
    });
    if (
      assignment.characterId !== characterId ||
      assignment.status !== 'ACTIVE'
    )
      throw new Error('Invalid skill award intent.');
    if (!assignment.xpSkillId) return { skillProgress: null, unlocks: [] }; // Legacy Phase 4 shift: preserve original terms.
    const skill = await tx.skill.findUniqueOrThrow({
      where: { id: assignment.xpSkillId },
    });
    const state = await tx.characterSkill.findUniqueOrThrow({
      where: { characterId_skillId: { characterId, skillId: skill.id } },
    });
    const award = awardSkillXp(state.xp, assignment.xpReward, skill.maxLevel);
    await tx.characterSkill.update({
      where: { characterId_skillId: { characterId, skillId: skill.id } },
      data: { xp: award.xp, level: award.currentLevel },
    });
    const jobs = await tx.job.findMany({
      where: {
        isActive: true,
        futureRequirement: null,
        reputationRequired: 0,
        requiredSkillId: skill.id,
        requiredSkillLvl: { gt: award.previousLevel, lte: award.currentLevel },
      },
    });
    return {
      skillProgress: {
        skill: code(skill.code),
        name: skill.name,
        xpAwarded: award.xpAwarded.toString(),
        previousLevel: award.previousLevel,
        currentLevel: award.currentLevel,
        leveledUp: award.currentLevel > award.previousLevel,
      },
      unlocks: jobs.map((job) => ({
        type: 'JOB',
        id: job.id,
        name: job.name,
        requiredLevel: job.requiredSkillLvl!,
      })),
    };
  }
  async own(actor: EconomyActor): Promise<SkillsResponse> {
    return this.db.client.$transaction(
      async (tx) => {
        await this.economy.lockActor(tx, actor);
        const character = await tx.character.findUnique({
          where: { userId: actor.userId },
        });
        if (!character)
          throw new PublicHttpError(
            404,
            'CHARACTER_REQUIRED',
            'Create your character first.',
          );
        await this.initializeInTransaction(tx, character.id);
        const states = await tx.characterSkill.findMany({
          where: { characterId: character.id, skill: { isActive: true } },
          include: { skill: true },
          orderBy: { skill: { code: 'asc' } },
        });
        const jobs = await tx.job.findMany({ where: { isActive: true } });
        const hustles = await tx.hustle.findMany({
          where: {
            isActive: true,
            futureRequirement: null,
            requiredReputation: 0,
            ...(this.config.values.nodeEnv === 'test'
              ? {}
              : { testOnly: false }),
          },
          orderBy: [{ requiredSkillLevel: 'asc' }, { sortOrder: 'asc' }],
        });
        return {
          skills: states.map((state) => {
            const next = jobs
              .filter(
                (job) =>
                  job.requiredSkillId === state.skillId &&
                  job.requiredSkillLvl! > state.level &&
                  !job.futureRequirement &&
                  job.reputationRequired === 0n,
              )
              .sort(
                (a, b) =>
                  a.requiredSkillLvl! - b.requiredSkillLvl! ||
                  a.sortOrder - b.sortOrder,
              )[0];
            const nextHustle =
              state.skill.code === 'STREET'
                ? hustles.find(
                    (h) =>
                      h.requiredSkillId === state.skillId &&
                      h.requiredSkillLevel > state.level,
                  )
                : undefined;
            return {
              code: code(state.skill.code),
              name: state.skill.name,
              description: state.skill.description,
              maxLevel: state.skill.maxLevel,
              ...skillProgress(state.xp, state.skill.maxLevel),
              sources: [
                ...jobs
                  .filter(
                    (job) =>
                      job.xpSkillId === state.skillId &&
                      !job.futureRequirement &&
                      job.reputationRequired === 0n,
                  )
                  .map((job) => job.name),
                ...hustles
                  .filter(
                    (h) =>
                      state.skill.code === 'STREET' &&
                      h.requiredSkillId === state.skillId,
                  )
                  .map((h) => h.name),
              ],
              nextUnlock: nextHustle
                ? {
                    type: 'HUSTLE',
                    id: nextHustle.id,
                    name: nextHustle.name,
                    requiredLevel: nextHustle.requiredSkillLevel,
                  }
                : next
                  ? {
                      type: 'JOB',
                      id: next.id,
                      name: next.name,
                      requiredLevel: next.requiredSkillLvl!,
                    }
                  : null,
            };
          }),
        };
      },
      { timeout: 15000 },
    );
  }
  // Internal gameplay seam. Caller owns the User lock, transaction and durable attempt.
  async awardStreetInTransaction(
    tx: Prisma.TransactionClient,
    characterId: string,
    reward: bigint,
  ): Promise<SkillProgressionResult> {
    const skill = await tx.skill.findUniqueOrThrow({
      where: { code: 'STREET' },
    });
    const state = await tx.characterSkill.findUniqueOrThrow({
      where: { characterId_skillId: { characterId, skillId: skill.id } },
    });
    const award = awardSkillXp(state.xp, reward, skill.maxLevel);
    await tx.characterSkill.update({
      where: { characterId_skillId: { characterId, skillId: skill.id } },
      data: { xp: award.xp, level: award.currentLevel },
    });
    return {
      skill: 'STREET',
      name: skill.name,
      xpAwarded: award.xpAwarded.toString(),
      previousLevel: award.previousLevel,
      currentLevel: award.currentLevel,
      leveledUp: award.currentLevel > award.previousLevel,
    };
  }
  async backfill(characterId?: string) {
    let inspected = 0,
      created = 0,
      cursor: string | undefined;
    for (;;) {
      const batch = await this.db.client.character.findMany({
        ...(characterId ? { where: { id: characterId } } : {}),
        orderBy: { id: 'asc' },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!batch.length) break;
      for (const character of batch) {
        created += await this.db.client.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM users WHERE id=${character.userId}::uuid FOR UPDATE`;
          return this.initializeInTransaction(tx, character.id);
        });
        inspected++;
      }
      cursor = batch.at(-1)!.id;
    }
    return {
      inspected,
      expected: inspected * 6,
      existing: inspected * 6 - created,
      created,
      duplicates: 0,
      errors: 0,
    };
  }
}
