// Sous-ensemble des objets renvoyés par la Web API Spotify, limité à ce que Melos utilise.

export interface SpotifyImage {
  url: string
  width: number | null
  height: number | null
}

export interface SpotifyTrack {
  id: string | null
  uri: string
  type: 'track' | 'episode'
  name: string
  duration_ms: number
  is_local?: boolean
  artists: { name: string }[]
  album: { name: string, release_date?: string, images: SpotifyImage[] }
  external_urls: { spotify: string }
}

export interface SpotifyPlaylist {
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

export interface SpotifyPlaylistItem {
  is_local: boolean
  // Renommé `track` -> `item` en février 2026.
  item?: SpotifyTrack | null
  track?: SpotifyTrack | null
}

export interface SpotifyPaging<T> {
  items: (T | null)[]
  next: string | null
  total: number
}

/** Spotify trie les images du plus grand au plus petit : on prend la plus petite qui reste nette. */
export function pickImage(images: SpotifyImage[] | null | undefined, minWidth: number): string | null {
  if (!images?.length) return null
  const sharpEnough = images.filter(image => (image.width ?? 0) >= minWidth)
  return (sharpEnough.at(-1) ?? images[0])!.url
}

export function isUsablePlaylist(playlist: SpotifyPlaylist, userId: string): boolean {
  return playlist.owner.id === userId || playlist.collaborative
}
