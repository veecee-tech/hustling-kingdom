import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { defineComponent } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { defaultAppearance, type CharacterResponse } from '@hk/shared';
import { useAuthStore } from '../src/features/auth/store';
import { installAuthGuard } from '../src/features/auth/route-guard';
import { api } from '../src/api';
import { characterApi } from '../src/features/character/api';
import CreateCharacterPage from '../src/features/character/CreateCharacterPage.vue';
import { ApiError } from '../src/api/client';
const user = {
  id: 'fixture',
  username: 'fixture',
  email: 'fixture@example.test',
  role: 'PLAYER' as const,
};
const character: CharacterResponse = {
  id: 'character',
  slug: 'opaque',
  name: 'Adé',
  gender: 'MALE',
  status: 'ACTIVE',
  residence: 'Family House',
  appearance: defaultAppearance,
  stats: { reputation: '0', heat: 0, health: 100, energy: 100, stress: 10 },
  createdAt: '2026-10-26T00:00:00Z',
  updatedAt: '2026-10-26T00:00:00Z',
};
function router() {
  const Page = defineComponent({ template: '<p>Page</p>' });
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Page },
      {
        path: '/login',
        name: 'login',
        component: Page,
        meta: { guestOnly: true },
      },
      {
        path: '/register',
        name: 'register',
        component: Page,
        meta: { guestOnly: true },
      },
      {
        path: '/create-character',
        name: 'create-character',
        component: CreateCharacterPage,
        meta: { requiresAuth: true },
      },
      {
        path: '/account',
        name: 'account',
        component: Page,
        meta: { requiresAuth: true, requiresCharacter: true },
      },
    ],
  });
}
beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.restoreAllMocks());
describe('three-state character navigation', () => {
  it.each([null, character])(
    'hydrates the single current-character state and routes without loops %#',
    async (current) => {
      vi.spyOn(api, 'request')
        .mockResolvedValueOnce({ user, accessToken: 'fixture', expiresIn: 600 })
        .mockResolvedValueOnce({ user, character: current });
      const auth = useAuthStore();
      const navigation = router();
      installAuthGuard(navigation, auth);
      await navigation.push('/account');
      expect(auth.character).toEqual(current);
      expect(navigation.currentRoute.value.name).toBe(
        current ? 'account' : 'create-character',
      );
      await navigation.push('/register');
      expect(navigation.currentRoute.value.name).toBe(
        current ? 'home' : 'create-character',
      );
      if (current) {
        await navigation.push('/create-character');
        expect(navigation.currentRoute.value.name).toBe('home');
      }
    },
  );
  it('preserves the creation key after network failure, disables duplicates and updates state without reload', async () => {
    const auth = useAuthStore();
    auth.status = 'authenticated';
    auth.user = user;
    const navigation = router();
    await navigation.push('/create-character');
    const create = vi
      .spyOn(characterApi, 'create')
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Unavailable'))
      .mockResolvedValueOnce(character);
    const wrapper = mount(CreateCharacterPage, {
      global: { plugins: [navigation] },
    });
    expect(
      wrapper.get('button.auth-button').attributes('disabled'),
    ).toBeDefined();
    await wrapper.get('input').setValue('Adé');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('try again');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[1]).toBe(create.mock.calls[1]?.[1]);
    expect(auth.character).toEqual(character);
    expect(navigation.currentRoute.value.name).toBe('home');
    wrapper.unmount();
  });
});
