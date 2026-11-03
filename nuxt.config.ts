import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: true },
  modules: ['nuxt-auth-utils', '@nuxt/fonts'],
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },

  // Spotify n'accepte que des redirect URI en loopback explicite (127.0.0.1), pas "localhost".
  devServer: { host: '127.0.0.1', port: 3000 },

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
