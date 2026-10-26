<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '../auth/store';
import { useWalletStore } from './store';
import { formatMoney } from './money';
import TransactionList from './TransactionList.vue';
import GameIcon from '../../components/GameIcon.vue';
const auth = useAuthStore();
const money = useWalletStore();
const direction = ref<'deposit' | 'withdraw'>('deposit');
const amount = ref('');
const available = computed(
  () => money.wallet?.[direction.value === 'deposit' ? 'cash' : 'bank'] ?? '0',
);
const valid = computed(
  () =>
    /^[1-9][0-9]{0,18}$/.test(amount.value) &&
    BigInt(amount.value) <= BigInt(available.value),
);
async function submit(): Promise<void> {
  if (valid.value && (await money.move(direction.value, amount.value)))
    amount.value = '';
}
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">KINGDOM CONNECT / BANK</p>
      <h1>Kingdom Bank</h1>
    </div>
  </div>
  <div
    v-if="money.loading && !money.wallet"
    class="loading-panel"
    role="status"
  >
    Opening your wallet…
  </div>
  <p v-if="money.notice" role="status" class="feedback success">
    {{ money.notice }}
  </p>
  <div class="wallet-grid">
    <section class="money-card" aria-label="Wallet balances">
      <GameIcon name="crown" class="money-watermark" />
      <p class="eyebrow">Total money</p>
      <p class="money-total">
        {{ money.wallet ? formatMoney(money.wallet.total) : 'HK₦—' }}
      </p>
      <div class="balance-split">
        <div>
          <small>In your pocket</small><span>Cash</span
          ><strong>{{
            money.wallet ? formatMoney(money.wallet.cash) : '—'
          }}</strong>
        </div>
        <div>
          <small>Put aside</small><span>Bank</span
          ><strong>{{
            money.wallet ? formatMoney(money.wallet.bank) : '—'
          }}</strong>
        </div>
      </div>
    </section>
    <section class="game-panel move-panel" aria-labelledby="move-title">
      <p class="eyebrow">Make a move</p>
      <h2 id="move-title">Move money</h2>
      <div class="segmented" aria-label="Money move">
        <button
          :aria-pressed="direction === 'deposit'"
          :disabled="money.moving"
          @click="direction = 'deposit'"
        >
          Deposit</button
        ><button
          :aria-pressed="direction === 'withdraw'"
          :disabled="money.moving"
          @click="direction = 'withdraw'"
        >
          Withdraw
        </button>
      </div>
      <form @submit.prevent="submit" :aria-busy="money.moving">
        <label for="move-amount">Amount in HK₦</label
        ><input
          id="move-amount"
          v-model="amount"
          class="auth-input"
          inputmode="numeric"
          autocomplete="off"
          :disabled="money.moving"
          placeholder="e.g. 5000"
          aria-describedby="available-money"
        />
        <p id="available-money" class="field-help">
          Available: {{ formatMoney(available) }} · whole amounts only
        </p>
        <button
          class="game-button primary w-full"
          :disabled="!valid || money.moving || !money.wallet"
        >
          {{
            money.moving
              ? 'Moving…'
              : direction === 'deposit'
                ? 'Move cash to bank'
                : 'Move bank to cash'
          }}<GameIcon name="arrow" />
        </button>
      </form>
    </section>
  </div>
  <p v-if="money.error" role="alert" class="feedback danger">
    {{ money.error }}
    <button v-if="auth.character" @click="money.load(auth.character.id, true)">
      Refresh wallet
    </button>
  </p>
  <section class="game-panel activity-panel">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Activity</p>
        <h2>Recent moves</h2>
      </div>
      <span class="tag">Newest first</span>
    </div>
    <TransactionList :entries="money.entries" /><button
      v-if="money.nextCursor"
      class="game-button secondary"
      :disabled="money.loadingMore"
      @click="money.more"
    >
      {{ money.loadingMore ? 'Loading…' : 'Earlier activity' }}
    </button>
  </section>
  <p class="fine-print">
    HK₦ is fictional game currency. It cannot be bought back, paid out, or
    transferred to a real bank.
  </p>
</template>
