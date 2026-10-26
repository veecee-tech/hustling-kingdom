<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from './store';
import KingdomScene from '../../components/KingdomScene.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const registration = computed(() => route.name === 'register');
const email = ref('');
const username = ref('');
const identity = ref('');
const password = ref('');
const errorBox = ref<HTMLElement>();
async function submit(): Promise<void> {
  try {
    await auth.signIn(
      registration.value ? 'register' : 'login',
      registration.value
        ? {
            email: email.value,
            username: username.value,
            password: password.value,
          }
        : { emailOrUsername: identity.value, password: password.value },
    );
    password.value = '';
    await router.replace({
      name: auth.character ? 'home' : 'create-character',
    });
  } catch {
    password.value = '';
    await nextTick();
    errorBox.value?.focus();
  }
}
</script>

<template>
  <div class="auth-stage">
    <aside class="auth-story">
      <KingdomScene />
      <div class="scene-shade" />
      <div>
        <p class="eyebrow">HUSTLE. FLEX. BUILD. SURVIVE.</p>
        <h2>Welcome to<br />Old Town.</h2>
        <p>Your story starts at Family House.</p>
      </div>
    </aside>
    <section class="auth-form-panel" aria-labelledby="auth-title">
      <p class="eyebrow">
        {{ registration ? 'Chapter 01 / Your account' : 'Back to your story' }}
      </p>
      <h1 id="auth-title" class="text-3xl font-bold">
        {{ registration ? 'Create your account' : 'Welcome back' }}
      </h1>
      <p class="mt-3 text-slate-300">
        {{
          registration
            ? 'Choose a username and a secure passphrase.'
            : 'Sign in with your email or username.'
        }}
      </p>
      <p
        v-if="auth.error"
        ref="errorBox"
        role="alert"
        tabindex="-1"
        class="mt-5 rounded-lg border border-amber-400 p-3 text-amber-200"
      >
        {{ auth.error }}
      </p>
      <form
        class="mt-7 space-y-5"
        :aria-busy="auth.busy"
        @submit.prevent="submit"
      >
        <template v-if="registration">
          <div>
            <label for="email" class="mb-2 block">Email</label
            ><input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              maxlength="254"
              required
              class="auth-input"
              :disabled="auth.busy"
            />
          </div>
          <div>
            <label for="username" class="mb-2 block">Username</label
            ><input
              id="username"
              v-model="username"
              autocomplete="username"
              minlength="3"
              maxlength="24"
              pattern="[A-Za-z0-9_]{3,24}"
              required
              aria-describedby="username-help"
              class="auth-input"
              :disabled="auth.busy"
            />
            <p id="username-help" class="mt-2 text-sm text-slate-400">
              3–24 letters, numbers or underscores. Case does not matter.
            </p>
          </div>
        </template>
        <div v-else>
          <label for="identity" class="mb-2 block">Email or username</label
          ><input
            id="identity"
            v-model="identity"
            autocomplete="username"
            maxlength="254"
            required
            class="auth-input"
            :disabled="auth.busy"
          />
        </div>
        <div>
          <label for="password" class="mb-2 block">Password</label
          ><input
            id="password"
            v-model="password"
            type="password"
            :autocomplete="registration ? 'new-password' : 'current-password'"
            :minlength="registration ? 12 : 1"
            maxlength="128"
            required
            aria-describedby="password-help"
            class="auth-input"
            :disabled="auth.busy"
          />
          <p id="password-help" class="mt-2 text-sm text-slate-400">
            {{
              registration
                ? 'Use 12–128 characters. Spaces and passphrases are welcome.'
                : 'Your password is case-sensitive.'
            }}
          </p>
        </div>
        <button type="submit" :disabled="auth.busy" class="auth-button w-full">
          {{
            auth.busy
              ? 'Please wait…'
              : registration
                ? 'Create account'
                : 'Sign in'
          }}
        </button>
      </form>
      <p class="mt-6 text-slate-300">
        <RouterLink
          :to="registration ? '/login' : '/register'"
          class="underline underline-offset-4"
          >{{
            registration
              ? 'Already registered? Sign in'
              : 'New here? Create an account'
          }}</RouterLink
        >
      </p>
    </section>
  </div>
</template>
