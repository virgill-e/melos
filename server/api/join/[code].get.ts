import { defineEventHandler, getRouterParam } from 'nuxt/server'

/** Infos publiques d'une partie, pour adapter l'écran d'inscription du téléphone. */
export default defineEventHandler((event) => {
  const game = getGameByCode(getRouterParam(event, 'code') ?? '')
  return {
    mode: game.settings.mode,
    playlistName: game.playlistName,
    masterAvailable: game.settings.mode === 'master' && !game.players.some(player => player.role === 'master'),
  }
})
