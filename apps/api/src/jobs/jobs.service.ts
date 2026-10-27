import { createHash } from 'node:crypto';
import { SkillsService } from '../skills/skills.service.js';
import { Inject, Injectable } from '@nestjs/common';
import {
  calculateJobPay,
  completionEligibility,
  developmentJobDuration,
  jobLockReason,
} from '@hk/game-rules';
import type {
  JobAssignmentView,
  JobCompletion,
  JobsCatalog,
  JobsDashboard,
} from '@hk/shared';
import type { Prisma, JobAssignment, Job } from '../generated/prisma/client.js';
import { DatabaseService } from '../database/database.module.js';
import {
  EconomyService,
  type EconomyActor,
} from '../economy/economy.service.js';
import { requireKey } from '../economy/economy.rules.js';
import { CharacterService } from '../characters/character.service.js';
import { CharacterStatsService } from '../characters/character-stats.service.js';
import { AppConfig } from '../config/config.module.js';
import { PublicHttpError } from '../common/error.filter.js';
import { StructuredLogger } from '../common/logging.js';
const assignmentView = (
  row: JobAssignment & { job: Job },
): JobAssignmentView => ({
  id: row.id,
  jobId: row.jobId,
  jobName: row.job.name,
  locationLabel: row.job.locationLabel,
  status: row.status,
  startedAt: row.startedAt.toISOString(),
  completesAt: row.completesAt.toISOString(),
  completedAt: row.completedAt?.toISOString() ?? null,
  pay: row.baseReward.toString(),
  energyCost: row.energyCost,
  rewardAmount: row.rewardAmount?.toString() ?? null,
  skillProgress: null,
  unlocks: [],
});
@Injectable()
export class JobsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(EconomyService) private readonly economy: EconomyService,
    @Inject(CharacterService) private readonly characters: CharacterService,
    @Inject(CharacterStatsService)
    private readonly stats: CharacterStatsService,
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(SkillsService) private readonly skills: SkillsService,
  ) {}
  private readonly logger = new StructuredLogger();
  private duration(job: Job): number {
    return developmentJobDuration(
      this.config.values.nodeEnv,
      this.config.values.jobsDevDurationSeconds,
      job.cooldownSeconds,
    );
  }
  private transaction<T>(
    actor: EconomyActor,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.db.client.$transaction(
      async (tx) => {
        await this.economy.lockActor(tx, actor);
        return work(tx);
      },
      { timeout: 15000, maxWait: 15000 },
    );
  }
  catalog(actor: EconomyActor): Promise<JobsCatalog> {
    return this.transaction(actor, async (tx) => {
      const character = await this.characters.ownInTransaction(
        tx,
        actor.userId,
      );
      const active = await tx.jobAssignment.count({
        where: { characterId: character.id, status: 'ACTIVE' },
      });
      const jobs = await tx.job.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      });
      await this.skills.initializeInTransaction(tx, character.id);
      return {
        serverNow: new Date().toISOString(),
        items: await Promise.all(
          jobs.map(async (job) => {
            const skillRequirement = await this.skills.requirement(
              tx,
              character.id,
              job,
            );
            const xpSkill = job.xpSkillId
              ? await tx.skill.findUniqueOrThrow({
                  where: { id: job.xpSkillId },
                })
              : null;
            const lockCode =
              skillRequirement && !skillRequirement.met
                ? 'JOB_REQUIREMENTS_NOT_MET'
                : jobLockReason(
                    job,
                    character.stats.energy,
                    BigInt(character.stats.reputation),
                    active > 0,
                  );
            const reasons: Record<string, string> = {
              JOB_DISABLED: 'This employer is not hiring.',
              JOB_REQUIREMENTS_NOT_MET:
                job.futureRequirement ??
                (skillRequirement
                  ? `Requires ${skillRequirement.name} Lv. ${skillRequirement.requiredLevel} · Yours Lv. ${skillRequirement.currentLevel}`
                  : 'Progression required.'),
              REPUTATION_REQUIRED: `Requires reputation ${job.reputationRequired}.`,
              JOB_ALREADY_ACTIVE: 'Finish your current shift first.',
              INSUFFICIENT_ENERGY:
                'Not enough energy. Rest recovery is not available in this alpha.',
            };
            return {
              id: job.id,
              code: job.code,
              name: job.name,
              description: job.description,
              locationLabel: job.locationLabel,
              baseReward: job.baseReward.toString(),
              energyCost: job.energyCost,
              durationSeconds: this.duration(job),
              available: !lockCode,
              lockCode,
              lockReason: lockCode ? reasons[lockCode]! : null,
              skillRequirement,
              xpSkill: xpSkill?.name ?? null,
              xpReward: job.xpReward.toString(),
            };
          }),
        ),
      };
    });
  }
  dashboard(actor: EconomyActor): Promise<JobsDashboard> {
    return this.transaction(actor, async (tx) => {
      const character = await this.characters.ownInTransaction(
        tx,
        actor.userId,
      );
      const wallet = await this.economy.getWalletInTransaction(
        tx,
        actor.userId,
      );
      const active = await tx.jobAssignment.findFirst({
        where: { characterId: character.id, status: 'ACTIVE' },
        include: { job: true },
      });
      const last = await tx.jobAssignment.findFirst({
        where: { characterId: character.id, status: 'COMPLETED' },
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        include: { job: true },
      });
      const receipt = last
        ? await tx.idempotencyRecord.findFirst({
            where: {
              userId: actor.userId,
              operation: 'jobs.complete',
              resourceId: last.id,
            },
            orderBy: { createdAt: 'asc' },
          })
        : null;
      const lastView = last ? assignmentView(last) : null;
      if (lastView && receipt) {
        const original = receipt.responseBody as unknown as JobCompletion;
        lastView.skillProgress = original.assignment.skillProgress ?? null;
        lastView.unlocks = original.assignment.unlocks ?? [];
      }
      return {
        character,
        wallet,
        activeJob: active ? assignmentView(active) : null,
        lastCompletedJob: lastView,
        hasWorked: !!last,
        serverNow: new Date().toISOString(),
      };
    });
  }
  async active(
    actor: EconomyActor,
  ): Promise<{ assignment: JobAssignmentView | null; serverNow: string }> {
    const state = await this.dashboard(actor);
    return { assignment: state.activeJob, serverNow: state.serverNow };
  }
  private command<T>(
    actor: EconomyActor,
    operation: string,
    keyValue: string | undefined,
    resource: string,
    work: (
      tx: Prisma.TransactionClient,
      key: string,
    ) => Promise<{ response: T; id: string }>,
  ): Promise<T> {
    const key = requireKey(keyValue);
    const hash = createHash('sha256')
      .update(JSON.stringify([resource]))
      .digest('hex');
    return this.transaction(actor, async (tx) => {
      const previous = await tx.idempotencyRecord.findUnique({
        where: {
          userId_operation_key: { userId: actor.userId, operation, key },
        },
      });
      if (previous) {
        if (previous.requestHash !== hash)
          throw new PublicHttpError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'This key was used for a different work action.',
          );
        return previous.responseBody as unknown as T;
      }
      const { response, id } = await work(tx, key);
      await tx.idempotencyRecord.create({
        data: {
          userId: actor.userId,
          key,
          operation,
          requestHash: hash,
          responseStatus: 200,
          responseBody: response as unknown as Prisma.InputJsonValue,
          resourceType: 'job_assignment',
          resourceId: id,
        },
      });
      return response;
    }).then((result) => {
      this.logger.log(`Work action committed: ${operation}`, 'Jobs');
      return result;
    });
  }
  start(
    actor: EconomyActor,
    jobId: string,
    key: string | undefined,
  ): Promise<JobAssignmentView> {
    return this.command(actor, 'jobs.start', key, jobId, async (tx) => {
      const character = await this.characters.ownInTransaction(
        tx,
        actor.userId,
      );
      const job = await tx.job.findUnique({ where: { id: jobId } });
      if (!job)
        throw new PublicHttpError(
          404,
          'JOB_NOT_FOUND',
          'This job is unavailable.',
        );
      await this.skills.initializeInTransaction(tx, character.id);
      const requirement = await this.skills.requirement(tx, character.id, job);
      if (requirement && !requirement.met)
        throw new PublicHttpError(
          409,
          'JOB_REQUIREMENTS_NOT_MET',
          `Requires ${requirement.name} Lv. ${requirement.requiredLevel}.`,
        );
      const active = await tx.jobAssignment.count({
        where: { characterId: character.id, status: 'ACTIVE' },
      });
      const reason = jobLockReason(
        job,
        character.stats.energy,
        BigInt(character.stats.reputation),
        active > 0,
      );
      if (reason)
        throw new PublicHttpError(
          409,
          reason,
          'This shift cannot be started. Check the job requirements and your energy.',
        );
      const now = new Date();
      const row = await tx.jobAssignment.create({
        data: {
          characterId: character.id,
          jobId,
          startedAt: now,
          completesAt: new Date(now.getTime() + this.duration(job) * 1000),
          baseReward: calculateJobPay(job.baseReward),
          energyCost: job.energyCost,
          xpSkillId: job.xpSkillId,
          xpReward: job.xpReward,
        },
        include: { job: true },
      });
      return { response: assignmentView(row), id: row.id };
    });
  }
  complete(
    actor: EconomyActor,
    assignmentId: string,
    key: string | undefined,
  ): Promise<JobCompletion> {
    return this.command(
      actor,
      'jobs.complete',
      key,
      assignmentId,
      async (tx, validKey) => {
        const character = await this.characters.ownInTransaction(
          tx,
          actor.userId,
        );
        await tx.$queryRaw`SELECT id FROM job_assignments WHERE id = ${assignmentId}::uuid AND character_id = ${character.id}::uuid FOR UPDATE`;
        const row = await tx.jobAssignment.findFirst({
          where: { id: assignmentId, characterId: character.id },
          include: { job: true },
        });
        if (!row)
          throw new PublicHttpError(
            404,
            'JOB_ASSIGNMENT_NOT_FOUND',
            'This shift is unavailable.',
          );
        if (row.status === 'COMPLETED') {
          const previous = await tx.idempotencyRecord.findFirst({
            where: {
              userId: actor.userId,
              operation: 'jobs.complete',
              resourceId: row.id,
            },
          });
          if (!previous) throw new Error('Missing completed work receipt.');
          return {
            response: previous.responseBody as unknown as JobCompletion,
            id: row.id,
          };
        }
        const now = new Date();
        const reason = completionEligibility(
          row.status,
          row.completesAt.getTime(),
          now.getTime(),
        );
        if (reason)
          throw new PublicHttpError(
            409,
            reason,
            reason === 'JOB_NOT_READY'
              ? 'Your shift is still in progress.'
              : 'This shift is not active.',
          );
        await this.stats.consumeEnergyInTransaction(
          tx,
          character.id,
          row.energyCost,
        );
        const pay = calculateJobPay(row.baseReward);
        const payment = await this.economy.creditJobSalaryInTransaction(
          tx,
          actor,
          row.id,
          pay,
          validKey,
        );
        await this.skills.initializeInTransaction(tx, character.id);
        const progression = await this.skills.awardJobInTransaction(
          tx,
          character.id,
          row.id,
        );
        const completed = await tx.jobAssignment.update({
          where: { id: row.id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            rewardAmount: pay,
            transactionId: payment.transactionId,
            xpAwarded: BigInt(progression.skillProgress?.xpAwarded ?? '0'),
            previousLevel: progression.skillProgress?.previousLevel,
            currentLevel: progression.skillProgress?.currentLevel,
          },
          include: { job: true },
        });
        const response: JobCompletion = {
          assignment: { ...assignmentView(completed), ...progression },
          result: {
            salary: pay.toString(),
            energySpent: row.energyCost,
            account: 'BANK',
          },
          character: await this.characters.ownInTransaction(tx, actor.userId),
          wallet: payment.wallet,
        };
        return { response, id: row.id };
      },
    );
  }
}
