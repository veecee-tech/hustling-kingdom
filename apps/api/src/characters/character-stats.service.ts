import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { energyAfterWork } from '@hk/game-rules';
import { PublicHttpError } from '../common/error.filter.js';
@Injectable()
export class CharacterStatsService {
  // Caller holds User lock and owns the transaction. No public stat setter exists.
  async consumeEnergyInTransaction(
    tx: Prisma.TransactionClient,
    characterId: string,
    cost: number,
  ): Promise<void> {
    const current = await tx.characterStats.findUniqueOrThrow({
      where: { characterId },
    });
    if (current.energy < cost)
      throw new PublicHttpError(
        409,
        'INSUFFICIENT_ENERGY',
        'You need more energy for this shift.',
      );
    const energy = energyAfterWork(current.energy, cost);
    const result = await tx.characterStats.updateMany({
      where: { characterId, energy: current.energy },
      data: { energy },
    });
    if (result.count !== 1)
      throw new PublicHttpError(
        409,
        'TRANSACTION_CONFLICT',
        'Your energy changed. Please try again.',
      );
  }
}
