<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  defaultAppearance,
  genderOptions,
  validCharacterName,
  type CreateCharacterInput,
} from '@hk/shared';
import { useAuthStore } from '../auth/store';
import { ApiError } from '../../api/client';
import { characterApi } from './api';
import AppearancePicker from './AppearancePicker.vue';
import CharacterPreview from './CharacterPreview.vue';
const auth = useAuthStore();
const router = useRouter();
const input = reactive<CreateCharacterInput>({
  name: '',
  gender: 'MALE',
  appearance: { ...defaultAppearance },
});
const busy = ref(false);
const error = ref('');
const touched = ref(false);
const valid = computed(() => validCharacterName(input.name));
// Retain the key for the same payload after uncertain network failures; changed intent gets a new key.
let attempt: { payload: string; key: string } | undefined;
async function submit(): Promise<void> {
  touched.value = true;
  if (!valid.value || busy.value) return;
  busy.value = true;
  error.value = '';
  const body = { ...input, name: input.name.trim() };
  const payload = JSON.stringify(body);
  if (!attempt || attempt.payload !== payload)
    attempt = { payload, key: crypto.randomUUID() };
  try {
    auth.character = await characterApi.create(body, attempt.key);
    await router.replace({ name: 'account' });
  } catch (cause) {
    if (
      cause instanceof ApiError &&
      cause.code === 'CHARACTER_ALREADY_EXISTS'
    ) {
      try {
        auth.character = await characterApi.own();
        await router.replace({ name: 'account' });
        return;
      } catch {
        /* Show the retry message below when recovery cannot reach the API. */
      }
    }
    const messages: Record<string, string> = {
      INVALID_APPEARANCE:
        'Please select an available option for each category.',
      VALIDATION_ERROR: 'Please check your name and appearance selections.',
      IDEMPOTENCY_CONFLICT:
        'These details differ from your earlier attempt. Reload to check your character.',
    };
    error.value =
      cause instanceof ApiError
        ? (messages[cause.code] ??
          'Character creation could not be confirmed. Please try again.')
        : 'Character creation could not be confirmed. Please try again.';
    if (!auth.authenticated) await router.replace({ name: 'login' });
  } finally {
    busy.value = false;
  }
}
async function signOut(): Promise<void> {
  await auth.logout();
  await router.replace({ name: 'login' });
}
</script>
<template>
  <section class="mx-auto max-w-xl" aria-labelledby="create-character-title">
    <h1 id="create-character-title" class="text-3xl font-bold">
      Create your character
    </h1>
    <p class="mt-2 text-slate-300">
      Choose your name and style. Your story begins at Family House.
    </p>
    <form class="mt-6 space-y-5" @submit.prevent="submit">
      <fieldset :disabled="busy" class="space-y-4">
        <label class="block"
          >Character name
          <input
            v-model="input.name"
            class="auth-input mt-1 w-full"
            autocomplete="off"
            required
            maxlength="80"
            aria-describedby="name-help"
            @blur="touched = true"
          />
        </label>
        <p
          id="name-help"
          :class="touched && !valid ? 'text-rose-300' : 'text-slate-400'"
          class="text-sm"
        >
          Use 2–40 characters. Spaces and Nigerian names are welcome.
        </p>
        <label class="block"
          >Gender presentation
          <select v-model="input.gender" class="auth-input mt-1 w-full">
            <option
              v-for="gender in genderOptions"
              :key="gender"
              :value="gender"
            >
              {{ gender.replaceAll('_', ' ').toLowerCase() }}
            </option>
          </select>
        </label>
      </fieldset>
      <CharacterPreview :appearance="input.appearance" />
      <AppearancePicker v-model="input.appearance" :disabled="busy" />
      <p v-if="error" role="alert" class="text-rose-300">{{ error }}</p>
      <button class="auth-button w-full" :disabled="busy || !valid">
        {{ busy ? 'Creating…' : 'Create character' }}
      </button>
    </form>
    <button
      class="mt-6 text-slate-300 underline"
      :disabled="auth.busy || busy"
      @click="signOut"
    >
      Sign out
    </button>
  </section>
</template>
