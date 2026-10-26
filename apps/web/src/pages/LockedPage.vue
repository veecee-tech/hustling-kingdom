<script setup lang="ts">
import { useRoute } from 'vue-router';
import GameIcon from '../components/GameIcon.vue';
const route = useRoute();
</script>
<template>
  <section class="locked-place">
    <GameIcon name="lock" />
    <h1>{{ route.name === 'city' ? 'Kingdom City' : 'Find your hustle' }}</h1>
    <p>
      {{
        route.name === 'city'
          ? 'You are at Family House in Old Town. Travel is not available yet.'
          : 'Work and hustle opportunities are still locked. Your story is just getting started.'
      }}
    </p>
    <ul v-if="route.name === 'city'" class="districts">
      <li
        v-for="district in [
          'Old Town',
          'Mainland',
          'City Centre',
          'The Island',
          'Royal Island',
        ]"
        :key="district"
      >
        <GameIcon name="city" /><strong>{{ district }}</strong
        ><span>{{
          district === 'Old Town' ? 'Your home · travel locked' : 'Locked'
        }}</span>
      </li>
    </ul>
    <RouterLink to="/" class="game-button primary">Back home</RouterLink>
  </section>
</template>
