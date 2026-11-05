<script setup lang="ts">
// A one-line title that scrolls to reveal its end on hover (v1 scrollText/resetText).
import { ref } from 'vue'

defineProps<{ text: string }>()
const inner = ref<HTMLElement | null>(null)

function scroll() {
  const el = inner.value
  if (!el?.parentElement) return
  const diff = el.offsetWidth - el.parentElement.clientWidth
  if (diff > 0) {
    el.style.transitionDelay = '0.5s'
    el.style.transitionDuration = `${0.02 * diff}s`
    el.style.left = `${-(diff + 5)}px`
  }
}

function reset() {
  const el = inner.value
  if (!el) return
  el.style.transitionDelay = '0s'
  el.style.transitionDuration = '0s'
  el.style.left = '0'
}
</script>

<template>
  <div class="scroll-title" @mouseenter="scroll" @mouseleave="reset" @mouseup="reset">
    <span ref="inner" class="song-title">{{ text }}</span>
  </div>
</template>

<style>
.scroll-title {
  flex-grow: 1;
  overflow: hidden;
  min-width: 0;
  cursor: pointer;
  align-self: stretch;
  display: flex;
  align-items: center;
}

.song-title {
  padding-left: 5px;
  font-size: medium;
  white-space: nowrap;
  position: relative;
  left: 0;
  transition-property: left;
  transition-timing-function: linear;
}
</style>
