import type { Router } from 'vue-router';
import type { useAuthStore } from './store';

export function installAuthGuard(
  router: Router,
  auth: ReturnType<typeof useAuthStore>,
): void {
  router.beforeEach(async (to) => {
    await auth.initialize();
    if (to.meta.requiresAuth && !auth.authenticated) return { name: 'login' };
    if (auth.authenticated) {
      if (to.meta.requiresCharacter && !auth.character)
        return { name: 'create-character' };
      if (to.name === 'create-character' && auth.character)
        return { name: 'home' };
      if (to.meta.guestOnly)
        return { name: auth.character ? 'home' : 'create-character' };
    }
    return true;
  });
}
