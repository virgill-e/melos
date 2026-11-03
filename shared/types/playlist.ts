export interface PlaylistSummary {
  id: string
  name: string
  imageUrl: string | null
  /** null quand Spotify ne fournit pas le contenu (playlist dont l'utilisateur n'est ni propriétaire ni collaborateur). */
  trackCount: number | null
  ownerName: string
  /** L'API ne donne accès aux morceaux que des playlists possédées ou collaboratives. */
  usable: boolean
  spotifyUrl: string
}
