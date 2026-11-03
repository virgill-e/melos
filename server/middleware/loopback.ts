// Spotify refuse "localhost" comme redirect URI : on ramène tout le monde sur 127.0.0.1
// pour que le cookie de session et l'URI de retour OAuth correspondent.
import { defineEventHandler, getRequestURL, sendRedirect } from 'nuxt/server'

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  if (url.hostname !== 'localhost') return
  url.hostname = '127.0.0.1'
  return sendRedirect(event, url.href, 302)
})
