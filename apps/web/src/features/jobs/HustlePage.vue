<script setup lang="ts">
import GameIcon from '../../components/GameIcon.vue';
import { useJobsStore } from './store';
const jobs = useJobsStore();
</script>
<template>
  <section class="work-hub">
    <p class="eyebrow">MAKE YOUR NEXT MOVE</p>
    <h1>Work your way up.</h1>
    <p class="muted">Honest work. A steady start.</p>
    <RouterLink to="/jobs" class="work-entry"
      ><GameIcon name="work" /><span
        ><strong>Find work</strong><small>Jobs around Kingdom City</small></span
      ><GameIcon name="arrow" /></RouterLink
    ><RouterLink v-if="jobs.active" to="/jobs/work" class="game-button primary"
      >Resume {{ jobs.active.jobName }} shift</RouterLink
    >
    <div class="locked-opportunity">
      <GameIcon name="lock" />
      <div>
        <strong>Street Hustles</strong>
        <p>Street hustles are still locked.</p>
      </div>
    </div>
    <div class="locked-opportunity">
      <GameIcon name="lock" />
      <div>
        <strong>Business</strong>
        <p>Ownership comes later.</p>
      </div>
    </div>
  </section>
</template>
