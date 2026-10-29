<script setup lang="ts">
withDefaults(defineProps<{ label: string; value: number; tone?: 'blue' | 'orange' }>(), { tone: 'blue' })
</script>

<template>
  <div class="metric-gauge" :class="`tone-${tone}`" :style="{ '--value': `${Math.min(value, 100)}%` }">
    <div class="gauge-ring"><div class="gauge-center"><strong>{{ value }}<small>%</small></strong></div></div>
    <span>{{ label }}</span>
  </div>
</template>

<style scoped>
.metric-gauge{display:flex;min-width:0;align-items:center;flex-direction:column;gap:4px}.gauge-ring{display:grid;width:clamp(43px,4.1vw,72px);aspect-ratio:1;place-items:center;border-radius:50%;background:conic-gradient(from -90deg,var(--ring) 0 var(--value),rgba(87,127,172,.2) var(--value) 100%);filter:drop-shadow(0 0 6px color-mix(in srgb,var(--ring) 40%,transparent))}.gauge-center{display:grid;width:78%;height:78%;place-items:center;border:1px solid rgba(117,166,220,.18);border-radius:50%;background:radial-gradient(circle at 50% 35%,#152c50,#0b1930 75%);box-shadow:inset 0 0 9px rgba(42,105,183,.16)}.gauge-center strong{color:var(--ring);font:700 clamp(10px,.68vw,14px)/1 Arial,sans-serif;text-shadow:0 0 8px color-mix(in srgb,var(--ring) 55%,transparent);white-space:nowrap}.gauge-center small{font-size:.7em}.metric-gauge>span{max-width:100%;color:#c6d8ee;font-size:clamp(7px,.52vw,10px);line-height:1.15;text-align:center}.tone-blue{--ring:#398bff}.tone-orange{--ring:#ff8b37}
</style>
