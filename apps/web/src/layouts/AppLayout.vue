<script setup lang="ts">
import { useAuthStore } from '../features/auth/store';
const auth = useAuthStore();
</script>
<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <header class="border-b border-slate-800 px-6 py-5">
      <div class="mx-auto flex max-w-4xl items-center justify-between gap-4">
        <RouterLink to="/" class="font-semibold tracking-wide"
          >Hustling Kingdom</RouterLink
        >
        <nav aria-label="Account" class="flex gap-4 text-sm">
          <RouterLink v-if="auth.authenticated" to="/account" class="underline"
            >Account</RouterLink
          >
          <template v-else-if="auth.status !== 'initializing'"
            ><RouterLink to="/login" class="underline">Sign in</RouterLink
            ><RouterLink to="/register" class="underline"
              >Register</RouterLink
            ></template
          >
        </nav>
      </div>
    </header>
    <main class="mx-auto max-w-4xl px-6 py-12"><slot /></main>
  </div>
</template>
