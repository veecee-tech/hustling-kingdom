<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from './store';
import { ref } from 'vue';
import { defaultAppearance, type Appearance } from '@hk/shared';
import { characterApi } from '../character/api';
import AppearancePicker from '../character/AppearancePicker.vue';
import CharacterPreview from '../character/CharacterPreview.vue';
import SkillsPanel from '../skills/SkillsPanel.vue';
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
  <section aria-labelledby="character-title" class="profile-stage">
    <p class="eyebrow">Me / Your identity</p>
    <section
      v-if="auth.character"
      class="mt-6 space-y-5"
      aria-labelledby="character-title"
    >
      <h1 id="character-title" class="text-2xl font-semibold">
        {{ auth.character.name }}
      </h1>
      <p class="text-slate-300">
        {{ auth.character.residence }} ·
        {{ auth.character.gender.replaceAll('_', ' ').toLowerCase() }}
      </p>
      <CharacterPreview :appearance="appearance" />
      <div class="life-meters">
        <label
          v-for="stat in ['health', 'energy', 'stress'] as const"
          :key="stat"
          >{{ stat }} <strong>{{ auth.character.stats[stat] }}/100</strong
          ><meter
            :value="auth.character.stats[stat]"
            min="0"
            max="100"
            :aria-label="stat"
        /></label>
      </div>
      <p class="life-standing">
        Reputation {{ auth.character.stats.reputation }} · Heat
        {{ auth.character.stats.heat }}
      </p>
      <SkillsPanel />
      <form class="space-y-4" @submit.prevent="saveAppearance">
        <AppearancePicker v-model="appearance" :disabled="saving" />
        <p v-if="message" :role="failed ? 'alert' : 'status'">{{ message }}</p>
        <button class="auth-button" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save appearance' }}
        </button>
      </form>
    </section>
    <section class="account-security" aria-labelledby="account-title">
      <p class="eyebrow">Account & security</p>
      <h2 id="account-title">Your account</h2>
      <p class="muted">
        Signed in as <strong>{{ auth.user?.username }}</strong>
      </p>
      <p class="muted break-all">{{ auth.user?.email }}</p>
      <div class="mt-8 flex flex-wrap gap-4">
        <button
          class="auth-button"
          :disabled="auth.busy"
          @click="signOut(false)"
        >
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
  </section>
</template>
