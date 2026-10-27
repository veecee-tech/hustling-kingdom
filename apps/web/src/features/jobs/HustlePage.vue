<script setup lang="ts">
import GameIcon from '../../components/GameIcon.vue';
import { useJobsStore } from './store';
const jobs = useJobsStore();
</script>
<template>
  <section class="work-hub">
    <p class="eyebrow">MAKE YOUR NEXT MOVE</p>
    <h1>What’s your next move?</h1>
    <p class="muted">Work for a steady start, or take a chance.</p>
    <RouterLink to="/jobs" class="work-entry"
      ><GameIcon name="work" /><span
        ><strong>Find work</strong><small>Jobs around Kingdom City</small></span
      ><GameIcon name="arrow" /></RouterLink
    ><RouterLink v-if="jobs.active" to="/jobs/work" class="game-button primary"
      >Resume {{ jobs.active.jobName }} shift</RouterLink
    >
    <RouterLink to="/hustles" class="work-entry underground-entry"
      ><GameIcon name="hustle" /><span
        ><strong>Underground</strong
        ><small>Street opportunities · real game risk</small></span
      ><GameIcon name="arrow"
    /></RouterLink>
    <div class="locked-opportunity">
      <GameIcon name="lock" />
      <div>
        <strong>Business</strong>
        <p>Ownership comes later.</p>
      </div>
    </div>
  </section>
</template>
