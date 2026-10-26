<script setup lang="ts">
import { onMounted } from 'vue';
import { useSystemStore } from '../stores/system';
const system = useSystemStore();
onMounted(() => {
  void system.check();
});
</script>

<template>
  <section aria-labelledby="page-title">
    <p
      class="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-400"
    >
      Engineering foundation
    </p>
    <h1 id="page-title" class="text-3xl font-bold sm:text-4xl">
      Hustling Kingdom
    </h1>
    <p class="mt-4 max-w-xl leading-relaxed text-slate-300">
      The foundation is taking shape. This development shell connects the
      application to its infrastructure.
    </p>
    <div class="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
      <h2 class="text-lg font-semibold">System status</h2>
      <p role="status" aria-live="polite" class="mt-3 text-slate-300">
        {{
          system.status === 'loading'
            ? 'Checking services…'
            : system.status === 'ready'
              ? 'API and required services are ready.'
              : system.status === 'unavailable'
                ? 'Services are unavailable.'
                : 'Status has not been checked.'
        }}
      </p>
      <p v-if="system.error" role="alert" class="mt-2 text-amber-300">
        {{ system.error }}
      </p>
      <p v-if="system.requestId" class="mt-2 break-all text-xs text-slate-400">
        Request: {{ system.requestId }}
      </p>
      <button
        :disabled="system.status === 'loading'"
        class="mt-5 rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300 disabled:opacity-50"
        @click="system.check"
      >
        Check again
      </button>
    </div>
  </section>
</template>
