<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from './store';
const auth = useAuthStore();
const router = useRouter();
async function signOut(all: boolean): Promise<void> {
  await auth.logout(all);
  await router.replace({ name: 'login' });
}
</script>
<template>
  <section aria-labelledby="account-title" class="max-w-lg">
    <h1 id="account-title" class="text-3xl font-bold">Your account</h1>
    <p class="mt-4 text-slate-300">
      Signed in as <strong>{{ auth.user?.username }}</strong>
    </p>
    <p class="mt-2 break-all text-slate-400">{{ auth.user?.email }}</p>
    <p class="mt-6 text-slate-300">
      Your account is ready. Character creation will arrive in a later phase.
    </p>
    <div class="mt-8 flex flex-wrap gap-4">
      <button class="auth-button" :disabled="auth.busy" @click="signOut(false)">
        Sign out
      </button>
      <button
        class="rounded-lg border border-slate-500 px-4 py-2 disabled:opacity-50"
        :disabled="auth.busy"
        @click="signOut(true)"
      >
        Sign out all devices
      </button>
    </div>
  </section>
</template>
