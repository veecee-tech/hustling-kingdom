<script setup lang="ts">
import { useId } from 'vue';
import {
  appearanceCatalog,
  appearanceCategories,
  type Appearance,
} from '@hk/shared';
defineProps<{ modelValue: Appearance; disabled?: boolean }>();
const id = useId();
const emit = defineEmits<{ 'update:modelValue': [value: Appearance] }>();
function update(
  current: Appearance,
  category: keyof Appearance,
  event: Event,
): void {
  emit('update:modelValue', {
    ...current,
    [category]: (event.target as HTMLSelectElement).value,
  });
}
</script>
<template>
  <fieldset :disabled="disabled" class="grid grid-cols-2 gap-4">
    <legend class="mb-3 font-semibold">Appearance</legend>
    <div
      v-for="category in appearanceCategories"
      :key="category"
      class="block capitalize"
    >
      <label :for="`${id}-${category}`">{{
        category === 'skinTone'
          ? 'Skin tone'
          : category.charAt(0).toUpperCase() + category.slice(1)
      }}</label>
      <select
        :id="`${id}-${category}`"
        class="auth-input mt-1 w-full"
        :value="modelValue[category]"
        @change="update(modelValue, category, $event)"
      >
        <option
          v-for="option in appearanceCatalog[category]"
          :key="option"
          :value="option"
        >
          {{ option.replaceAll('-', ' ') }}
        </option>
      </select>
    </div>
  </fieldset>
</template>
