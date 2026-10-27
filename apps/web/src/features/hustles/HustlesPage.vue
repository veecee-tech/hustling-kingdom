<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { HustleOutcome } from '@hk/shared';
import { useHustlesStore } from './store';
import { formatMoney } from '../wallet/money';
import GameIcon from '../../components/GameIcon.vue';
const hustles = useHustlesStore(),
  route = useRoute(),
  router = useRouter();
const confirming = ref(false),
  tick = ref(performance.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  void hustles.load();
  timer = setInterval(() => {
    tick.value = performance.now();
  }, 500);
});
onBeforeUnmount(() => clearInterval(timer));
watch(
  () => route.params.attemptId,
  (id) => {
    if (typeof id === 'string') void hustles.loadAttempt(id);
  },
  { immediate: true },
);
watch(
  () => route.params.hustleId,
  () => {
    confirming.value = false;
  },
);
const selected = computed(() =>
  hustles.items.find((h) => h.id === route.params.hustleId),
);
const result = computed(() => hustles.result);
const titles: Record<HustleOutcome, string> = {
  BIG_WIN: 'Big win!',
  SUCCESS: 'Cashed out',
  PARTIAL_SUCCESS: 'Not bad',
  FAILURE: 'Nothing today',
  DISASTER: 'Bad move',
};
const copy: Record<HustleOutcome, string> = {
  BIG_WIN: 'Everything landed perfectly.',
  SUCCESS: 'The move landed. This time.',
  PARTIAL_SUCCESS: 'Some of it worked out. Keep your expectations in check.',
  FAILURE: 'The opportunity went nowhere. That is part of the risk.',
  DISASTER: 'This one went left. The loss is real game money.',
};
function signed(value: string) {
  const n = BigInt(value);
  return n === 0n
    ? formatMoney('0')
    : `${n > 0n ? '+' : '−'}${formatMoney((n < 0n ? -n : n).toString())}`;
}
function remaining(until: string | null) {
  return until
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(until) -
            hustles.serverTime -
            (tick.value - hustles.observedAt)) /
            1000,
        ),
      )
    : 0;
}
async function takeRisk() {
  if (!selected.value) return;
  const id = await hustles.attempt(selected.value.id);
  if (id) await router.push(`/hustles/attempts/${id}`);
}
async function refresh() {
  if (typeof route.params.attemptId === 'string')
    await hustles.loadAttempt(route.params.attemptId);
  else await hustles.load();
}
</script>
<template>
  <section class="underground-experience" :aria-busy="hustles.busy">
    <p v-if="hustles.error" class="feedback danger" role="alert">
      {{ hustles.error }}
      <button
        class="game-button secondary"
        :disabled="hustles.loading || hustles.busy"
        @click="refresh"
      >
        Refresh opportunities
      </button>
    </p>
    <p v-if="hustles.loading && !hustles.items.length" role="status">
      Looking around Kingdom City…
    </p>
    <template v-if="route.name === 'hustle-result'">
      <article
        v-if="result"
        class="hustle-result"
        :class="`outcome-${result.outcome.toLowerCase()}`"
        role="status"
        aria-live="polite"
      >
        <GameIcon
          :name="result.outcome === 'DISASTER' ? 'hustle' : 'check'"
          class="outcome-emblem"
        />
        <p class="eyebrow">{{ result.hustleName }} · TIER {{ result.tier }}</p>
        <h1>{{ titles[result.outcome] }}</h1>
        <p>{{ copy[result.outcome] }}</p>
        <strong class="hustle-net">{{ signed(result.net) }}</strong>
        <p class="muted">Net change in Bank</p>
        <div class="hustle-money-breakdown">
          <p v-if="BigInt(result.reward) > 0n">
            Reward {{ signed(result.reward) }}
          </p>
          <p v-if="BigInt(result.loss) > 0n">
            Cost / loss −{{ formatMoney(result.loss) }}
          </p>
          <p>
            −{{ result.energySpent }} Energy · +{{
              result.skillProgress.xpAwarded
            }}
            Street XP
          </p>
        </div>
        <div v-if="result.skillProgress.leveledUp" class="level-up">
          <strong>LEVEL UP!</strong>
          <p>Street · Level {{ result.skillProgress.currentLevel }}</p>
        </div>
        <div
          v-for="unlock in result.unlocks"
          :key="unlock.id"
          class="skill-next"
        >
          <strong>NEW OPPORTUNITY UNLOCKED</strong
          ><RouterLink :to="`/hustles/${unlock.id}`"
            >{{ unlock.name }} →</RouterLink
          >
        </div>
        <p class="field-help">
          Heat and Reputation are unchanged. Those consequences arrive in a
          later phase.
        </p>
        <RouterLink to="/hustles" class="game-button primary w-full"
          >Back to opportunities</RouterLink
        ><RouterLink to="/wallet" class="game-button secondary w-full"
          >See Bank activity</RouterLink
        ><RouterLink to="/account" class="work-back"
          >See your Street skill</RouterLink
        >
      </article>
      <p v-else-if="!hustles.error" role="status">Loading your saved result…</p>
    </template>
    <template v-else-if="route.name === 'hustle-detail'">
      <RouterLink to="/hustles" class="work-back"
        >← All opportunities</RouterLink
      >
      <article v-if="selected" class="hustle-detail">
        <p class="eyebrow">
          {{ selected.locationLabel }} · TIER {{ selected.tier }}
        </p>
        <h1>{{ selected.name }}</h1>
        <p>{{ selected.description }}</p>
        <span class="risk-badge">{{ selected.riskLabel }} RISK</span>
        <dl class="risk-terms">
          <div>
            <dt>Potential payout</dt>
            <dd>
              {{ formatMoney(selected.rewardMin) }} –
              {{ formatMoney(selected.rewardMax) }}
            </dd>
          </div>
          <div>
            <dt>Entry cost</dt>
            <dd>{{ formatMoney(selected.entryCost) }} · Bank</dd>
          </div>
          <div>
            <dt>Maximum total loss</dt>
            <dd>−{{ formatMoney(selected.maximumLoss) }} · Bank</dd>
          </div>
          <div>
            <dt>Energy</dt>
            <dd>−{{ selected.energyCost }}</dd>
          </div>
        </dl>
        <p class="job-requirement">
          Street Lv. {{ selected.requiredStreetLevel }} · Yours Lv.
          {{ selected.currentStreetLevel }}
          {{
            selected.currentStreetLevel >= selected.requiredStreetLevel
              ? '✓'
              : ''
          }}
        </p>
        <p class="field-help">
          Bank must hold {{ formatMoney(selected.bankRequired) }} before you
          take this risk. A partial result may pay less. An entry cost is spent
          even when the move fails.
        </p>
        <p v-if="selected.lockReason" class="feedback danger">
          {{ selected.lockReason }}
          <span v-if="selected.cooldownUntil"
            >{{ remaining(selected.cooldownUntil) }}s remaining.</span
          >
        </p>
        <section
          v-if="confirming"
          class="risk-confirmation"
          aria-labelledby="risk-confirm-title"
        >
          <h2 id="risk-confirm-title">Take the risk?</h2>
          <p>
            You could lose up to {{ formatMoney(selected.maximumLoss) }} from
            Bank and spend {{ selected.energyCost }} Energy.
          </p>
          <p class="field-help">
            A fictional game opportunity. No result is guaranteed.
          </p>
          <button
            class="game-button primary w-full"
            :disabled="hustles.busy"
            @click="takeRisk"
          >
            {{ hustles.busy ? 'Finding out…' : 'Do it' }}</button
          ><button
            class="game-button secondary w-full"
            :disabled="hustles.busy"
            @click="confirming = false"
          >
            Leave it
          </button>
        </section>
        <button
          v-else
          class="game-button primary w-full"
          :disabled="!selected.available || hustles.busy"
          @click="confirming = true"
        >
          Consider this hustle
        </button>
        <button
          v-if="selected.cooldownUntil"
          class="game-button secondary w-full"
          :disabled="hustles.loading"
          @click="hustles.load"
        >
          Refresh availability
        </button>
      </article>
      <p v-else-if="!hustles.loading">This opportunity is unavailable.</p>
    </template>
    <template v-else>
      <p class="eyebrow">KINGDOM CITY / UNDERGROUND</p>
      <h1>Tempting. Never certain.</h1>
      <p class="muted">
        Jobs pay for your time. Here, the city can give or take.
      </p>
      <ul
        class="underground-opportunities"
        aria-label="Underground opportunities"
      >
        <li v-for="h in hustles.items" :key="h.id">
          <RouterLink
            :to="`/hustles/${h.id}`"
            class="underground-notice"
            :class="{ 'opportunity-locked': !h.available }"
            ><p class="eyebrow">{{ h.locationLabel }} · TIER {{ h.tier }}</p>
            <strong>{{ h.name }}</strong
            ><span
              >{{ formatMoney(h.rewardMin) }} –
              {{ formatMoney(h.rewardMax) }}</span
            ><small>{{ h.riskLabel }} RISK · −{{ h.energyCost }} Energy</small
            ><small
              >Entry {{ formatMoney(h.entryCost) }} · Maximum loss
              {{ formatMoney(h.maximumLoss) }}</small
            ><em
              >Street Lv. {{ h.requiredStreetLevel }} · Yours
              {{ h.currentStreetLevel }}</em
            ><span class="opportunity-action">{{
              h.lockReason ?? 'Check it out →'
            }}</span></RouterLink
          >
        </li>
      </ul>
      <button
        class="game-button secondary w-full"
        :disabled="hustles.loading"
        @click="hustles.load"
      >
        Refresh opportunities
      </button>
      <section class="hustle-history">
        <h2>Your recent moves</h2>
        <ul aria-label="Hustle history">
          <li v-for="attempt in hustles.history" :key="attempt.id">
            <RouterLink :to="`/hustles/attempts/${attempt.id}`"
              ><span
                ><strong>{{ attempt.hustleName }}</strong
                ><small
                  >{{ titles[attempt.outcome] }} ·
                  {{ new Date(attempt.resolvedAt).toLocaleDateString() }}</small
                ></span
              ><b>{{ signed(attempt.net) }}</b></RouterLink
            >
          </li>
        </ul>
        <p v-if="!hustles.history.length && !hustles.loading" class="muted">
          No underground moves yet.
        </p>
        <button
          v-if="hustles.nextCursor"
          class="game-button secondary"
          :disabled="hustles.loading"
          @click="hustles.more"
        >
          Older attempts
        </button>
      </section>
    </template>
  </section>
</template>
