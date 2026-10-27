import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SkillSummary, SkillsResponse } from '@hk/shared';
import { api } from '../../api';
import { useAuthStore } from '../auth/store';
export const useSkillsStore = defineStore('skills', () => {
  const auth = useAuthStore();
  const skills = ref<SkillSummary[]>([]),
    loading = ref(false),
    error = ref('');
  let generation = 0;
  function clear() {
    generation++;
    skills.value = [];
    loading.value = false;
    error.value = '';
  }
  async function load() {
    const id = auth.character?.id;
    if (!id) {
      clear();
      return;
    }
    const version = ++generation;
    loading.value = true;
    error.value = '';
    try {
      const response = await api.request<SkillsResponse>('/api/v1/skills', {
        authenticated: true,
      });
      if (version === generation && auth.character?.id === id)
        skills.value = response.skills;
    } catch {
      if (version === generation)
        error.value = 'Skills could not be refreshed. Try again.';
    } finally {
      if (version === generation) loading.value = false;
    }
  }
  return { skills, loading, error, clear, load };
});
