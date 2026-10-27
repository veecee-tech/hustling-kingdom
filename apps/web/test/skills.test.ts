import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { defaultAppearance } from '@hk/shared';
import { useSkillsStore } from '../src/features/skills/store';
import { useAuthStore } from '../src/features/auth/store';
import { api } from '../src/api';
beforeEach(() => {
  setActivePinia(createPinia());
  useAuthStore().character = {
    id: 'own',
    slug: 'own',
    name: 'Yuddy',
    gender: 'MALE',
    status: 'ACTIVE',
    residence: 'Family House',
    appearance: defaultAppearance,
    stats: { health: 100, energy: 100, stress: 10, heat: 0, reputation: '0' },
    createdAt: '',
    updatedAt: '',
  };
});
afterEach(() => vi.restoreAllMocks());
it('keeps loading/errors retryable and replaces authoritative progression', async () => {
  const request = vi
    .spyOn(api, 'request')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({
      skills: [{ code: 'SOCIAL', xp: '30', level: 2 }],
    });
  const store = useSkillsStore();
  await store.load();
  expect(store.error).toContain('Try again');
  expect(store.loading).toBe(false);
  await store.load();
  expect(store.skills[0]).toMatchObject({ xp: '30', level: 2 });
  expect(store.error).toBe('');
  expect(request).toHaveBeenCalledTimes(2);
});
it('discards progression after identity clears', async () => {
  let finish!: (value: unknown) => void;
  vi.spyOn(api, 'request').mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const store = useSkillsStore();
  const pending = store.load();
  store.clear();
  useAuthStore().character = null;
  finish({ skills: [{ code: 'SOCIAL', xp: '30' }] });
  await pending;
  expect(store.skills).toEqual([]);
});
