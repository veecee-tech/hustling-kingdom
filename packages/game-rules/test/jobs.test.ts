import { describe, expect, it } from 'vitest';
import {
  calculateJobPay,
  completionEligibility,
  developmentJobDuration,
  energyAfterWork,
  jobLockReason,
  requireDevelopmentReset,
} from '../src/index.js';
const job = {
  isActive: true,
  energyCost: 10,
  reputationRequired: 0n,
  futureRequirement: null,
};
describe('legitimate work rules', () => {
  it('keeps neutral pay exact and rejects invalid currency bounds', () => {
    expect(calculateJobPay(8000n)).toBe(8000n);
    expect(calculateJobPay(9007199254740993n)).toBe(9007199254740993n);
    expect(() => calculateJobPay(0n)).toThrow();
    expect(() => calculateJobPay(9223372036854775808n)).toThrow();
  });
  it('allows a starter but protects every eligibility gate', () => {
    expect(jobLockReason(job, 100, 0n, false)).toBeNull();
    expect(jobLockReason({ ...job, isActive: false }, 100, 0n, false)).toBe(
      'JOB_DISABLED',
    );
    expect(
      jobLockReason(
        { ...job, futureRequirement: 'Technology' },
        100,
        0n,
        false,
      ),
    ).toBe('JOB_REQUIREMENTS_NOT_MET');
    expect(
      jobLockReason({ ...job, reputationRequired: 1n }, 100, 0n, false),
    ).toBe('REPUTATION_REQUIRED');
    expect(jobLockReason(job, 100, 0n, true)).toBe('JOB_ALREADY_ACTIVE');
    expect(jobLockReason(job, 9, 0n, false)).toBe('INSUFFICIENT_ENERGY');
  });
  it('never permits negative or invalid energy', () => {
    expect(energyAfterWork(100, 10)).toBe(90);
    expect(energyAfterWork(10, 10)).toBe(0);
    for (const [energy, cost] of [
      [0, 10],
      [9, 10],
      [100, 0],
      [101, 10],
      [10, 1.5],
    ])
      expect(() => energyAfterWork(energy!, cost!)).toThrow();
  });
  it('uses an inclusive server-time boundary and requires ACTIVE state', () => {
    expect(completionEligibility('ACTIVE', 100, 99)).toBe('JOB_NOT_READY');
    expect(completionEligibility('ACTIVE', 100, 100)).toBeNull();
    expect(completionEligibility('COMPLETED', 100, 200)).toBe('JOB_NOT_ACTIVE');
    expect(completionEligibility('CANCELLED', 100, 200)).toBe('JOB_NOT_ACTIVE');
  });
  it('rejects timing overrides and reset helpers in production', () => {
    expect(developmentJobDuration('production', undefined, 30)).toBe(30);
    expect(developmentJobDuration('test', 1, 30)).toBe(1);
    expect(() => developmentJobDuration('production', 1, 30)).toThrow();
    expect(() => developmentJobDuration('test', 0, 30)).toThrow();
    expect(() => requireDevelopmentReset('production')).toThrow();
    expect(() => requireDevelopmentReset('development')).not.toThrow();
  });
});
