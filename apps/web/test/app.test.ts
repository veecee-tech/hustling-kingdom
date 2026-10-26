import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { expect, it, vi } from 'vitest';
import App from '../src/App.vue';
import HomePage from '../src/pages/HomePage.vue';
import { api } from '../src/api';

it('boots Vue, router and Pinia and displays API readiness', async () => {
  vi.spyOn(api, 'ready').mockResolvedValue({ status: 'ok' });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: HomePage }],
  });
  await router.push('/');
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [createPinia(), router] } });
  await flushPromises();
  expect(wrapper.get('h1').text()).toBe('Hustling Kingdom');
  expect(wrapper.get('[role="status"]').text()).toContain('are ready');
  wrapper.unmount();
  vi.restoreAllMocks();
});
