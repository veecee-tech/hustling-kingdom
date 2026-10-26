import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { defaultAppearance } from '@hk/shared';
import { api } from '../src/api';
import { ApiError } from '../src/api/client';
import { useWalletStore } from '../src/features/wallet/store';
import { useAuthStore } from '../src/features/auth/store';
import { formatMoney } from '../src/features/wallet/money';
import TransactionList from '../src/features/wallet/TransactionList.vue';
import PlayerHud from '../src/components/PlayerHud.vue';
import BottomNav from '../src/components/BottomNav.vue';
const wallet = { cash: '15000', bank: '5000', total: '20000', version: '2' };
beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.restoreAllMocks());
describe('game wallet state and presentation', () => {
  it('discards an in-flight wallet response after sign-out', async () => {
    let finish!: (value: typeof wallet) => void;
    vi.spyOn(api, 'request')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    const store = useWalletStore();
    const pending = store.load('old-character');
    store.clear();
    finish(wallet);
    await pending;
    expect(store.wallet).toBeNull();
    expect(store.entries).toEqual([]);
    expect(store.loading).toBe(false);
  });
  it('formats full integer amounts without Number precision loss', () => {
    expect(formatMoney('20000')).toBe('HK₦20,000');
    expect(formatMoney('9007199254740993')).toBe('HK₦9,007,199,254,740,993');
    expect(formatMoney('wrong')).toBe('HK₦—');
  });
  it('preserves a key after response loss, updates server state and clears on account change', async () => {
    const spy = vi
      .spyOn(api, 'request')
      .mockResolvedValueOnce(wallet)
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Lost response'))
      .mockResolvedValueOnce({
        ...wallet,
        cash: '10000',
        bank: '10000',
        version: '4',
      })
      .mockResolvedValueOnce({
        ...wallet,
        cash: '10000',
        bank: '10000',
        version: '4',
      })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    const store = useWalletStore();
    await store.load('character');
    expect(store.wallet).toEqual(wallet);
    expect(await store.move('deposit', '5000')).toBe(false);
    expect(store.error).toContain('Retry');
    expect(await store.move('deposit', '5000')).toBe(true);
    expect(store.wallet?.bank).toBe('10000');
    expect(spy.mock.calls[2]?.[1]?.idempotencyKey).toBe(
      spy.mock.calls[3]?.[1]?.idempotencyKey,
    );
    store.clear();
    expect(store.wallet).toBeNull();
    expect(store.entries).toEqual([]);
  });
  it('maps insufficient funds and supports withdraw through the central API client', async () => {
    const spy = vi
      .spyOn(api, 'request')
      .mockResolvedValueOnce(wallet)
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockRejectedValueOnce(
        new ApiError(409, 'INSUFFICIENT_FUNDS', 'English can change'),
      );
    const store = useWalletStore();
    await store.load('character');
    expect(await store.move('withdraw', '6000')).toBe(false);
    expect(store.error).toBe('There is not enough money in that account.');
    expect(spy.mock.calls[2]?.[0]).toBe('/api/v1/wallet/withdraw');
  });
  it('shows understandable account directions without rendering internal IDs', () => {
    const wrapper = mount(TransactionList, {
      props: {
        entries: [
          {
            id: 'private-row-id',
            account: 'CASH',
            transactionType: 'STARTING_CASH',
            direction: 'CREDIT',
            amount: '15000',
            balanceAfter: '15000',
            createdAt: '2026-10-26T00:00:00Z',
          },
        ],
      },
    });
    expect(wrapper.text()).toContain('Your starting cash');
    expect(wrapper.text()).toContain('+HK₦15,000');
    expect(wrapper.text()).not.toContain('private-row-id');
    wrapper.unmount();
  });
  it('renders server-backed HUD values and contextual navigation', async () => {
    const auth = useAuthStore();
    auth.character = {
      id: 'char',
      name: 'Nneka',
      slug: 'opaque',
      gender: 'FEMALE',
      status: 'ACTIVE',
      residence: 'Family House',
      appearance: defaultAppearance,
      stats: { reputation: '0', heat: 0, energy: 100, health: 100, stress: 10 },
      createdAt: '2026-10-26T00:00:00Z',
      updatedAt: '2026-10-26T00:00:00Z',
    };
    const store = useWalletStore();
    store.wallet = wallet;
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<p>Home</p>' } },
        { path: '/phone', component: { template: '<p>Phone</p>' } },
        { path: '/city', component: { template: '<p>City</p>' } },
        { path: '/hustle', component: { template: '<p>Hustle</p>' } },
        { path: '/wallet', component: { template: '<p>Wallet</p>' } },
        { path: '/account', component: { template: '<p>Me</p>' } },
      ],
    });
    await router.push('/');
    const hud = mount(PlayerHud, { global: { plugins: [router] } });
    expect(hud.text()).toContain('Nneka');
    expect(hud.text()).toContain('HK₦20,000');
    expect(hud.find('[aria-label="Energy 100 out of 100"]').exists()).toBe(
      true,
    );
    const nav = mount(BottomNav, { global: { plugins: [router] } });
    expect(nav.find('a[href="/city"]').text()).toContain('City');
    expect(nav.find('a[href="/hustle"]').text()).toContain('Hustle');
    expect(nav.find('a[href="/phone"]').text()).toContain('Phone');
    hud.unmount();
    nav.unmount();
  });
});
