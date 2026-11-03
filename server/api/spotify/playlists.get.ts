import { defineEventHandler } from 'nuxt/server'
import { isUsablePlaylist, pickImage, type SpotifyPaging, type SpotifyPlaylist } from '../../utils/spotify-types'

const PAGE_SIZE = 50
const MAX_PLAYLISTS = 500
const COVER_WIDTH = 300

function toSummary(playlist: SpotifyPlaylist, userId: string): PlaylistSummary {
  const usable = isUsablePlaylist(playlist, userId)
  return {
    id: playlist.id,
    name: playlist.name,
    imageUrl: pickImage(playlist.images, COVER_WIDTH),
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
    const page = await spotifyFetch<SpotifyPaging<SpotifyPlaylist>>(event, '/me/playlists', {
      query: { limit: PAGE_SIZE, offset },
    })
    for (const playlist of page.items) {
      if (playlist) playlists.push(toSummary(playlist, user.id))
    }
    if (!page.next) break
  }

  return playlists
})
