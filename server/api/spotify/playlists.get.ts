import { defineEventHandler } from 'nuxt/server'

interface SpotifyImage {
  url: string
  width: number | null
  height: number | null
}

interface SpotifyPlaylist {
  id: string
  name: string
  collaborative: boolean
  images: SpotifyImage[] | null
  owner: { id: string, display_name: string | null }
  external_urls: { spotify: string }
  // Renommé `tracks` -> `items` en février 2026 ; absent pour les playlists d'autres utilisateurs.
  items?: { total: number }
  tracks?: { total: number }
}

interface Paging<T> {
  items: (T | null)[]
  next: string | null
}

const PAGE_SIZE = 50
const MAX_PLAYLISTS = 500
const PREFERRED_IMAGE_WIDTH = 300

function pickImage(images: SpotifyImage[] | null): string | null {
  if (!images?.length) return null
  // Spotify trie du plus grand au plus petit ; on prend la plus petite qui reste nette.
  const sharpEnough = images.filter(image => (image.width ?? 0) >= PREFERRED_IMAGE_WIDTH)
  return (sharpEnough.at(-1) ?? images[0])!.url
}

function toSummary(playlist: SpotifyPlaylist, userId: string): PlaylistSummary {
  const usable = playlist.owner.id === userId || playlist.collaborative
  return {
    id: playlist.id,
    name: playlist.name,
    imageUrl: pickImage(playlist.images),
    trackCount: usable ? (playlist.items ?? playlist.tracks)?.total ?? null : null,
    ownerName: playlist.owner.display_name ?? playlist.owner.id,
    usable,
    spotifyUrl: playlist.external_urls.spotify,
  }
}

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const playlists: PlaylistSummary[] = []

  for (let offset = 0; offset < MAX_PLAYLISTS; offset += PAGE_SIZE) {
    const page = await spotifyFetch<Paging<SpotifyPlaylist>>(event, '/me/playlists', {
      query: { limit: PAGE_SIZE, offset },
    })
    for (const playlist of page.items) {
      if (playlist) playlists.push(toSummary(playlist, user.id))
    }
    if (!page.next) break
  }

  return playlists
})
