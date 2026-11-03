<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <NuxtPage />
    <AppFooter v-if="!route.meta.immersive" />
  </div>
</template>
