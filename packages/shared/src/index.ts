import type { CharacterResponse } from './character.js';
export * from './character.js';
export * from './wallet.js';
export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    requestId: string;
  };
}
export interface HealthStatus {
  status: 'ok';
}

export type AccountRole = 'PLAYER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';
export interface AccountUser {
  id: string;
  email: string;
  username: string;
  role: AccountRole;
}
export interface AuthSessionResponse {
  user: AccountUser;
  accessToken: string;
  expiresIn: number;
}
export interface MeResponse {
  user: AccountUser;
  character: CharacterResponse | null;
}
export * from './jobs.js';
export * from './skills.js';
