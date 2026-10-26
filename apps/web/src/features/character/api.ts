import type {
  Appearance,
  CharacterResponse,
  CreateCharacterInput,
} from '@hk/shared';
import { api } from '../../api';
export const characterApi = {
  create: (body: CreateCharacterInput, idempotencyKey: string) =>
    api.request<CharacterResponse>('/api/v1/characters', {
      method: 'POST',
      authenticated: true,
      body,
      idempotencyKey,
    }),
  own: () =>
    api.request<CharacterResponse>('/api/v1/characters/me', {
      authenticated: true,
    }),
  appearance: (body: Partial<Appearance>) =>
    api.request<CharacterResponse>('/api/v1/characters/me/appearance', {
      method: 'PATCH',
      authenticated: true,
      body,
    }),
};
