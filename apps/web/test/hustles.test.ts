import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { defaultAppearance } from '@hk/shared';
import { useAuthStore } from '../src/features/auth/store';
import { useHustlesStore } from '../src/features/hustles/store';
import { useWalletStore } from '../src/features/wallet/store';
import { api } from '../src/api';
import { ApiError } from '../src/api/client';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import HustlesPage from '../src/features/hustles/HustlesPage.vue';
const wallet = { cash: '15000', bank: '45000', total: '60000', version: '3' };
const character = {
  id: 'own',
  slug: 'own',
  name: 'Yuddy',
  gender: 'MALE' as const,
  status: 'ACTIVE' as const,
  residence: 'Family House' as const,
  appearance: defaultAppearance,
  stats: { health: 100, energy: 100, stress: 10, heat: 0, reputation: '0' },
  createdAt: '',
  updatedAt: '',
};
beforeEach(() => {
  setActivePinia(createPinia());
  useAuthStore().character = structuredClone(character);
});
afterEach(() => vi.restoreAllMocks());
it('reuses the intent and key on response loss and refreshes current state rather than an old receipt', async () => {
  let attempts = 0;
  const request = vi
    .spyOn(api, 'request')
    .mockImplementation(async (path, options) => {
      if (options?.method === 'POST') {
        if (++attempts === 1)
          throw new ApiError(0, 'NETWORK_ERROR', 'Lost response');
        return {
          attempt: { id: 'saved', outcome: 'SUCCESS' },
          wallet: { ...wallet, bank: '5000', total: '20000' },
          character,
        };
      }
      if (path === '/api/v1/dashboard')
        return {
          character: {
            ...character,
            stats: { ...character.stats, energy: 85 },
          },
          wallet,
          activeJob: null,
          lastCompletedJob: null,
          hasWorked: false,
          serverNow: new Date().toISOString(),
        };
      if (path === '/api/v1/wallet') return wallet;
      if (path === '/api/v1/skills') return { skills: [] };
      return {
        items: [],
        nextCursor: null,
        serverNow: new Date().toISOString(),
      };
    });
  const store = useHustlesStore();
  expect(await store.attempt('hustle')).toBeNull();
  expect(store.error).toContain('Retry safely');
  expect(await store.attempt('hustle')).toBe('saved');
  const posts = request.mock.calls.filter((c) => c[1]?.method === 'POST');
  expect(posts[0]?.[1]?.idempotencyKey).toBe(posts[1]?.[1]?.idempotencyKey);
  expect(posts[0]?.[1]?.body).toEqual(posts[1]?.[1]?.body);
  expect(Object.keys(posts[0]?.[1]?.body as object)).toEqual(['attemptId']);
  expect(useWalletStore().wallet).toEqual(wallet);
  expect(useAuthStore().character?.stats.energy).toBe(85);
});
it('discards private catalog/history after identity clears', async () => {
  let finish!: (value: unknown) => void;
  vi.spyOn(api, 'request')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce({ items: [], nextCursor: null });
  const store = useHustlesStore();
  const pending = store.load();
  store.clear();
  useAuthStore().character = null;
  finish({
    items: [{ id: 'old-private' }],
    serverNow: new Date().toISOString(),
  });
  await pending;
  expect(store.items).toEqual([]);
  expect(store.history).toEqual([]);
  expect(store.loading).toBe(false);
});
it('ignores an older result request and restores the saved outcome without mutation', async () => {
  let finish!: (value: unknown) => void;
  const request = vi
    .spyOn(api, 'request')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce({ id: 'new', outcome: 'DISASTER' });
  const store = useHustlesStore();
  const first = store.loadAttempt('old');
  await store.loadAttempt('new');
  finish({ id: 'old', outcome: 'SUCCESS' });
  await first;
  expect(store.result).toMatchObject({ id: 'new', outcome: 'DISASTER' });
  expect(request.mock.calls.every((c) => !c[1]?.method)).toBe(true);
});
it.each([
  ['BIG_WIN', 'Big win!', '70000', '0', '70000'],
  ['SUCCESS', 'Cashed out', '40000', '0', '40000'],
  ['PARTIAL_SUCCESS', 'Not bad', '25000', '0', '25000'],
  ['FAILURE', 'Nothing today', '0', '1000', '-1000'],
  ['DISASTER', 'Bad move', '0', '3000', '-3000'],
])(
  'renders the saved %s outcome with money, Energy and Street feedback without a new mutation',
  async (outcome, title, reward, loss, net) => {
    const request = vi.spyOn(api, 'request').mockImplementation(async (path) =>
      path.includes('/attempts/')
        ? {
            id: 'saved',
            hustleId: 'hustle',
            hustleName: 'Underground Deal',
            tier: 1,
            outcome,
            reward,
            loss,
            net,
            energySpent: 15,
            skillProgress: { xpAwarded: '2', leveledUp: false },
            unlocks: [],
          }
        : {
            items: [],
            nextCursor: null,
            serverNow: new Date().toISOString(),
          },
    );
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/hustles/attempts/:attemptId',
          name: 'hustle-result',
          component: HustlesPage,
        },
        { path: '/:pathMatch(.*)*', component: HustlesPage },
      ],
    });
    await router.push('/hustles/attempts/saved');
    await router.isReady();
    const wrapper = mount(HustlesPage, { global: { plugins: [router] } });
    try {
      await flushPromises();
      expect(wrapper.get('h1').text()).toBe(title);
      expect(wrapper.get('.hustle-result').text()).toContain('15 Energy');
      expect(wrapper.get('.hustle-result').text()).toContain('+2 Street XP');
      expect(wrapper.get('.hustle-net').text()).toContain(
        net.startsWith('-') ? '−HK₦' : '+HK₦',
      );
      expect(wrapper.get('a[href="/wallet"]').text()).toBe('See Bank activity');
      expect(request.mock.calls.every((call) => !call[1]?.method)).toBe(true);
    } finally {
      wrapper.unmount();
    }
  },
);
