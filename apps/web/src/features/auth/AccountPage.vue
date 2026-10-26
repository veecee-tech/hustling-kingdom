<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from './store';
import { ref } from 'vue';
import { defaultAppearance, type Appearance } from '@hk/shared';
import { characterApi } from '../character/api';
import AppearancePicker from '../character/AppearancePicker.vue';
import CharacterPreview from '../character/CharacterPreview.vue';
const auth = useAuthStore();
const router = useRouter();
const appearance = ref<Appearance>({
  ...(auth.character?.appearance ?? defaultAppearance),
});
const saving = ref(false);
const message = ref('');
const failed = ref(false);
async function saveAppearance(): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  message.value = '';
  failed.value = false;
  try {
    // Send only changed categories so edits from another tab to other categories survive.
    const patch = Object.fromEntries(
      Object.entries(appearance.value).filter(
        ([key, value]) =>
          value !== auth.character?.appearance[key as keyof Appearance],
      ),
    );
    if (Object.keys(patch).length)
      auth.character = await characterApi.appearance(patch);
    appearance.value = { ...(auth.character?.appearance ?? defaultAppearance) };
    message.value = 'Appearance saved.';
  } catch {
    failed.value = true;
    message.value = 'Appearance could not be saved. Please try again.';
    if (!auth.authenticated) await router.replace({ name: 'login' });
  } finally {
    saving.value = false;
  }
}
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
    <section
      v-if="auth.character"
      class="mt-6 space-y-5"
      aria-labelledby="character-title"
    >
      <h2 id="character-title" class="text-2xl font-semibold">
        {{ auth.character.name }}
      </h2>
      <p class="text-slate-300">
        {{ auth.character.residence }} ·
        {{ auth.character.gender.replaceAll('_', ' ').toLowerCase() }}
      </p>
      <dl class="grid grid-cols-2 gap-3 rounded-xl bg-slate-900 p-4">
        <div v-for="(value, stat) in auth.character.stats" :key="stat">
          <dt class="capitalize text-slate-400">{{ stat }}</dt>
          <dd class="text-xl font-semibold">{{ value }}</dd>
        </div>
      </dl>
      <CharacterPreview :appearance="appearance" />
      <form class="space-y-4" @submit.prevent="saveAppearance">
        <AppearancePicker v-model="appearance" :disabled="saving" />
        <p v-if="message" :role="failed ? 'alert' : 'status'">{{ message }}</p>
        <button class="auth-button" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save appearance' }}
        </button>
      </form>
    </section>
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
