import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  HustleOpportunity,
  HustleAttemptView,
  HustleCatalog,
  HustleHistory,
  HustleResult,
} from '@hk/shared';
import { api } from '../../api';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../auth/store';
import { useJobsStore } from '../jobs/store';
import { useWalletStore } from '../wallet/store';
import { useSkillsStore } from '../skills/store';
export const useHustlesStore = defineStore('hustles', () => {
  const auth = useAuthStore();
  const items = ref<HustleOpportunity[]>([]),
    history = ref<HustleAttemptView[]>([]),
    result = ref<HustleAttemptView | null>(null);
  const loading = ref(false),
    busy = ref(false),
    error = ref(''),
    nextCursor = ref<string | null>(null),
    serverTime = ref(0),
    observedAt = ref(0);
  let epoch = 0,
    read = 0,
    attemptRead = 0,
    owner: string | null = null,
    intent: { hustleId: string; attemptId: string; key: string } | undefined;
  function clear() {
    epoch++;
    read++;
    attemptRead++;
    owner = null;
    intent = undefined;
    items.value = [];
    history.value = [];
    result.value = null;
    loading.value = false;
    busy.value = false;
    error.value = '';
    nextCursor.value = null;
  }
  function identity() {
    const id = auth.character?.id;
    if (!id) {
      clear();
      return null;
    }
    if (owner !== id) {
      clear();
      owner = id;
    }
    return id;
  }
  async function load() {
    const id = identity();
    if (!id) return;
    const version = epoch,
      generation = ++read;
    loading.value = true;
    try {
      const [catalog, attempts] = await Promise.all([
        api.request<HustleCatalog>('/api/v1/hustles', { authenticated: true }),
        api.request<HustleHistory>('/api/v1/hustles/history', {
          authenticated: true,
        }),
      ]);
      if (version !== epoch || generation !== read || auth.character?.id !== id)
        return;
      items.value = catalog.items;
      history.value = attempts.items;
      nextCursor.value = attempts.nextCursor;
      serverTime.value = Date.parse(catalog.serverNow);
      observedAt.value = performance.now();
      error.value = '';
    } catch {
      if (version === epoch && generation === read)
        error.value = 'Opportunities could not be refreshed. Try again.';
    } finally {
      if (version === epoch && generation === read) loading.value = false;
    }
  }
  async function loadAttempt(id: string) {
    const ownerId = identity();
    if (!ownerId) return;
    const version = epoch,
      generation = ++attemptRead;
    result.value = null;
    error.value = '';
    try {
      const response = await api.request<HustleAttemptView>(
        `/api/v1/hustles/attempts/${id}`,
        { authenticated: true },
      );
      if (
        version === epoch &&
        generation === attemptRead &&
        auth.character?.id === ownerId
      )
        result.value = response;
    } catch {
      if (version === epoch && generation === attemptRead)
        error.value = 'This attempt could not be loaded. Refresh to try again.';
    }
  }
  async function more() {
    if (!nextCursor.value || loading.value) return;
    const version = epoch,
      generation = ++read,
      cursor = nextCursor.value;
    loading.value = true;
    try {
      const response = await api.request<HustleHistory>(
        `/api/v1/hustles/history?cursor=${encodeURIComponent(cursor)}`,
        { authenticated: true },
      );
      if (version !== epoch || generation !== read) return;
      history.value = [...history.value, ...response.items];
      nextCursor.value = response.nextCursor;
    } catch {
      if (version === epoch && generation === read)
        error.value = 'More attempts could not be loaded. Try again.';
    } finally {
      if (version === epoch && generation === read) loading.value = false;
    }
  }
  async function attempt(hustleId: string): Promise<string | null> {
    const id = identity();
    if (!id || busy.value) return null;
    const version = epoch;
    busy.value = true;
    error.value = '';
    if (!intent || intent.hustleId !== hustleId)
      intent = {
        hustleId,
        attemptId: crypto.randomUUID(),
        key: crypto.randomUUID(),
      };
    const pending = { ...intent };
    try {
      const response = await api.request<HustleResult>(
        `/api/v1/hustles/${hustleId}/attempt`,
        {
          method: 'POST',
          authenticated: true,
          idempotencyKey: pending.key,
          body: { attemptId: pending.attemptId },
        },
      );
      if (version !== epoch || auth.character?.id !== id) return null;
      // Receipts can be historical. Refresh current authoritative state instead of applying old balances/XP.
      intent = undefined;
      result.value = response.attempt;
      await Promise.all([
        load(),
        useJobsStore().load(),
        useWalletStore().load(id, true),
        useSkillsStore().load(),
      ]);
      return version === epoch ? response.attempt.id : null;
    } catch (cause) {
      if (version !== epoch) return null;
      const labels: Record<string, string> = {
        HUSTLE_NOT_READY: 'Take a breather. Your cooldown is still running.',
        HUSTLE_REQUIREMENTS_NOT_MET:
          'This opportunity needs a higher Street level.',
        INSUFFICIENT_FUNDS:
          'Bank must cover the maximum possible loss. Move Cash to Bank or choose a smaller risk.',
        INSUFFICIENT_ENERGY:
          'Not enough Energy. Recovery is not available in this alpha.',
        HUSTLE_DISABLED: 'This opportunity is unavailable.',
        RATE_LIMITED: 'Take a moment before another attempt.',
        IDEMPOTENCY_CONFLICT:
          'This request differs from an earlier attempt. Refresh before continuing.',
      };
      const feedback =
        cause instanceof ApiError
          ? (labels[cause.code] ??
            'The result could not be confirmed. Retry safely; an existing result will not reroll.')
          : 'The result could not be confirmed. Retry safely; an existing result will not reroll.';
      if (
        cause instanceof ApiError &&
        cause.status >= 400 &&
        cause.status < 500
      )
        await load();
      error.value = feedback;
      return null;
    } finally {
      if (version === epoch) busy.value = false;
    }
  }
  return {
    items,
    history,
    result,
    loading,
    busy,
    error,
    nextCursor,
    serverTime,
    observedAt,
    clear,
    load,
    loadAttempt,
    more,
    attempt,
  };
});
