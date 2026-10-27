<script setup lang="ts">
import GameIcon from '../components/GameIcon.vue';
</script>
<template>
  <section class="phone-launcher">
    <p class="phone-city">KINGDOM CONNECT</p>
    <h1>Your phone</h1>
    <p>A little city in your pocket.</p>
    <div class="phone-apps">
      <RouterLink to="/wallet"
        ><span class="app-tile bank-tile"><GameIcon name="wallet" /></span
        >Bank</RouterLink
      ><RouterLink to="/jobs"
        ><span class="app-tile work-tile"><GameIcon name="work" /></span
        >Jobs</RouterLink
      ><button
        v-for="app in ['Messages', 'Trading', 'Properties', 'Dating']"
        :key="app"
        disabled
      >
        <span class="app-tile"><GameIcon name="lock" /></span>{{ app
        }}<small>Locked</small>
      </button>
    </div>
    <p class="phone-note">More apps arrive as the city opens up.</p>
  </section>
</template>
