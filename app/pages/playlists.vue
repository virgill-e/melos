<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { data: playlists, status, error, refresh } = await useFetch('/api/spotify/playlists', {
  default: () => [] as PlaylistSummary[],
})

if (error.value?.statusCode === 401) await navigateTo('/')

const usable = computed(() => playlists.value.filter(playlist => playlist.usable))
const readOnly = computed(() => playlists.value.filter(playlist => !playlist.usable))

const selectedId = useState<string | null>('selected-playlist', () => null)
const selected = computed(() => usable.value.find(playlist => playlist.id === selectedId.value) ?? null)

function toggle(id: string) {
  selectedId.value = selectedId.value === id ? null : id
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <AppHeader />

    <main class="flex-1 px-8 pb-32 md:px-16">
      <h1 class="text-4xl font-bold tracking-[-0.035em]">Tes playlists</h1>
      <p class="mt-2 max-w-xl text-white/50">
        Choisis la playlist qui servira de source aux extraits.
      </p>

      <div v-if="status === 'pending'" class="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        <div v-for="n in 12" :key="n" class="animate-pulse">
          <div class="aspect-square rounded-md bg-white/6" />
          <div class="mt-3 h-4 w-3/4 rounded bg-white/6" />
        </div>
      </div>

      <div v-else-if="error" role="alert" class="mt-12 max-w-lg rounded-lg bg-white/6 p-5">
        <p class="font-medium">Impossible de charger tes playlists</p>
        <p class="mt-1 text-sm text-white/50">{{ error.statusMessage || error.message }}</p>
        <button type="button" class="mt-4 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/16" @click="() => refresh()">
          Réessayer
        </button>
      </div>

      <template v-else>
        <section class="mt-12">
          <p v-if="!usable.length" class="text-white/50">
            Aucune playlist à toi pour l'instant. Crée-en une dans Spotify ou copie une playlist existante dans ta bibliothèque.
          </p>
          <div v-else class="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            <PlaylistCard
              v-for="playlist in usable"
              :key="playlist.id"
              :playlist="playlist"
              :selected="playlist.id === selectedId"
              @select="toggle(playlist.id)"
            />
          </div>
        </section>

        <section v-if="readOnly.length" class="mt-20">
          <h2 class="text-xl font-semibold tracking-tight">Playlists suivies</h2>
          <p class="mt-1 max-w-2xl text-sm text-white/45">
            Spotify ne donne pas accès au contenu des playlists dont tu n'es ni propriétaire ni collaborateur.
            Pour en utiliser une, ajoute ses titres à une playlist à toi depuis l'app Spotify.
          </p>
          <div class="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            <PlaylistCard v-for="playlist in readOnly" :key="playlist.id" :playlist="playlist" :selected="false" />
          </div>
        </section>
      </template>
    </main>

    <Transition
      enter-from-class="translate-y-full opacity-0"
      leave-to-class="translate-y-full opacity-0"
      enter-active-class="transition duration-500 ease-apple"
      leave-active-class="transition duration-300 ease-apple"
    >
      <div v-if="selected" class="fixed inset-x-0 bottom-0 border-t border-white/10 bg-black/70 px-8 py-4 backdrop-blur-xl md:px-16">
        <div class="flex items-center gap-4">
          <img v-if="selected.imageUrl" :src="selected.imageUrl" alt="" class="size-12 rounded object-cover">
          <div class="min-w-0">
            <p class="truncate font-medium">{{ selected.name }}</p>
            <p class="text-sm text-white/45">Le réglage de la partie arrive à la prochaine étape.</p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
