import { defineEventHandler, getQuery, sendRedirect } from 'nuxt/server'

const oauthHandler = defineOAuthSpotifyEventHandler({
  config: { scope: SPOTIFY_SCOPES },
  async onSuccess(event, { user, tokens }) {
    await setUserSession(event, {
      user: {
        id: user.id,
        name: user.display_name ?? user.id,
        avatar: user.images?.[0]?.url ?? null,
      },
      secure: { spotify: toSpotifyTokens(tokens) },
      loggedInAt: Date.now(),
    })
    return sendRedirect(event, '/playlists')
  },
  onError(event, error) {
    console.error('[auth/spotify]', error)
    return sendRedirect(event, '/?error=oauth')
  },
})

export default defineEventHandler((event) => {
  // Refus de l'utilisateur sur l'écran de consentement : le module relancerait sinon l'autorisation.
  const { error } = getQuery(event)
  if (error) return sendRedirect(event, `/?error=${encodeURIComponent(String(error))}`)
  return oauthHandler(event)
})
