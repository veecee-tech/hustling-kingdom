import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  JobView,
  JobAssignmentView,
  JobCompletion,
  JobsCatalog,
  JobsDashboard,
} from '@hk/shared';
import { api } from '../../api';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../auth/store';
import { useWalletStore } from '../wallet/store';
export const useJobsStore = defineStore('jobs', () => {
  const auth = useAuthStore();
  const money = useWalletStore();
  const items = ref<JobView[]>([]);
  const active = ref<JobAssignmentView | null>(null);
  const lastCompleted = ref<JobAssignmentView | null>(null);
  const hasWorked = ref(false);
  const loading = ref(false);
  const busy = ref(false);
  const error = ref('');
  const serverTime = ref(0);
  const observedAt = ref(0);
  let owner: string | null = null;
  let epoch = 0;
  let read = 0;
  let attempt: { intent: string; key: string } | undefined;
  function clear(): void {
    epoch++;
    read++;
    owner = null;
    items.value = [];
    active.value = null;
    lastCompleted.value = null;
    hasWorked.value = false;
    loading.value = false;
    busy.value = false;
    error.value = '';
    attempt = undefined;
  }
  async function load(): Promise<void> {
    const id = auth.character?.id;
    if (!id) {
      clear();
      return;
    }
    if (owner !== id) {
      clear();
      owner = id;
    }
    const version = epoch;
    const generation = ++read;
    loading.value = true;
    try {
      const [catalog, dashboard] = await Promise.all([
        api.request<JobsCatalog>('/api/v1/jobs', { authenticated: true }),
        api.request<JobsDashboard>('/api/v1/dashboard', {
          authenticated: true,
        }),
      ]);
      if (version !== epoch || generation !== read || auth.character?.id !== id)
        return;
      items.value = catalog.items;
      active.value = dashboard.activeJob;
      lastCompleted.value = dashboard.lastCompletedJob;
      hasWorked.value = dashboard.hasWorked;
      serverTime.value = Date.parse(dashboard.serverNow);
      observedAt.value = performance.now();
      auth.character.stats = dashboard.character.stats;
      money.applyServerSnapshot(id, dashboard.wallet);
      error.value = '';
    } catch {
      if (version === epoch && generation === read)
        error.value = 'Work could not be refreshed. Please try again.';
    } finally {
      if (version === epoch && generation === read) loading.value = false;
    }
  }
  async function command(
    kind: 'start' | 'complete',
    id: string,
  ): Promise<boolean> {
    if (busy.value || !auth.character) return false;
    const characterId = auth.character.id;
    if (owner !== characterId) {
      clear();
      owner = characterId;
    }
    const version = epoch;
    busy.value = true;
    error.value = '';
    const intent = `${kind}:${id}`;
    if (!attempt || attempt.intent !== intent)
      attempt = { intent, key: crypto.randomUUID() };
    try {
      await api.request<JobAssignmentView | JobCompletion>(
        kind === 'start'
          ? `/api/v1/jobs/${id}/start`
          : `/api/v1/jobs/assignments/${id}/complete`,
        {
          method: 'POST',
          body: {},
          authenticated: true,
          idempotencyKey: attempt.key,
        },
      );
      if (version !== epoch || auth.character?.id !== characterId) return false;
      attempt = undefined;
      // Original retry receipts may be old. Hydrate current state instead of applying historical stats/balances.
      await load();
      await money.load(characterId, true);
      return true;
    } catch (cause) {
      if (version !== epoch) return false;
      const messages: Record<string, string> = {
        JOB_NOT_READY: 'Still working. Wait until the shift is ready.',
        JOB_ALREADY_ACTIVE: 'You already have a shift. Resume it below.',
        INSUFFICIENT_ENERGY:
          'Not enough energy for this shift. Rest recovery is not available in this alpha.',
        JOB_REQUIREMENTS_NOT_MET:
          'This job needs progression that is not available yet.',
        JOB_DISABLED: 'This employer is not hiring.',
        IDEMPOTENCY_CONFLICT:
          'This request differs from an earlier attempt. Refresh work before retrying.',
        RATE_LIMITED: 'Take a moment before your next work action.',
        JOB_ASSIGNMENT_NOT_FOUND: 'This shift is unavailable.',
      };
      const message =
        cause instanceof ApiError
          ? (messages[cause.code] ??
            'Work could not be confirmed. Retry the same action safely.')
          : 'Work could not be confirmed. Retry the same action safely.';
      if (
        cause instanceof ApiError &&
        cause.status >= 400 &&
        cause.status < 500
      )
        await load();
      error.value = message;
      return false;
    } finally {
      if (version === epoch) busy.value = false;
    }
  }
  return {
    items,
    active,
    lastCompleted,
    hasWorked,
    loading,
    busy,
    error,
    serverTime,
    observedAt,
    clear,
    load,
    start: (id: string) => command('start', id),
    complete: (id: string) => command('complete', id),
  };
});
