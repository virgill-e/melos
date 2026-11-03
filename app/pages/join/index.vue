<script setup lang="ts">
definePageMeta({ immersive: true })

const code = ref('')
const normalized = computed(() => code.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))

function join() {
  if (normalized.value.length === 4) navigateTo(`/join/${normalized.value}`)
}
</script>

<template>
  <main class="flex min-h-dvh flex-col justify-center px-6">
    <p class="text-lg font-semibold tracking-tight">Melos</p>
    <h1 class="mt-6 text-4xl font-bold tracking-[-0.035em]">Rejoindre une partie</h1>
    <p class="mt-2 text-white/50">Le code est affiché sur l'écran principal.</p>
    <form class="mt-8 flex flex-col gap-3" @submit.prevent="join">
      <input
        v-model="code"
        inputmode="text"
        autocapitalize="characters"
        autocomplete="off"
        maxlength="4"
        placeholder="K7RX"
        aria-label="Code de la partie"
        class="rounded-2xl bg-white/8 px-5 py-4 text-center text-3xl font-bold uppercase tracking-[0.3em] outline-none placeholder:text-white/20 focus:bg-white/12"
      >
      <button type="submit" class="rounded-2xl bg-white py-4 text-base font-semibold text-black">Continuer</button>
    </form>
  </main>
</template>
