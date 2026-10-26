<script setup lang="ts">
import { useAuthStore } from '../features/auth/store';
import { useWalletStore } from '../features/wallet/store';
import { formatMoney } from '../features/wallet/money';
import GameIcon from './GameIcon.vue';
import CharacterAvatar from './CharacterAvatar.vue';
const auth = useAuthStore();
const money = useWalletStore();
</script>
<template>
  <section v-if="auth.character" class="player-hud" aria-label="Player status">
    <RouterLink to="/account" class="hud-player"
      ><span class="hud-portrait" aria-hidden="true"
        ><CharacterAvatar :appearance="auth.character.appearance" /></span
      ><strong>{{ auth.character.name }}</strong></RouterLink
    >
    <RouterLink
      to="/wallet"
      class="hud-money"
      :aria-label="
        money.wallet
          ? `Money ${formatMoney(money.wallet.total)}. Open Bank`
          : money.error
            ? 'Money unavailable. Open Bank'
            : 'Loading money. Open Bank'
      "
      ><GameIcon name="wallet" /><strong :key="money.wallet?.total">{{
        money.wallet
          ? formatMoney(money.wallet.total)
          : money.error
            ? 'Unavailable'
            : 'Loading…'
      }}</strong></RouterLink
    >
    <div class="hud-stats">
      <span
        :aria-label="`Energy ${auth.character.stats.energy} out of 100`"
        title="Energy"
        ><GameIcon name="hustle" /><b>{{ auth.character.stats.energy }}</b
        ><meter
          :value="auth.character.stats.energy"
          min="0"
          max="100"
          aria-label="Energy" /></span
      ><span :aria-label="`Heat ${auth.character.stats.heat}`" title="Heat"
        ><GameIcon name="heat" /><b>{{ auth.character.stats.heat }}</b></span
      ><span
        :aria-label="`Reputation ${auth.character.stats.reputation}`"
        title="Reputation"
        ><GameIcon name="star" /><b>{{
          auth.character.stats.reputation
        }}</b></span
      >
    </div>
  </section>
</template>
