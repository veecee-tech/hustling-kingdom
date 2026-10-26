<script setup lang="ts">
import AppLayout from './layouts/AppLayout.vue';
import { useSystemStore } from './stores/system';
const system = useSystemStore();
</script>
<template>
  <AppLayout>
    <p
      v-if="system.applicationError"
      role="alert"
      class="mb-6 rounded border border-amber-400 p-4"
    >
      {{ system.applicationError }}
    </p>
    <RouterView />
  </AppLayout>
</template>
