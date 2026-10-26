<script setup lang="ts">
import { useId } from 'vue';
import {
  appearanceCatalog,
  appearanceCategories,
  type Appearance,
} from '@hk/shared';
import CharacterAvatar from '../../components/CharacterAvatar.vue';
defineProps<{ modelValue: Appearance; disabled?: boolean }>();
const id = useId();
const emit = defineEmits<{ 'update:modelValue': [value: Appearance] }>();
function label(category: keyof Appearance): string {
  return category === 'skinTone'
    ? 'Skin tone'
    : category.charAt(0).toUpperCase() + category.slice(1);
}
</script>
<template>
  <fieldset :disabled="disabled" class="appearance-picker">
    <legend>Appearance</legend>
    <fieldset
      v-for="category in appearanceCategories"
      :key="category"
      class="appearance-category"
    >
      <legend>{{ label(category) }}</legend>
      <div class="appearance-options">
        <label
          v-for="option in appearanceCatalog[category]"
          :key="option"
          class="appearance-option"
          :class="{ selected: modelValue[category] === option }"
          ><input
            type="radio"
            :name="`${id}-${category}`"
            :value="option"
            :checked="modelValue[category] === option"
            :aria-label="`${label(category)}: ${option.replaceAll('-', ' ')}`"
            @change="
              emit('update:modelValue', { ...modelValue, [category]: option })
            "
          /><span
            class="option-preview"
            :class="`preview-${category}`"
            aria-hidden="true"
            ><CharacterAvatar
              :appearance="{ ...modelValue, [category]: option }" /></span
          ><span>{{ option.replaceAll('-', ' ') }}</span></label
        >
      </div>
    </fieldset>
  </fieldset>
</template>
