import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { defaultAppearance } from '@hk/shared';
import WorldView from '../src/components/WorldView.vue';
import AppearancePicker from '../src/features/character/AppearancePicker.vue';
import CharacterAvatar from '../src/components/CharacterAvatar.vue';
import PhonePage from '../src/pages/PhonePage.vue';
import LockedPage from '../src/pages/LockedPage.vue';
import { useAuthStore } from '../src/features/auth/store';

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.restoreAllMocks());
function navigation() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: WorldView },
      { path: '/account', name: 'account', component: WorldView },
      { path: '/phone', name: 'phone', component: PhonePage },
      { path: '/wallet', name: 'wallet', component: PhonePage },
      { path: '/city', name: 'city', component: LockedPage },
      { path: '/hustle', name: 'hustle', component: LockedPage },
    ],
  });
}
it('anchors the actual character in the location, with actions instead of dashboard content', async () => {
  const auth = useAuthStore();
  auth.character = {
    id: 'char',
    name: 'Ada',
    slug: 'opaque',
    gender: 'FEMALE',
    status: 'ACTIVE',
    residence: 'Family House',
    appearance: { ...defaultAppearance, hair: 'afro', top: 'kaftan' },
    stats: { reputation: '8', heat: 2, energy: 70, health: 90, stress: 15 },
    createdAt: '',
    updatedAt: '',
  };
  const router = navigation();
  await router.push('/');
  const wrapper = mount(WorldView, { global: { plugins: [router] } });
  expect(wrapper.get('.world-player').text()).toContain('Ada');
  expect(wrapper.findComponent(CharacterAvatar).props('appearance')).toEqual(
    auth.character.appearance,
  );
  expect(wrapper.get('h1').text()).toBe('Family House');
  expect(wrapper.find('.transaction-list').exists()).toBe(false);
  expect(wrapper.get('button:disabled').text()).toContain('Rest');
  await wrapper.get('a[href="/phone"]').trigger('click');
  await flushPromises();
  expect(router.currentRoute.value.name).toBe('phone');
  wrapper.unmount();
});
it('provides visual, labeled appearance choices while preserving the other selections', async () => {
  const wrapper = mount(AppearancePicker, {
    props: { modelValue: defaultAppearance },
  });
  await wrapper.get('input[aria-label="Hair: afro"]').setValue(true);
  expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual({
    ...defaultAppearance,
    hair: 'afro',
  });
  expect(wrapper.findAll('.option-preview svg').length).toBeGreaterThan(10);
  wrapper.unmount();
});
it('keeps all future phone apps locked and Bank as the only working app', async () => {
  const router = navigation();
  await router.push('/phone');
  const wrapper = mount(PhonePage, { global: { plugins: [router] } });
  expect(wrapper.findAll('.phone-apps button:disabled')).toHaveLength(5);
  expect(wrapper.get('.phone-apps a').attributes('href')).toBe('/wallet');
  await wrapper.get('.phone-apps a').trigger('click');
  await flushPromises();
  expect(router.currentRoute.value.name).toBe('wallet');
  wrapper.unmount();
});
it('shows districts without exposing a travel action', async () => {
  const router = navigation();
  await router.push('/city');
  const wrapper = mount(LockedPage, { global: { plugins: [router] } });
  expect(wrapper.findAll('.districts li')).toHaveLength(5);
  expect(wrapper.text()).toContain('Travel is not available yet.');
  expect(wrapper.findAll('button')).toHaveLength(0);
  expect(wrapper.get('a').attributes('href')).toBe('/');
  wrapper.unmount();
});
