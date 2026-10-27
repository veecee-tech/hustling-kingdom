import type { CharacterResponse } from './character.js';
import type { WalletSummary } from './wallet.js';
import type { SkillProgressionResult } from './skills.js';
export const hustleOutcomes = [
  'BIG_WIN',
  'SUCCESS',
  'PARTIAL_SUCCESS',
  'FAILURE',
  'DISASTER',
] as const;
export type HustleOutcome = (typeof hustleOutcomes)[number];
export interface HustleOpportunity {
  id: string;
  code: string;
  name: string;
  description: string;
  locationLabel: string;
  tier: number;
  rewardMin: string;
  rewardMax: string;
  entryCost: string;
  maximumLoss: string;
  bankRequired: string;
  energyCost: number;
  riskLabel: string;
  requiredStreetLevel: number;
  currentStreetLevel: number;
  available: boolean;
  lockCode: string | null;
  lockReason: string | null;
  cooldownUntil: string | null;
}
export interface HustleUnlock {
  id: string;
  name: string;
  requiredLevel: number;
}
export interface HustleAttemptView {
  id: string;
  hustleId: string;
  hustleName: string;
  tier: number;
  outcome: HustleOutcome;
  entryCost: string;
  reward: string;
  loss: string;
  net: string;
  energySpent: number;
  startedAt: string;
  resolvedAt: string;
  cooldownUntil: string;
  skillProgress: SkillProgressionResult;
  unlocks: HustleUnlock[];
}
export interface HustleCatalog {
  items: HustleOpportunity[];
  serverNow: string;
}
export interface HustleHistory {
  items: HustleAttemptView[];
  nextCursor: string | null;
  serverNow: string;
}
export interface HustleResult {
  attempt: HustleAttemptView;
  character: CharacterResponse;
  wallet: WalletSummary;
}
