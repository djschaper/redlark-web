<script setup lang="ts">
// Self-contained viewer for exported HTML files and PDF rendering.
import { nextTick, onMounted, reactive, ref } from 'vue'
import { useFullscreen } from '../src/lib/fullscreen'
import SongSheet from '../src/components/SongSheet.vue'
import SongToolbar from '../src/components/SongToolbar.vue'
import type { StandaloneData, ViewMode } from '../src/lib/types'

const props = defineProps<{ data: StandaloneData }>()

const dark = ref(props.data.dark && !props.data.print)
const mode = ref<ViewMode>(props.data.mode)
const keys = reactive<Record<number, string>>({})
const wrappers = ref<HTMLElement[]>([])
const fsTarget = ref<HTMLElement | null>(null)
const fs = useFullscreen(fsTarget)
function toggleFullscreen(i: number) {
  fsTarget.value = wrappers.value[i] ?? null
  fs.toggle()
}
props.data.songs.forEach((s, i) => (keys[i] = s.key))

function printPage() {
  window.print()
}

onMounted(async () => {
  await nextTick()
  if (document.fonts) await document.fonts.ready
  ;(window as unknown as { __REDLARK_READY__: boolean }).__REDLARK_READY__ = true
})
</script>

<template>
  <div class="standalone" :class="{ dark, print: data.print }">
    <div
      v-for="(song, i) in data.songs"
      :key="i"
      ref="wrappers"
      class="song-wrapper"
      :class="{ 'is-fullscreen': fs.active.value && fsTarget === wrappers[i] }"
    >
      <SongToolbar
        v-if="!data.print"
        :song-key="keys[i]"
        :original-key="song.original_key || song.key"
        :dark="dark"
        :mode="mode"
        :youtube-url="song.youtube_url"
        :can-export="false"
        :fullscreen="fs.active.value && fsTarget === wrappers[i]"
        @update:song-key="(k) => (keys[i] = k)"
        @update:dark="(d) => (dark = d)"
        @update:mode="(m) => (mode = m)"
        @print="printPage"
        @fullscreen="toggleFullscreen(i)"
      />
      <SongSheet :song="song" :target-key="keys[i]" :mode="mode" :columns="!data.print" />
    </div>
  </div>
</template>

<style>
html,
body {
  margin: 0;
  background: white;
}
.standalone {
  --sheet-bg: white;
  --sheet-fg: black;
  min-height: 100vh;
  background: var(--sheet-bg);
}
.standalone.dark {
  --sheet-bg: #1f1f1f;
  --sheet-fg: #efefef;
}
.standalone:not(.print) .song-wrapper {
  margin-bottom: 24px;
}
.song-wrapper.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 100;
  overflow: auto;
  background: var(--sheet-bg);
}
.song-wrapper.is-fullscreen .song-sheet {
  font-size: 1.2em;
}
.standalone.print .song-wrapper {
  break-after: page;
}
.standalone.print .song-wrapper:last-child {
  break-after: auto;
}
@media print {
  .standalone {
    --sheet-bg: white !important;
    --sheet-fg: black !important;
  }
  .song-wrapper {
    break-after: page;
  }
  .song-wrapper:last-child {
    break-after: auto;
  }
}
</style>
