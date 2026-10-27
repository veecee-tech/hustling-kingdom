import type { CharacterResponse } from './character.js';
import type { WalletSummary } from './wallet.js';
import type {
  SkillRequirement,
  SkillProgressionResult,
  SkillUnlock,
} from './skills.js';
export interface JobView {
  id: string;
  code: string;
  name: string;
  description: string;
  locationLabel: string;
  baseReward: string;
  energyCost: number;
  durationSeconds: number;
  available: boolean;
  lockCode: string | null;
  lockReason: string | null;
  skillRequirement: SkillRequirement | null;
  xpSkill: string | null;
  xpReward: string;
}
export interface JobAssignmentView {
  id: string;
  jobId: string;
  jobName: string;
  locationLabel: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  startedAt: string;
  completesAt: string;
  completedAt: string | null;
  pay: string;
  energyCost: number;
  rewardAmount: string | null;
  skillProgress: SkillProgressionResult | null;
  unlocks: SkillUnlock[];
}
export interface JobsCatalog {
  items: JobView[];
  serverNow: string;
}
export interface JobsDashboard {
  character: CharacterResponse;
  wallet: WalletSummary;
  activeJob: JobAssignmentView | null;
  lastCompletedJob: JobAssignmentView | null;
  hasWorked: boolean;
  serverNow: string;
}
export interface JobCompletion {
  assignment: JobAssignmentView;
  result: { salary: string; energySpent: number; account: 'BANK' };
  character: CharacterResponse;
  wallet: WalletSummary;
}
