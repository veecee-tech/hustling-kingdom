import { hustleOutcomes, type HustleOutcome } from '@hk/shared';
export type OutcomeProfile = Record<
  HustleOutcome,
  { weight: number; xp: number }
>;
export function validateOutcomeProfile(value: unknown): OutcomeProfile {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== 5
  )
    throw new RangeError('Invalid outcome profile.');
  const profile = value as Record<string, unknown>;
  let sum = 0;
  for (const outcome of hustleOutcomes) {
    const entry = profile[outcome];
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      Object.keys(entry).sort().join(',') !== 'weight,xp'
    )
      throw new RangeError('Invalid outcome entry.');
    const { weight, xp } = entry as { weight: unknown; xp: unknown };
    if (
      typeof weight !== 'number' ||
      !Number.isInteger(weight) ||
      weight < 0 ||
      weight > 10000 ||
      typeof xp !== 'number' ||
      !Number.isInteger(xp) ||
      xp < 0 ||
      xp > 1350
    )
      throw new RangeError('Invalid outcome tuning.');
    sum += weight;
  }
  if (sum !== 10000) throw new RangeError('Outcome weights must total 10000.');
  return value as OutcomeProfile;
}
export function selectHustleOutcome(
  profile: OutcomeProfile,
  roll: number,
): HustleOutcome {
  validateOutcomeProfile(profile);
  if (!Number.isInteger(roll) || roll < 0 || roll >= 10000)
    throw new RangeError('Invalid outcome roll.');
  let boundary = 0;
  for (const outcome of hustleOutcomes) {
    boundary += profile[outcome].weight;
    if (roll < boundary) return outcome;
  }
  throw new RangeError('Invalid outcome boundary.');
}
export function hustleRewardRange(
  outcome: HustleOutcome,
  minimum: bigint,
  maximum: bigint,
): [bigint, bigint] {
  if (minimum <= 0n || maximum < minimum || maximum > 9223372036854775807n)
    throw new RangeError('Invalid hustle reward range.');
  if (outcome === 'FAILURE' || outcome === 'DISASTER') return [0n, 0n];
  const span = maximum - minimum;
  if (outcome === 'PARTIAL_SUCCESS')
    return [minimum, minimum + (span * 2500n) / 10000n];
  if (outcome === 'SUCCESS')
    return [
      minimum + (span * 2500n) / 10000n,
      minimum + (span * 8000n) / 10000n,
    ];
  if (outcome === 'BIG_WIN')
    return [minimum + (span * 8000n) / 10000n, maximum];
  throw new RangeError('Invalid outcome.');
}
export function hustleLoss(
  outcome: HustleOutcome,
  entryCost: bigint,
  disasterLoss: bigint,
): bigint {
  if (
    entryCost < 0n ||
    disasterLoss < 0n ||
    entryCost + disasterLoss > 9223372036854775807n
  )
    throw new RangeError('Invalid hustle loss.');
  return entryCost + (outcome === 'DISASTER' ? disasterLoss : 0n);
}
export function hustleLockReason(input: {
  enabled: boolean;
  futureRequirement: string | null;
  streetLevel: number;
  requiredLevel: number;
  energy: number;
  energyCost: number;
  bank: bigint;
  bankRequired: bigint;
  cooldownUntil: number;
  now: number;
}): string | null {
  if (!input.enabled) return 'HUSTLE_DISABLED';
  if (input.futureRequirement || input.streetLevel < input.requiredLevel)
    return 'HUSTLE_REQUIREMENTS_NOT_MET';
  if (input.cooldownUntil > input.now) return 'HUSTLE_NOT_READY';
  if (input.energy < input.energyCost) return 'INSUFFICIENT_ENERGY';
  if (input.bank < input.bankRequired) return 'INSUFFICIENT_FUNDS';
  return null;
}
