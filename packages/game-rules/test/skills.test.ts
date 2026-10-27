import { describe, it, expect } from 'vitest';
import {
  xpRequiredForLevel,
  levelFromXp,
  skillProgress,
  awardSkillXp,
  meetsSkillRequirement,
} from '../src/index.js';
describe('authoritative skill progression', () => {
  it('starts at level one and handles exact boundaries', () => {
    expect(levelFromXp(0n)).toBe(1);
    expect(xpRequiredForLevel(2)).toBe(30n);
    expect(levelFromXp(29n)).toBe(1);
    expect(levelFromXp(30n)).toBe(2);
    expect(levelFromXp(31n)).toBe(2);
    expect(levelFromXp(90n)).toBe(3);
  });
  it('crosses multiple levels and stops XP at cap', () => {
    expect(awardSkillXp(0n, 200n)).toMatchObject({
      previousLevel: 1,
      currentLevel: 4,
      xp: 200n,
    });
    expect(awardSkillXp(1340n, 40n)).toMatchObject({
      xp: 1350n,
      xpAwarded: 10n,
      currentLevel: 10,
    });
    expect(awardSkillXp(1350n, 40n).xpAwarded).toBe(0n);
  });
  it('computes progress without floating XP', () => {
    expect(skillProgress(45n)).toMatchObject({
      level: 2,
      currentLevelXp: '15',
      nextLevelXp: '60',
      progress: 0.25,
    });
    expect(skillProgress(1350n)).toMatchObject({
      level: 10,
      capped: true,
      nextLevelXp: null,
      progress: 1,
    });
  });
  it('rejects invalid values and evaluates requirements', () => {
    for (const n of [-1, 0, 1.5, 11])
      expect(() => xpRequiredForLevel(n)).toThrow();
    expect(() => levelFromXp(-1n)).toThrow();
    expect(() => awardSkillXp(0n, -1n)).toThrow();
    expect(meetsSkillRequirement(2, 2)).toBe(true);
    expect(meetsSkillRequirement(1, 2)).toBe(false);
  });
});
