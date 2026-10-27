import { describe, it, expect } from 'vitest';
import {
  validateOutcomeProfile,
  selectHustleOutcome,
  hustleRewardRange,
  hustleLoss,
  hustleLockReason,
  awardSkillXp,
} from '../src/index.js';
const profile = {
  BIG_WIN: { weight: 400, xp: 30 },
  SUCCESS: { weight: 3600, xp: 20 },
  PARTIAL_SUCCESS: { weight: 2500, xp: 12 },
  FAILURE: { weight: 2500, xp: 4 },
  DISASTER: { weight: 1000, xp: 2 },
};
describe('abstract server outcome rules', () => {
  it('maps every edge without gaps or overlaps', () => {
    for (const [roll, outcome] of [
      [0, 'BIG_WIN'],
      [399, 'BIG_WIN'],
      [400, 'SUCCESS'],
      [3999, 'SUCCESS'],
      [4000, 'PARTIAL_SUCCESS'],
      [6499, 'PARTIAL_SUCCESS'],
      [6500, 'FAILURE'],
      [8999, 'FAILURE'],
      [9000, 'DISASTER'],
      [9999, 'DISASTER'],
    ] as const)
      expect(selectHustleOutcome(profile, roll)).toBe(outcome);
    for (const roll of [-1, 10000, 0.5])
      expect(() => selectHustleOutcome(profile, roll)).toThrow();
  });
  it('rejects malformed and unbalanced server configuration', () => {
    expect(validateOutcomeProfile(profile)).toEqual(profile);
    for (const p of [
      null,
      [],
      {},
      { ...profile, extra: {} },
      { ...profile, SUCCESS: { weight: 3500, xp: 20 } },
      { ...profile, SUCCESS: { weight: 3600.5, xp: 20 } },
      { ...profile, FAILURE: { weight: 2500, xp: -1 } },
    ])
      expect(() => validateOutcomeProfile(p)).toThrow();
  });
  it('keeps all payout bands integer and within configured minimum/maximum', () => {
    expect(hustleRewardRange('PARTIAL_SUCCESS', 20000n, 80000n)).toEqual([
      20000n,
      35000n,
    ]);
    expect(hustleRewardRange('SUCCESS', 20000n, 80000n)).toEqual([
      35000n,
      68000n,
    ]);
    expect(hustleRewardRange('BIG_WIN', 20000n, 80000n)).toEqual([
      68000n,
      80000n,
    ]);
    expect(hustleRewardRange('FAILURE', 20000n, 80000n)).toEqual([0n, 0n]);
    expect(hustleRewardRange('DISASTER', 20000n, 80000n)).toEqual([0n, 0n]);
    expect(hustleRewardRange('SUCCESS', 1n, 2n)).toEqual([1n, 1n]);
    expect(hustleLoss('SUCCESS', 1000n, 2000n)).toBe(1000n);
    expect(hustleLoss('DISASTER', 1000n, 2000n)).toBe(3000n);
    expect(() => hustleLoss('DISASTER', -1n, 0n)).toThrow();
    expect(() => hustleRewardRange('SUCCESS', 0n, 1n)).toThrow();
  });
  it('gates disabled content, Street, cooldown, Energy and maximum-loss affordability', () => {
    const entry = {
      enabled: true,
      futureRequirement: null,
      streetLevel: 1,
      requiredLevel: 1,
      energy: 100,
      energyCost: 15,
      bank: 5000n,
      bankRequired: 2000n,
      cooldownUntil: 0,
      now: 100,
    };
    expect(hustleLockReason(entry)).toBeNull();
    for (const [change, reason] of [
      [{ enabled: false }, 'HUSTLE_DISABLED'],
      [{ requiredLevel: 2 }, 'HUSTLE_REQUIREMENTS_NOT_MET'],
      [{ futureRequirement: 'Later' }, 'HUSTLE_REQUIREMENTS_NOT_MET'],
      [{ cooldownUntil: 101 }, 'HUSTLE_NOT_READY'],
      [{ energy: 14 }, 'INSUFFICIENT_ENERGY'],
      [{ bank: 1999n }, 'INSUFFICIENT_FUNDS'],
    ] as const)
      expect(hustleLockReason({ ...entry, ...change })).toBe(reason);
  });
  it('awards outcome-specific Street XP through the shared cap/level rule', () => {
    expect(Object.values(profile).map((p) => p.xp)).toEqual([30, 20, 12, 4, 2]);
    expect(awardSkillXp(20n, 20n)).toMatchObject({ currentLevel: 2, xp: 40n });
    expect(awardSkillXp(1350n, 30n)).toMatchObject({
      currentLevel: 10,
      xpAwarded: 0n,
    });
  });
});
