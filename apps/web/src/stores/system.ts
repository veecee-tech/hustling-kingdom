import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../api';
import { ApiError } from '../api/client';

export const useSystemStore = defineStore('system', () => {
  const status = ref<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const error = ref('');
  const requestId = ref<string>();
  const applicationError = ref('');
  async function check(): Promise<void> {
    if (status.value === 'loading') return;
    status.value = 'loading';
    error.value = '';
    requestId.value = undefined;
    try {
      await api.ready();
      status.value = 'ready';
    } catch (cause) {
      status.value = 'unavailable';
      error.value =
        cause instanceof ApiError
          ? cause.message
          : 'Unable to check system status.';
      requestId.value = cause instanceof ApiError ? cause.requestId : undefined;
    }
  }
  return { status, error, requestId, applicationError, check };
});
