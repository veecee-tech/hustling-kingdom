export * from './skills.js';
export interface JobEligibility {
  isActive: boolean;
  energyCost: number;
  reputationRequired: bigint;
  futureRequirement: string | null;
}
export function jobLockReason(
  job: JobEligibility,
  energy: number,
  reputation: bigint,
  active: boolean,
): string | null {
  if (!job.isActive) return 'JOB_DISABLED';
  if (job.futureRequirement) return 'JOB_REQUIREMENTS_NOT_MET';
  if (reputation < job.reputationRequired) return 'REPUTATION_REQUIRED';
  if (active) return 'JOB_ALREADY_ACTIVE';
  if (energy < job.energyCost) return 'INSUFFICIENT_ENERGY';
  return null;
}
export function calculateJobPay(baseReward: bigint): bigint {
  if (baseReward <= 0n || baseReward > 9223372036854775807n)
    throw new RangeError('Invalid job pay.');
  // Phase 4 has neutral skill/performance multipliers. Phase 5 extends this pure boundary.
  return baseReward;
}
export function energyAfterWork(energy: number, cost: number): number {
  if (
    !Number.isInteger(energy) ||
    !Number.isInteger(cost) ||
    energy < 0 ||
    energy > 100 ||
    cost < 1 ||
    cost > 100 ||
    energy < cost
  )
    throw new RangeError('Insufficient or invalid energy.');
  return energy - cost;
}
export function completionEligibility(
  status: string,
  completesAt: number,
  now: number,
): string | null {
  if (status !== 'ACTIVE') return 'JOB_NOT_ACTIVE';
  return now < completesAt ? 'JOB_NOT_READY' : null;
}
export function developmentJobDuration(
  mode: string,
  override: number | undefined,
  normal: number,
): number {
  if (
    override !== undefined &&
    (mode === 'production' ||
      !Number.isInteger(override) ||
      override < 1 ||
      override > 60)
  )
    throw new RangeError('Invalid development job duration.');
  return override ?? normal;
}
export function requireDevelopmentReset(mode: string): void {
  if (mode !== 'development' && mode !== 'test')
    throw new Error('Energy reset is unavailable in production.');
}
export * from './hustles.js';
