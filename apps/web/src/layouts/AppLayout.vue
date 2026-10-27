<script setup lang="ts">
import { computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../features/auth/store';
import { useWalletStore } from '../features/wallet/store';
import { useJobsStore } from '../features/jobs/store';
import { useSkillsStore } from '../features/skills/store';
import { useHustlesStore } from '../features/hustles/store';
import PlayerHud from '../components/PlayerHud.vue';
import BottomNav from '../components/BottomNav.vue';
import WorldView from '../components/WorldView.vue';
import ContextPanel from '../components/ContextPanel.vue';
const auth = useAuthStore();
const money = useWalletStore();
const jobs = useJobsStore();
const skills = useSkillsStore();
const hustles = useHustlesStore();
const refreshWork = () => {
  if (auth.character && !jobs.busy) void jobs.load();
};
onMounted(() => window.addEventListener('focus', refreshWork));
onBeforeUnmount(() => window.removeEventListener('focus', refreshWork));
const route = useRoute();
const worldRoute = computed(() =>
  [
    'home',
    'phone',
    'wallet',
    'account',
    'city',
    'hustle',
    'jobs',
    'job-detail',
    'job-work',
    'hustles',
    'hustle-detail',
    'hustle-result',
  ].includes(String(route.name)),
);
const title = computed(
  () =>
    ({
      phone: 'Phone',
      wallet: 'Bank',
      account: 'Me',
      city: 'City',
      hustle: 'Hustle',
      jobs: 'Jobs',
      'job-detail': 'Job detail',
      'job-work': 'Work',
      hustles: 'Underground',
      'hustle-detail': 'Opportunity',
      'hustle-result': 'Your move',
    })[
      route.name as
        | 'phone'
        | 'wallet'
        | 'account'
        | 'city'
        | 'hustle'
        | 'jobs'
        | 'job-detail'
        | 'job-work'
        | 'hustles'
        | 'hustle-detail'
        | 'hustle-result'
    ] ?? '',
);
watch(
  () => auth.character?.id,
  (id) => {
    hustles.clear();
    if (id) {
      void money.load(id);
      void jobs.load();
    } else {
      money.clear();
      jobs.clear();
      skills.clear();
    }
  },
  { immediate: true },
);
</script>
<template>
  <div
    class="game-shell"
    :class="{ 'world-shell': worldRoute, 'entry-shell': !worldRoute }"
  >
    <a class="skip-link" href="#game-content">Skip to content</a
    ><template v-if="worldRoute"
      ><PlayerHud />
      <main id="game-content" tabindex="-1">
        <WorldView />
        <ContextPanel
          v-if="title"
          :key="String(route.name)"
          :title="title"
          :phone="['phone', 'wallet'].includes(String(route.name))"
          ><slot /></ContextPanel
        ><slot v-else />
      </main>
      <BottomNav v-if="auth.character" /></template
    ><template v-else
      ><header class="masthead">
        <RouterLink to="/" class="brand"
          >HUSTLING <strong>KINGDOM</strong></RouterLink
        ><RouterLink to="/">Back to the city</RouterLink>
      </header>
      <main id="game-content" tabindex="-1" class="entry-content"><slot /></main
    ></template>
  </div>
</template>
