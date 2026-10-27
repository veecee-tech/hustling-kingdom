<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import type { SkillCode } from '@hk/shared';
import { useSkillsStore } from './store';
import GameIcon from '../../components/GameIcon.vue';
const skills = useSkillsStore();
const icons = {
  BUSINESS: 'work',
  TECHNOLOGY: 'technology',
  TRADING: 'trading',
  SOCIAL: 'social',
  FITNESS: 'fitness',
  STREET: 'street',
} as const;
const selected = ref<SkillCode | null>(null);
const detail = computed(() =>
  skills.skills.find((skill) => skill.code === selected.value),
);
onMounted(() => void skills.load());
</script>
<template>
  <section
    class="skills-panel"
    aria-labelledby="skills-title"
    :aria-busy="skills.loading"
  >
    <p class="eyebrow">YOUR NEXT CHAPTER</p>
    <h2 id="skills-title">Your skills</h2>
    <p class="muted">Work. Get better. Open new doors.</p>
    <p v-if="skills.loading && !skills.skills.length" role="status">
      Loading your skills…
    </p>
    <p v-if="skills.error" role="alert">
      {{ skills.error }}
      <button class="game-button secondary" @click="skills.load">
        Retry skills
      </button>
    </p>
    <template v-if="detail">
      <button class="work-back" @click="selected = null">← All skills</button>
      <article class="skill-detail" :aria-label="`${detail.name} skill detail`">
        <GameIcon :name="icons[detail.code]" />
        <p class="eyebrow">{{ detail.name }} · LEVEL {{ detail.level }}</p>
        <h3>{{ detail.name }}</h3>
        <p>{{ detail.description }}</p>
        <progress
          :value="detail.progress"
          max="1"
          :aria-label="`${detail.name} XP progress`"
        />
        <p>
          {{
            detail.capped
              ? 'Maximum level'
              : `${detail.currentLevelXp} / ${detail.nextLevelXp} XP to next level`
          }}
        </p>
        <p class="field-help">Total earned: {{ detail.xp }} XP</p>
        <h4>Build this skill</h4>
        <p>
          {{
            detail.sources.length
              ? `Earn XP from ${detail.sources.join(', ')}.`
              : 'No active XP source yet. Opportunities arrive in a later phase.'
          }}
        </p>
        <div v-if="detail.nextUnlock" class="skill-next">
          <p class="eyebrow">NEXT OPPORTUNITY</p>
          <RouterLink :to="`/jobs/${detail.nextUnlock.id}`"
            >{{ detail.nextUnlock.name }} · {{ detail.name }} Lv.
            {{ detail.nextUnlock.requiredLevel }}</RouterLink
          >
        </div>
        <p v-else class="muted">
          No further job unlock announced for this skill.
        </p>
      </article>
    </template>
    <ul v-else class="skill-roster" aria-label="Skills">
      <li v-for="skill in skills.skills" :key="skill.code">
        <button
          class="skill-row"
          @click="selected = skill.code"
          :aria-label="`${skill.name}, Level ${skill.level}, ${skill.xp} total XP`"
        >
          <GameIcon :name="icons[skill.code]" />
          <span
            ><strong
              >{{ skill.name }} <b>Lv. {{ skill.level }}</b></strong
            ><progress
              :value="skill.progress"
              max="1"
              :aria-label="`${skill.name} XP progress`"
            /><small>{{
              skill.capped
                ? 'MAX LEVEL'
                : `${skill.currentLevelXp} / ${skill.nextLevelXp} XP`
            }}</small
            ><em v-if="skill.nextUnlock"
              >Next: {{ skill.nextUnlock.name }} · Lv.
              {{ skill.nextUnlock.requiredLevel }}</em
            ><em v-else-if="!skill.sources.length"
              >No active XP source yet</em
            ></span
          ><GameIcon name="arrow" />
        </button>
      </li>
    </ul>
  </section>
</template>
