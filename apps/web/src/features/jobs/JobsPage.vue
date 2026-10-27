<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useJobsStore } from './store';
import { useAuthStore } from '../auth/store';
import { formatMoney } from '../wallet/money';
import GameIcon from '../../components/GameIcon.vue';
import CharacterAvatar from '../../components/CharacterAvatar.vue';
const jobs = useJobsStore();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const tick = ref(performance.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  void jobs.load();
  timer = setInterval(() => {
    tick.value = performance.now();
  }, 250);
});
onBeforeUnmount(() => clearInterval(timer));
const selected = computed(() =>
  jobs.items.find((job) => job.id === route.params.jobId),
);
const remaining = computed(() =>
  !jobs.active
    ? 0
    : Math.max(
        0,
        Math.ceil(
          (Date.parse(jobs.active.completesAt) -
            jobs.serverTime -
            (tick.value - jobs.observedAt)) /
            1000,
        ),
      ),
);
const progress = computed(() => {
  const a = jobs.active;
  return !a
    ? 0
    : Math.min(
        100,
        Math.max(
          0,
          100 *
            (1 -
              (remaining.value * 1000) /
                (Date.parse(a.completesAt) - Date.parse(a.startedAt))),
        ),
      );
});
async function start(): Promise<void> {
  if (selected.value && (await jobs.start(selected.value.id)))
    await router.push('/jobs/work');
}
</script>
<template>
  <section class="jobs-experience" :aria-busy="jobs.busy">
    <p v-if="jobs.loading && !jobs.items.length" role="status">
      Finding work around the city…
    </p>
    <p v-if="jobs.error" role="alert" class="feedback danger">
      {{ jobs.error
      }}<button @click="jobs.load" :disabled="jobs.busy || jobs.loading">
        Refresh work
      </button>
    </p>
    <template v-if="route.name === 'job-work'">
      <div v-if="jobs.active" class="shift-stage">
        <p class="eyebrow">SHIFT STARTED</p>
        <h1>{{ jobs.active.jobName }}</h1>
        <p class="job-location">{{ jobs.active.locationLabel }}</p>
        <div class="work-avatar">
          <CharacterAvatar
            v-if="auth.character"
            :appearance="auth.character.appearance"
          /><GameIcon name="work" class="work-badge" />
        </div>
        <p class="shift-clock">
          {{ remaining > 0 ? `${remaining}s remaining` : 'Ready to finish' }}
        </p>
        <progress :value="progress" max="100" aria-label="Shift progress" />
        <p class="job-terms">
          <span>{{ formatMoney(jobs.active.pay) }} → Bank</span
          ><span>−{{ jobs.active.energyCost }} Energy</span>
        </p>
        <button
          class="game-button primary w-full"
          :disabled="remaining > 0 || jobs.busy"
          @click="jobs.complete(jobs.active.id)"
        >
          {{
            jobs.busy
              ? 'Confirming work…'
              : remaining > 0
                ? 'Working…'
                : 'Complete shift'
          }}
        </button>
        <p class="field-help">
          You can close this panel. Your shift stays active.
        </p>
      </div>
      <div v-else-if="jobs.lastCompleted" class="shift-stage shift-complete">
        <GameIcon name="check" class="shift-check" />
        <p class="eyebrow">WORK PAID OFF</p>
        <h1>Shift complete</h1>
        <p class="job-location">
          {{ jobs.lastCompleted.jobName }} ·
          {{ jobs.lastCompleted.locationLabel }}
        </p>
        <div class="salary-reward" role="status">
          +{{
            formatMoney(
              jobs.lastCompleted.rewardAmount ?? jobs.lastCompleted.pay,
            )
          }}<small
            >Paid to Bank · −{{ jobs.lastCompleted.energyCost }} Energy</small
          >
        </div>
        <p class="muted">Good work. Your money is in the bank.</p>
        <RouterLink to="/jobs" class="game-button primary w-full"
          >Find another shift</RouterLink
        ><RouterLink to="/phone" class="game-button secondary w-full"
          >Open phone</RouterLink
        >
      </div>
      <div v-else-if="!jobs.loading">
        <h1>No shift in progress</h1>
        <RouterLink to="/jobs" class="game-button primary"
          >Find work</RouterLink
        >
      </div>
    </template>
    <template v-else-if="route.name === 'job-detail'">
      <RouterLink to="/jobs" class="work-back">← All jobs</RouterLink>
      <article v-if="selected" class="job-detail">
        <div class="job-emblem">
          <GameIcon :name="selected.code === 'CLEANER' ? 'clean' : 'work'" />
        </div>
        <p class="eyebrow">{{ selected.locationLabel }}</p>
        <h1>{{ selected.name }}</h1>
        <p>{{ selected.description }}</p>
        <div class="job-detail-terms">
          <span
            ><small>Per shift</small
            ><strong>{{ formatMoney(selected.baseReward) }}</strong></span
          ><span
            ><small>Energy</small
            ><strong>−{{ selected.energyCost }}</strong></span
          ><span
            ><small>Shift</small
            ><strong>{{ selected.durationSeconds }}s</strong></span
          >
        </div>
        <p class="job-requirement">
          {{
            selected.lockReason ?? 'No experience needed. Salary goes to Bank.'
          }}
        </p>
        <button
          class="game-button primary w-full"
          :disabled="!selected.available || jobs.busy"
          @click="start"
        >
          {{ jobs.busy ? 'Starting…' : 'Start shift' }}</button
        ><RouterLink
          v-if="jobs.active"
          to="/jobs/work"
          class="game-button secondary w-full"
          >Resume active shift</RouterLink
        >
      </article>
      <p v-else-if="!jobs.loading">
        This job is unavailable. Choose another job.
      </p>
    </template>
    <template v-else
      ><p class="eyebrow">KINGDOM CITY / WORK NOTICEBOARD</p>
      <h1>Find your next shift.</h1>
      <p class="muted">A little work. A step forward.</p>
      <RouterLink v-if="jobs.active" to="/jobs/work" class="active-shift-link"
        ><GameIcon name="work" />Resume {{ jobs.active.jobName }} shift
        <GameIcon name="arrow"
      /></RouterLink>
      <ul class="job-noticeboard" aria-label="Jobs">
        <li v-for="job in jobs.items" :key="job.id">
          <RouterLink
            :to="`/jobs/${job.id}`"
            class="job-notice"
            :class="{ 'job-locked': !job.available }"
            ><span class="job-stamp"
              ><GameIcon
                :name="job.code === 'CLEANER' ? 'clean' : 'work'" /></span
            ><span class="job-notice-copy"
              ><small>{{ job.locationLabel }}</small
              ><strong>{{ job.name }}</strong
              ><span
                >{{ formatMoney(job.baseReward) }} <b>·</b> ⚡{{
                  job.energyCost
                }}
                <b>·</b> {{ job.durationSeconds }}s</span
              ><em>{{ job.lockReason ?? 'Available · View shift' }}</em></span
            ><GameIcon
              :name="job.available ? 'arrow' : 'lock'"
              class="job-status-icon"
          /></RouterLink>
        </li>
      </ul>
      <p v-if="!jobs.items.length && !jobs.loading && !jobs.error">
        No employers are hiring right now.
      </p></template
    >
  </section>
</template>
