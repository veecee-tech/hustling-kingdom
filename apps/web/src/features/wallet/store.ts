import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { WalletSummary, WalletHistory, WalletEntry } from '@hk/shared';
import { api } from '../../api';
import { ApiError } from '../../api/client';
import { formatMoney } from './money';
export const useWalletStore = defineStore('wallet', () => {
  const wallet = ref<WalletSummary | null>(null);
  const entries = ref<WalletEntry[]>([]);
  const nextCursor = ref<string | null>(null);
  const loading = ref(false);
  const moving = ref(false);
  const loadingMore = ref(false);
  const error = ref('');
  const notice = ref('');
  let owner: string | null = null;
  let epoch = 0;
  let loadVersion = 0;
  let attempt: { intent: string; key: string } | undefined;
  function clear(): void {
    epoch++;
    loadVersion++;
    owner = null;
    wallet.value = null;
    entries.value = [];
    nextCursor.value = null;
    error.value = '';
    notice.value = '';
    attempt = undefined;
    loading.value = false;
    moving.value = false;
    loadingMore.value = false;
  }
  function accept(value: WalletSummary): void {
    if (!wallet.value || BigInt(value.version) >= BigInt(wallet.value.version))
      wallet.value = value;
  }
  async function load(characterId: string, force = false): Promise<void> {
    if (!force && owner === characterId && (loading.value || wallet.value))
      return;
    if (owner !== characterId) {
      clear();
      owner = characterId;
    }
    const version = epoch;
    const readVersion = ++loadVersion;
    loading.value = true;
    error.value = '';
    try {
      const [current, history] = await Promise.all([
        api.request<WalletSummary>('/api/v1/wallet', { authenticated: true }),
        api.request<WalletHistory>('/api/v1/wallet/transactions', {
          authenticated: true,
        }),
      ]);
      if (version !== epoch || readVersion !== loadVersion) return;
      accept(current);
      entries.value = history.items;
      nextCursor.value = history.nextCursor;
    } catch {
      if (version === epoch && readVersion === loadVersion)
        error.value = 'Your wallet could not be loaded. Give it another try.';
    } finally {
      if (version === epoch && readVersion === loadVersion)
        loading.value = false;
    }
  }
  async function more(): Promise<void> {
    if (!nextCursor.value || loadingMore.value) return;
    const version = epoch;
    loadingMore.value = true;
    try {
      const result = await api.request<WalletHistory>(
        `/api/v1/wallet/transactions?cursor=${encodeURIComponent(nextCursor.value)}`,
        { authenticated: true },
      );
      if (version !== epoch) return;
      const ids = new Set(entries.value.map((entry) => entry.id));
      entries.value.push(...result.items.filter((entry) => !ids.has(entry.id)));
      nextCursor.value = result.nextCursor;
    } catch {
      if (version === epoch)
        error.value = 'More activity could not be loaded. Please try again.';
    } finally {
      if (version === epoch) loadingMore.value = false;
    }
  }
  async function move(
    direction: 'deposit' | 'withdraw',
    amount: string,
  ): Promise<boolean> {
    if (moving.value || !owner) return false;
    const version = epoch;
    moving.value = true;
    error.value = '';
    notice.value = '';
    const intent = `${direction}:${amount}`;
    if (!attempt || attempt.intent !== intent)
      attempt = { intent, key: crypto.randomUUID() };
    try {
      const result = await api.request<WalletSummary>(
        `/api/v1/wallet/${direction}`,
        {
          method: 'POST',
          body: { amount },
          authenticated: true,
          idempotencyKey: attempt.key,
        },
      );
      if (version !== epoch) return false;
      accept(result);
      attempt = undefined;
      notice.value =
        direction === 'deposit'
          ? `${formatMoney(amount)} moved to Bank.`
          : `${formatMoney(amount)} moved to Cash.`;
      await load(owner!, true);
      return true;
    } catch (cause) {
      if (version !== epoch) return false;
      const messages: Record<string, string> = {
        INSUFFICIENT_FUNDS: 'There is not enough money in that account.',
        INVALID_AMOUNT: 'Enter a positive whole amount.',
        VALIDATION_ERROR: 'Check your amount and try again.',
        RATE_LIMITED: 'Easy now. Wait a moment before your next move.',
        IDEMPOTENCY_CONFLICT:
          'This move differs from an earlier attempt. Refresh your wallet before trying again.',
        TRANSACTION_CONFLICT:
          'That move could not be completed. Check your wallet and try again.',
      };
      error.value =
        cause instanceof ApiError
          ? (messages[cause.code] ??
            'The move could not be confirmed. Retry the same amount safely.')
          : 'The move could not be confirmed. Please try again.';
      return false;
    } finally {
      if (version === epoch) moving.value = false;
    }
  }
  return {
    wallet,
    entries,
    nextCursor,
    loading,
    moving,
    loadingMore,
    error,
    notice,
    clear,
    load,
    more,
    move,
  };
});
