<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <section class="board-panel">
    <header class="panel-heading">
      <span class="heading-slash"></span>
      <div class="heading-copy"><strong>{{ title }}</strong><small v-if="subtitle">{{ subtitle }}</small></div>
      <div class="panel-tools"><slot name="tools" /></div>
    </header>
    <div class="panel-content"><slot /></div>
  </section>
</template>

<style scoped>
.board-panel{position:relative;display:flex;min-width:0;min-height:0;flex-direction:column;overflow:hidden;border:1px solid rgba(54,126,210,.36);background:linear-gradient(145deg,rgba(15,36,70,.91),rgba(7,22,47,.95));box-shadow:inset 0 0 22px rgba(30,92,178,.09),0 0 13px rgba(0,0,0,.24)}
.board-panel:before,.board-panel:after{position:absolute;z-index:2;width:5px;height:5px;content:'';background:#6fbeff;box-shadow:0 0 8px #2e8fff}
.board-panel:before{top:-1px;left:-1px}.board-panel:after{right:-1px;bottom:-1px}
.panel-heading{position:relative;display:flex;min-height:32px;align-items:center;gap:8px;padding:0 10px;border-bottom:1px solid rgba(47,123,221,.38);background:linear-gradient(105deg,rgba(32,91,174,.5),rgba(22,56,111,.45) 53%,rgba(13,32,68,.18));overflow:hidden}
.panel-heading:after{position:absolute;top:0;right:0;width:46%;height:100%;content:'';opacity:.2;background:repeating-linear-gradient(130deg,transparent 0 15px,#3680df 16px 21px,transparent 22px 30px);mask-image:linear-gradient(90deg,transparent,#000)}
.heading-slash{width:8px;height:15px;flex:none;transform:skew(-28deg);background:linear-gradient(180deg,#62dbff,#277afc);box-shadow:0 0 10px rgba(50,155,255,.55)}
.heading-copy{position:relative;z-index:1;display:flex;min-width:0;align-items:baseline;gap:8px}.heading-copy strong{overflow:hidden;color:#e8f4ff;font-size:clamp(11px,.75vw,15px);font-weight:700;letter-spacing:.07em;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 0 8px rgba(104,172,255,.22)}.heading-copy small{color:#8aa9d2;font-size:9px;white-space:nowrap}
.panel-tools{position:relative;z-index:2;display:flex;align-items:center;gap:4px;margin-left:auto;flex:none}.panel-content{display:flex;min-height:0;flex:1;flex-direction:column;padding:8px 9px}
</style>
