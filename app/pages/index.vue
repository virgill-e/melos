<script setup lang="ts">
const { loggedIn, user } = useUserSession()
const route = useRoute()

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Connexion annulée sur Spotify.',
  oauth: 'La connexion à Spotify a échoué. Vérifie le Client ID, le secret et la Redirect URI dans ton .env.',
}
const errorMessage = computed(() => {
  const code = route.query.error
  if (typeof code !== 'string') return null
  return ERROR_MESSAGES[code] ?? `Spotify a renvoyé une erreur : ${code}.`
})
</script>

<template>
  <main class="grid flex-1 grid-cols-1 items-center gap-16 px-8 py-16 md:grid-cols-[1.1fr_1fr] md:px-16">
    <VinylDisc class="mx-auto w-full max-w-[520px]" />

    <div class="max-w-md">
      <h1 class="text-6xl font-bold tracking-[-0.04em] md:text-7xl">Melos</h1>
      <p class="mt-4 text-xl text-white/60">
        Le blind test de salon, sur ta propre musique.
      </p>

      <p v-if="errorMessage" role="alert" class="mt-8 rounded-lg bg-accent/15 px-4 py-3 text-sm text-[#ffb9a8]">
        {{ errorMessage }}
      </p>

      <div class="mt-10">
        <NuxtLink
          v-if="loggedIn"
          to="/playlists"
          class="inline-flex rounded-full bg-white px-6 py-3 text-[15px] font-semibold text-black transition hover:bg-white/85"
        >
          Choisir une playlist
        </NuxtLink>
        <a
          v-else
          href="/auth/spotify"
          class="inline-flex rounded-full bg-white px-6 py-3 text-[15px] font-semibold text-black transition hover:bg-white/85"
        >
          Se connecter avec Spotify
        </a>
        <p class="mt-4 text-sm text-white/40">
          <template v-if="loggedIn">Connecté en tant que {{ user?.name }}.</template>
          <template v-else>Un compte Spotify Premium est requis sur l'appareil qui diffuse la musique.</template>
        </p>
      </div>
    </div>
  </main>
</template>
