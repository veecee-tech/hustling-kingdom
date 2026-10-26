<script setup lang="ts">
import { computed } from 'vue';
import type { Appearance } from '@hk/shared';
const props = withDefaults(
  defineProps<{ appearance: Appearance; label?: string }>(),
  { label: 'Character appearance preview' },
);
const skin = computed(
  () =>
    ({
      ebony: '#533324',
      umber: '#825133',
      bronze: '#ad754d',
      golden: '#d4a173',
    })[props.appearance.skinTone],
);
const top = computed(
  () =>
    ({ ankara: '#14b8a6', tee: '#60a5fa', kaftan: '#c084fc' })[
      props.appearance.top
    ],
);
</script>
<template>
  <svg
    viewBox="0 0 160 180"
    role="img"
    :aria-label="label"
    class="character-avatar"
  >
    <ellipse cx="80" cy="170" rx="45" ry="5" fill="#334155" />
    <path
      d="M57 115h46l-5 42H84l-4-27-4 27H62z"
      :fill="appearance.bottom === 'jeans' ? '#3b6091' : '#475569'"
    />
    <path
      v-if="appearance.bottom === 'skirt'"
      d="M57 115h46l12 32H45z"
      fill="#64748b"
    />
    <path
      d="M58 153h19v12H53v-7zM83 153h19l5 5v7H83z"
      :fill="
        appearance.shoes === 'sandals'
          ? '#b17b50'
          : appearance.shoes === 'loafers'
            ? '#292524'
            : '#e2e8f0'
      "
    />
    <path d="M54 75h52l16 38-14 6-8-22v26H60V97l-8 22-14-6z" :fill="top" />
    <path
      v-if="appearance.top === 'ankara'"
      d="M60 82l40 32M100 82l-40 32"
      stroke="#fde68a"
      stroke-width="5"
    />
    <ellipse
      cx="80"
      cy="48"
      :rx="appearance.face === 'round' ? 27 : 23"
      :ry="appearance.face === 'angular' ? 25 : 29"
      :fill="skin"
    />
    <path d="M55 39Q52 11 80 12Q108 11 105 39L98 28H62z" fill="#1c1917" />
    <path
      v-if="appearance.hair === 'afro'"
      d="M48 40Q38 2 80 3Q122 2 112 40L101 27H59z"
      fill="#1c1917"
    />
    <path
      v-if="appearance.hair === 'braids'"
      d="M55 30v46M104 30v46M50 33v42M109 33v42"
      stroke="#1c1917"
      stroke-width="5"
    />
    <circle cx="71" cy="47" r="2" fill="#1c1917" />
    <circle cx="89" cy="47" r="2" fill="#1c1917" />
    <path d="M73 61q7 5 14 0" fill="none" stroke="#3f2418" stroke-width="2" />
  </svg>
</template>
