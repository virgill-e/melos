<script setup lang="ts">
// Règles de marque Spotify : logo complet (icône + texte), jamais sous 70 px de large, zone de
// protection égale à la moitié de la hauteur de l'icône. Logo vert uniquement sur fond noir ou
// blanc ; sur fond coloré (pochette floutée), version blanche.
withDefaults(defineProps<{ width?: string, variant?: 'white' | 'green', link?: boolean }>(), {
  width: '90px',
  variant: 'white',
  link: true,
})

// Rapport hauteur / largeur du logo officiel (viewBox 823.46 × 225.25).
const HEIGHT_RATIO = 225.25 / 823.46
</script>

<template>
  <component
    :is="link ? 'a' : 'span'"
    :href="link ? 'https://open.spotify.com' : undefined"
    :target="link ? '_blank' : undefined"
    :rel="link ? 'noopener' : undefined"
    class="inline-block shrink-0"
    :style="{ '--logo-width': `max(70px, ${width})`, padding: `calc(var(--logo-width) * ${HEIGHT_RATIO / 2})` }"
  >
    <img
      :src="`/brand/spotify-logo-${variant}.svg`"
      alt="Spotify"
      class="block"
      :style="{ width: 'var(--logo-width)' }"
    >
  </component>
</template>
