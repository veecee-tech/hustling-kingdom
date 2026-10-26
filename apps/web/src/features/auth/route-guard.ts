import type { Router } from 'vue-router';
import type { useAuthStore } from './store';

export function installAuthGuard(
  router: Router,
  auth: ReturnType<typeof useAuthStore>,
): void {
  router.beforeEach(async (to) => {
    await auth.initialize();
    if (to.meta.requiresAuth && !auth.authenticated) return { name: 'login' };
    if (to.meta.guestOnly && auth.authenticated) return { name: 'account' };
    return true;
  });
}
