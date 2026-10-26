import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  appearanceCategories,
  type Appearance,
  type CharacterResponse,
} from '@hk/shared';
import { DatabaseService } from '../database/database.module.js';
import { EconomyService } from '../economy/economy.service.js';
import { PublicHttpError } from '../common/error.filter.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { CreateCharacterDto } from './character.dto.js';
import {
  characterResponse,
  initialStats,
  validateAppearance,
} from './character.rules.js';

@Injectable()
export class CharacterService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(EconomyService) private readonly economy: EconomyService,
  ) {}

  async find(userId: string): Promise<CharacterResponse | null> {
    const row = await this.db.client.character.findUnique({
      where: { userId },
      include: { stats: true },
    });
    return row ? characterResponse(row) : null;
  }
  async own(userId: string): Promise<CharacterResponse> {
    const character = await this.find(userId);
    if (!character)
      throw new PublicHttpError(
        404,
        'CHARACTER_REQUIRED',
        'Create your character first.',
      );
    return character;
  }
  // Use the same User lock as authentication. Recheck account/session eligibility after waiting.
  private async lock(
    tx: Prisma.TransactionClient,
    userId: string,
    familyId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
    const session = await tx.authSession.findFirst({
      where: {
        userId,
        familyId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: 'ACTIVE' },
      },
    });
    if (!session)
      throw new PublicHttpError(
        401,
        'UNAUTHORIZED',
        'Authentication required.',
      );
  }
  async create(
    userId: string,
    familyId: string,
    key: string | undefined,
    input: CreateCharacterDto,
  ): Promise<CharacterResponse> {
    if (!key || !/^[A-Za-z0-9_-]{8,128}$/.test(key))
      throw new PublicHttpError(
        400,
        'VALIDATION_ERROR',
        'A valid Idempotency-Key is required.',
      );
    const appearance = validateAppearance(input.appearance) as Appearance;
    const hash = createHash('sha256')
      .update(
        JSON.stringify([
          input.name,
          input.gender,
          ...appearanceCategories.map((category) => appearance[category]),
        ]),
      )
      .digest('hex');
    return this.db.client.$transaction(async (tx) => {
      await this.lock(tx, userId, familyId);
      const existing = await tx.character.findUnique({ where: { userId } });
      if (existing) {
        if (existing.creationKey !== key)
          throw new PublicHttpError(
            409,
            'CHARACTER_ALREADY_EXISTS',
            'Your character already exists.',
          );
        if (existing.creationHash !== hash)
          throw new PublicHttpError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'This key was used with different character details.',
          );
        // Immutable, bounded creation receipt: retries also survive subsequent cosmetic edits.
        return existing.creationResponse as unknown as CharacterResponse;
      }
      const row = await tx.character.create({
        data: {
          userId,
          name: input.name,
          gender: input.gender,
          appearance,
          slug: randomUUID(),
          creationKey: key,
          creationHash: hash,
          stats: { create: initialStats() },
        },
        include: { stats: true },
      });
      const response = characterResponse(row);
      await this.economy.initializeInTransaction(tx, userId, row.id);
      await tx.character.update({
        where: { id: row.id },
        data: {
          creationResponse: response as unknown as Prisma.InputJsonValue,
          // Receipt persistence is not a player-visible change.
          updatedAt: row.updatedAt,
        },
      });
      return response;
    });
  }
  async updateAppearance(
    userId: string,
    familyId: string,
    input: unknown,
  ): Promise<CharacterResponse> {
    const patch = validateAppearance(input, true);
    return this.db.client.$transaction(async (tx) => {
      await this.lock(tx, userId, familyId);
      const row = await tx.character.findUnique({
        where: { userId },
        include: { stats: true },
      });
      if (!row)
        throw new PublicHttpError(
          404,
          'CHARACTER_REQUIRED',
          'Create your character first.',
        );
      const appearance = {
        ...validateAppearance(row.appearance),
        ...patch,
      } as Appearance;
      return characterResponse(
        await tx.character.update({
          where: { id: row.id },
          data: { appearance },
          include: { stats: true },
        }),
      );
    });
  }
}
