<script setup lang="ts">
defineProps<{
  name:
    | 'home'
    | 'wallet'
    | 'me'
    | 'city'
    | 'hustle'
    | 'arrow'
    | 'lock'
    | 'crown'
    | 'heat'
    | 'star'
    | 'phone'
    | 'work'
    | 'clean'
    | 'check'
    | 'technology'
    | 'trading'
    | 'social'
    | 'fitness'
    | 'street';
}>();
const paths = {
  technology: 'M3 4h18v15H3zM7 9l3 3-3 3m6 0h4M7 22h10',
  trading: 'M3 3v18h18M6 16l5-6 4 3 6-8m-5 0h5v5',
  social: 'M3 4h18v13H9l-6 4zM7 8h10M7 12h6',
  fitness: 'M2 9v6m3-9v12m0-6h14m0-6v12m3-9v6',
  street: 'M7 2 3 22m14-20 4 20M12 3v4m0 3v4m0 3v4',
  work: 'M3 7h18v14H3zM8 7V3h8v4M3 12h18M10 12v3h4v-3',
  clean: 'm15 2 2 1-6 13M8 13l6 3-4 6-8-4zM5 16l6 3',
  check: 'm5 12 4 4L19 6',
  heat: 'M12 2c2 6 7 7 7 13a7 7 0 0 1-14 0c0-3 2-6 4-8 0 4 2 4 2 5 2-3 2-6 1-10z',
  star: 'm12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
  phone:
    'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2M10 18h4M10 5h4',
  home: 'M3 10 12 3l9 7v10H7V10m3 10v-6h4v6',
  wallet: 'M3 6h17v14H3zM3 6V3h14v3m3 6h-6v4h6M16 14h1',
  me: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2',
  city: 'M3 21V9h6v12M9 21V3h7v18m0 0V12h5v9M1 21h22M12 7h1m-1 4h1m-1 4h1',
  hustle: 'm13 2-9 12h7l-1 8 10-13h-7z',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  lock: 'M5 10h14v11H5zm3 0V6a4 4 0 0 1 8 0v4',
  crown: 'm3 6 4 4 5-7 5 7 4-4-2 13H5zM6 15h12',
};
</script>
<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name]" />
  </svg>
</template>
