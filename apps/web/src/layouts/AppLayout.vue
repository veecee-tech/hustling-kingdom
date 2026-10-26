<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <header class="border-b border-slate-800 px-6 py-5">
      <div class="mx-auto flex max-w-4xl items-center justify-between gap-4">
        <RouterLink to="/" class="font-semibold tracking-wide"
          >Hustling Kingdom</RouterLink
        >
        <span class="text-sm text-slate-400">Development · Phase 0</span>
      </div>
    </header>
    <main class="mx-auto max-w-4xl px-6 py-12"><slot /></main>
  </div>
</template>
