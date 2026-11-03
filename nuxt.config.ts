import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: true },
  modules: ['nuxt-auth-utils', '@nuxt/fonts'],
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },

  // Écoute sur tout le réseau local pour que les téléphones rejoignent la partie.
  // L'hôte, lui, ouvre 127.0.0.1 : Spotify n'accepte que cette redirect URI (pas "localhost").
  devServer: { host: '0.0.0.0', port: 3000 },

  nitro: { experimental: { websocket: true } },

  fonts: {
    families: [{ name: 'Inter', provider: 'google', weights: [400, 500, 600, 700] }],
  },

  runtimeConfig: {
    oauth: {
      spotify: { clientId: '', clientSecret: '', redirectURL: '' },
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Melos',
      meta: [{ name: 'color-scheme', content: 'dark' }],
    },
  },
})
