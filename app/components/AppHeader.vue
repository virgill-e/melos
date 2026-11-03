<script setup lang="ts">
const { user, clear } = useUserSession()

async function logout() {
  await clear()
  await navigateTo('/')
}
</script>

<template>
  <header class="flex items-center justify-between px-8 py-6">
    <NuxtLink to="/" class="text-lg font-semibold tracking-tight">Melos</NuxtLink>
    <div v-if="user" class="flex items-center gap-3 text-sm">
      <img v-if="user.avatar" :src="user.avatar" alt="" class="size-7 rounded-full object-cover">
      <span class="text-white/60">{{ user.name }}</span>
      <button type="button" class="rounded-lg bg-white/8 px-3 py-1.5 font-medium transition hover:bg-white/14" @click="logout">
        Se déconnecter
      </button>
    </div>
  </header>
</template>
