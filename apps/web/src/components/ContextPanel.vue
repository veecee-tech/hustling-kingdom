<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
defineProps<{ title: string; phone?: boolean }>();
const router = useRouter();
const dialog = ref<HTMLDialogElement>();
const previous = document.activeElement;
function close(): void {
  void router.push('/');
}
onMounted(() => dialog.value?.showModal());
onBeforeUnmount(() => {
  dialog.value?.close();
  if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
});
</script>
<template>
  <dialog
    ref="dialog"
    class="context-panel"
    :class="{ 'phone-device': phone }"
    :aria-label="title"
    @cancel.prevent="close"
  >
    <div v-if="phone" class="phone-speaker" aria-hidden="true" />
    <header class="panel-header">
      <RouterLink
        v-if="phone && $route.path === '/wallet'"
        to="/phone"
        aria-label="Back to phone"
        >←</RouterLink
      ><strong>{{ title }}</strong
      ><button autofocus aria-label="Close panel" @click="close">×</button>
    </header>
    <div class="panel-body"><slot /></div>
    <RouterLink
      v-if="phone"
      to="/phone"
      class="phone-home"
      aria-label="Phone home"
      ><span
    /></RouterLink>
  </dialog>
</template>
