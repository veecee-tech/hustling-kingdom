import {
  appearanceCatalog,
  appearanceCategories,
  type Appearance,
  type CharacterResponse,
} from '@hk/shared';
import type { Character, CharacterStats } from '../generated/prisma/client.js';
import { PublicHttpError } from '../common/error.filter.js';

export function validateAppearance(
  input: unknown,
  partial = false,
): Partial<Appearance> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid();
  const entries = Object.entries(input as Record<string, unknown>);
  if (
    !entries.length ||
    (!partial && entries.length !== appearanceCategories.length)
  )
    invalid();
  for (const [key, value] of entries) {
    if (
      !Object.hasOwn(appearanceCatalog, key) ||
      typeof value !== 'string' ||
      !(
        appearanceCatalog[key as keyof Appearance] as readonly string[]
      ).includes(value)
    )
      invalid();
  }
  return Object.fromEntries(entries) as Partial<Appearance>;
}
function invalid(): never {
  throw new PublicHttpError(
    400,
    'INVALID_APPEARANCE',
    'Select approved appearance options.',
  );
}
export const initialStats = () => ({
  reputation: 0n,
  heat: 0,
  health: 100,
  energy: 100,
  stress: 10,
});

export function characterResponse(
  row: Character & { stats: CharacterStats | null },
): CharacterResponse {
  if (!row.stats) throw new Error('Character stats invariant failed.');
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    gender: row.gender,
    appearance: validateAppearance(row.appearance) as Appearance,
    status: row.status,
    residence: 'Family House',
    stats: {
      reputation: row.stats.reputation.toString(),
      heat: row.stats.heat,
      health: row.stats.health,
      energy: row.stats.energy,
      stress: row.stats.stress,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
