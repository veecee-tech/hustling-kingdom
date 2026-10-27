export const skillCodes = [
  'BUSINESS',
  'TECHNOLOGY',
  'TRADING',
  'SOCIAL',
  'FITNESS',
  'STREET',
] as const;
export type SkillCode = (typeof skillCodes)[number];
export interface SkillRequirement {
  code: SkillCode;
  name: string;
  requiredLevel: number;
  currentLevel: number;
  met: boolean;
}
export interface SkillProgress {
  level: number;
  xp: string;
  currentLevelXp: string;
  nextLevelXp: string | null;
  progress: number;
  capped: boolean;
}
export interface SkillUnlock {
  type: 'JOB';
  id: string;
  name: string;
  requiredLevel: number;
}
export interface SkillSummary extends SkillProgress {
  code: SkillCode;
  name: string;
  description: string;
  maxLevel: number;
  sources: string[];
  nextUnlock: SkillUnlock | null;
}
export interface SkillsResponse {
  skills: SkillSummary[];
}
export interface SkillProgressionResult {
  skill: SkillCode;
  name: string;
  xpAwarded: string;
  previousLevel: number;
  currentLevel: number;
  leveledUp: boolean;
}
