<script setup lang="ts">
import type { WalletEntry } from '@hk/shared';
import { formatMoney, entryLabels } from './money';
defineProps<{ entries: WalletEntry[] }>();
const date = (value: string) =>
  new Intl.DateTimeFormat('en-NG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
</script>
<template>
  <ul
    v-if="entries.length"
    class="transaction-list"
    aria-label="Wallet activity"
  >
    <li v-for="entry in entries" :key="entry.id">
      <span class="entry-direction" :class="entry.direction.toLowerCase()">{{
        entry.direction === 'CREDIT' ? '+' : '−'
      }}</span
      ><span class="entry-copy"
        ><strong>{{ entryLabels[entry.transactionType] }}</strong
        ><small
          >{{ entry.account === 'CASH' ? 'Cash' : 'Game bank' }} ·
          {{ date(entry.createdAt) }}</small
        ></span
      ><strong class="entry-amount"
        >{{ entry.direction === 'CREDIT' ? '+' : '−'
        }}{{ formatMoney(entry.amount) }}</strong
      >
    </li>
  </ul>
  <div v-else class="empty-state">
    <strong>Your money has a story.</strong>
    <p>Every game-money move will appear here once your wallet is ready.</p>
  </div>
</template>
