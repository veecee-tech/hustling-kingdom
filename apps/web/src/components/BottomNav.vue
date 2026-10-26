<script setup lang="ts">
import GameIcon from './GameIcon.vue';
</script>
<template>
  <nav class="game-nav" aria-label="Game navigation">
    <RouterLink to="/" exact-active-class="is-active"
      ><GameIcon name="home" /><span>Home</span></RouterLink
    >
    <RouterLink to="/hustle" active-class="is-active"
      ><GameIcon name="hustle" /><span>Hustle</span></RouterLink
    >
    <RouterLink to="/city" active-class="is-active"
      ><GameIcon name="city" /><span>City</span></RouterLink
    >
    <RouterLink to="/phone" active-class="is-active"
      ><GameIcon name="phone" /><span>Phone</span></RouterLink
    >
    <RouterLink to="/account" active-class="is-active"
      ><GameIcon name="me" /><span>Me</span></RouterLink
    >
  </nav>
</template>
