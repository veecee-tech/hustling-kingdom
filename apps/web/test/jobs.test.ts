import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { defaultAppearance, type CharacterResponse } from '@hk/shared';
import { useAuthStore } from '../src/features/auth/store';
import { useWalletStore } from '../src/features/wallet/store';
import { useJobsStore } from '../src/features/jobs/store';
import { api } from '../src/api';
import { ApiError } from '../src/api/client';
const character: CharacterResponse = {
  id: 'char',
  slug: 'opaque',
  name: 'Yuddy',
  gender: 'MALE',
  status: 'ACTIVE',
  residence: 'Family House',
  appearance: { ...defaultAppearance, top: 'kaftan' },
  stats: { reputation: '0', heat: 0, energy: 100, health: 100, stress: 10 },
  createdAt: '',
  updatedAt: '',
};
const wallet = { cash: '15000', bank: '5000', total: '20000', version: '2' };
const fresh = {
  character: {
    ...character,
    appearance: { ...defaultAppearance, top: 'tee' },
    stats: { ...character.stats, energy: 80 },
  },
  wallet: { ...wallet, bank: '21000', total: '36000', version: '4' },
  activeJob: null,
  lastCompletedJob: null,
  hasWorked: true,
  serverNow: new Date().toISOString(),
};
beforeEach(() => {
  setActivePinia(createPinia());
  useAuthStore().character = structuredClone(character);
});
afterEach(() => vi.restoreAllMocks());
it('hydrates authoritative stats and wallet without overwriting cosmetics', async () => {
  vi.spyOn(api, 'request')
    .mockResolvedValueOnce(wallet)
    .mockResolvedValueOnce({ items: [], nextCursor: null })
    .mockResolvedValueOnce({ items: [], serverNow: fresh.serverNow })
    .mockResolvedValueOnce(fresh);
  const money = useWalletStore();
  await money.load(character.id);
  await useJobsStore().load();
  expect(useAuthStore().character?.stats.energy).toBe(80);
  expect(useAuthStore().character?.appearance.top).toBe('kaftan');
  expect(money.wallet?.total).toBe('36000');
});
it('preserves a completion retry key and refreshes current state instead of applying an old receipt', async () => {
  const spy = vi
    .spyOn(api, 'request')
    .mockResolvedValueOnce(wallet)
    .mockResolvedValueOnce({ items: [], nextCursor: null })
    .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Lost response'))
    .mockResolvedValueOnce({ wallet, character })
    .mockResolvedValueOnce({ items: [], serverNow: fresh.serverNow })
    .mockResolvedValueOnce(fresh)
    .mockResolvedValueOnce(fresh.wallet)
    .mockResolvedValueOnce({ items: [], nextCursor: null });
  const money = useWalletStore();
  await money.load(character.id);
  const jobs = useJobsStore();
  expect(await jobs.complete('assignment')).toBe(false);
  expect(jobs.error).toContain('Retry');
  expect(await jobs.complete('assignment')).toBe(true);
  expect(spy.mock.calls[2]?.[1]?.idempotencyKey).toBe(
    spy.mock.calls[3]?.[1]?.idempotencyKey,
  );
  expect(money.wallet?.total).toBe('36000');
  expect(useAuthStore().character?.stats.energy).toBe(80);
});
it('discards a jobs response after identity clears', async () => {
  let finish!: (value: unknown) => void;
  vi.spyOn(api, 'request')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(fresh);
  const jobs = useJobsStore();
  const pending = jobs.load();
  jobs.clear();
  useAuthStore().character = null;
  finish({ items: [{ id: 'private-old-job' }], serverNow: fresh.serverNow });
  await pending;
  expect(jobs.items).toEqual([]);
  expect(jobs.active).toBeNull();
  expect(jobs.loading).toBe(false);
  expect(useAuthStore().character).toBeNull();
});
