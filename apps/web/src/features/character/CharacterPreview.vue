<script setup lang="ts">
import type { Appearance } from '@hk/shared';
import CharacterAvatar from '../../components/CharacterAvatar.vue';
defineProps<{ appearance: Appearance }>();
</script>
<template>
  <figure class="avatar-stage">
    <CharacterAvatar :appearance="appearance" />
    <figcaption>
      Your look · {{ appearance.hair.replaceAll('-', ' ') }} ·
      {{ appearance.top }}
    </figcaption>
  </figure>
</template>
