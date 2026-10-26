<script setup lang="ts">
import { onMounted } from 'vue';
import { useSystemStore } from '../stores/system';
const system = useSystemStore();
onMounted(() => {
  void system.check();
});
</script>
<template>
  <details class="system-details">
    <summary>Connection status</summary>
    <p role="status">
      {{
        system.status === 'ready'
          ? 'API and required services are ready.'
          : system.status === 'loading'
            ? 'Checking services…'
            : 'Services are unavailable.'
      }}
    </p>
    <p v-if="system.error" role="alert">{{ system.error }}</p>
    <button @click="system.check" :disabled="system.status === 'loading'">
      Check again
    </button>
  </details>
</template>
