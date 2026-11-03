import type { RequestEvent } from 'nuxt/server'
import { pickImage, type SpotifyPaging, type SpotifyPlaylistItem, type SpotifyTrack } from './spotify-types'

const PAGE_SIZE = 50
const MAX_TRACKS = 2000
const CONCURRENCY = 4
const REVEAL_COVER_WIDTH = 600
/** En dessous, l'extrait n'a pas la place de démarrer hors intro/outro. */
const MIN_DURATION_MS = 45_000

export interface GameTrack {
  id: string
  uri: string
  durationMs: number
  answer: TrackAnswer
}

function toGameTrack(entry: SpotifyPlaylistItem | null): GameTrack | null {
  const track: SpotifyTrack | null | undefined = entry?.item ?? entry?.track
  if (!entry || entry.is_local || !track || track.type !== 'track' || !track.id) return null
  if (track.duration_ms < MIN_DURATION_MS) return null
  return {
    id: track.id,
    uri: track.uri,
    durationMs: track.duration_ms,
    answer: {
      title: track.name,
      artists: track.artists.map(artist => artist.name),
      album: track.album.name,
      year: track.album.release_date?.slice(0, 4) ?? null,
      imageUrl: pickImage(track.album.images, REVEAL_COVER_WIDTH),
      spotifyUrl: track.external_urls.spotify,
    },
  }
}

/** Morceaux jouables d'une playlist (hors fichiers locaux, podcasts et morceaux trop courts), sans doublons. */
export async function fetchPlaylistTracks(event: RequestEvent, playlistId: string): Promise<GameTrack[]> {
  const path = `/playlists/${encodeURIComponent(playlistId)}/items`
  const fetchPage = (offset: number) => spotifyFetch<SpotifyPaging<SpotifyPlaylistItem>>(event, path, {
    query: { limit: PAGE_SIZE, offset },
  })

  const first = await fetchPage(0)
  const pages = [first]
  const offsets: number[] = []
  for (let offset = PAGE_SIZE; offset < Math.min(first.total, MAX_TRACKS); offset += PAGE_SIZE) offsets.push(offset)

  // Quelques requêtes en parallèle seulement, pour ménager le quota du mode développement.
  for (let i = 0; i < offsets.length; i += CONCURRENCY) {
    pages.push(...await Promise.all(offsets.slice(i, i + CONCURRENCY).map(fetchPage)))
  }

  const byId = new Map<string, GameTrack>()
  for (const page of pages) {
    for (const entry of page.items) {
      const track = toGameTrack(entry)
      if (track && !byId.has(track.id)) byId.set(track.id, track)
    }
  }
  return [...byId.values()]
}
