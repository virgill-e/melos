<script setup lang="ts">
const props = defineProps<{ game: PublicGame }>()

const players = computed(() => props.game.players
  .filter(player => player.role === 'player')
  .sort((a, b) => b.score - a.score))

function isDimmed(player: PublicPlayer) {
  if (!player.connected) return true
  if (props.game.buzz) return props.game.buzz.playerId !== player.id
  return props.game.lockedPlayerIds.includes(player.id)
}
</script>

<template>
  <ol class="border-t border-white/10">
    <li
      v-for="player in players"
      :key="player.id"
      class="grid grid-cols-[2.6cqw_1fr_auto] items-center gap-[1.2cqw] border-b border-white/10 py-[.9cqw] text-[1.4cqw] font-medium transition-opacity duration-500 ease-apple"
      :class="isDimmed(player) ? 'opacity-35' : 'opacity-100'"
    >
      <PlayerAvatar :player="player" class="w-[2.6cqw] text-[.95cqw]" />
      <span class="truncate">
        {{ player.name }}
        <span v-if="!player.connected" class="ml-[.6cqw] text-[1cqw] font-normal text-white/50">hors ligne</span>
      </span>
      <b class="font-semibold tabular-nums">{{ player.score }}</b>
    </li>
  </ol>
</template>
