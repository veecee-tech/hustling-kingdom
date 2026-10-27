// V1 balance configuration. Changes require a reviewed progression migration.
export const progressionConfig = Object.freeze({ maxLevel: 10, xpStep: 30n });
export function xpRequiredForLevel(level: number): bigint {
  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > progressionConfig.maxLevel
  )
    throw new RangeError('Invalid skill level.');
  return (progressionConfig.xpStep * BigInt(level - 1) * BigInt(level)) / 2n;
}
export function levelFromXp(
  xp: bigint,
  maxLevel: number = progressionConfig.maxLevel,
): number {
  if (
    xp < 0n ||
    xp > 9223372036854775807n ||
    !Number.isInteger(maxLevel) ||
    maxLevel < 1 ||
    maxLevel > progressionConfig.maxLevel
  )
    throw new RangeError('Invalid skill XP/cap.');
  let level = 1;
  while (level < maxLevel && xp >= xpRequiredForLevel(level + 1)) level++;
  return level;
}
export function skillProgress(
  xp: bigint,
  maxLevel: number = progressionConfig.maxLevel,
) {
  const level = levelFromXp(xp, maxLevel);
  const capped = level === maxLevel;
  const currentLevelXp = xp - xpRequiredForLevel(level);
  const nextLevelXp = capped
    ? null
    : xpRequiredForLevel(level + 1) - xpRequiredForLevel(level);
  return {
    level,
    xp: xp.toString(),
    currentLevelXp: currentLevelXp.toString(),
    nextLevelXp: nextLevelXp?.toString() ?? null,
    progress: capped ? 1 : Number(currentLevelXp) / Number(nextLevelXp),
    capped,
  };
}
export function awardSkillXp(
  xp: bigint,
  reward: bigint,
  maxLevel: number = progressionConfig.maxLevel,
) {
  const previousLevel = levelFromXp(xp, maxLevel);
  if (reward < 0n || reward > 9223372036854775807n)
    throw new RangeError('Invalid XP reward.');
  const cap = xpRequiredForLevel(maxLevel);
  if (xp > cap) throw new RangeError('XP exceeds cap.');
  const next = xp + reward > cap ? cap : xp + reward;
  return {
    xp: next,
    xpAwarded: next - xp,
    previousLevel,
    currentLevel: levelFromXp(next, maxLevel),
  };
}
export function meetsSkillRequirement(
  current: number,
  required: number,
): boolean {
  xpRequiredForLevel(current);
  xpRequiredForLevel(required);
  return current >= required;
}
