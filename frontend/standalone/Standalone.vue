<script setup lang="ts">
// Self-contained viewer for exported HTML files and PDF rendering.
import { nextTick, onMounted, reactive, ref } from 'vue'
import SongSheet from '../src/components/SongSheet.vue'
import SongToolbar from '../src/components/SongToolbar.vue'
import type { StandaloneData, ViewMode } from '../src/lib/types'

const props = defineProps<{ data: StandaloneData }>()

const dark = ref(props.data.dark && !props.data.print)
const mode = ref<ViewMode>(props.data.mode)
const keys = reactive<Record<number, string>>({})
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
    <div v-for="(song, i) in data.songs" :key="i" class="song-wrapper">
      <SongToolbar
        v-if="!data.print"
        :song-key="keys[i]"
        :original-key="song.original_key || song.key"
        :dark="dark"
        :mode="mode"
        :youtube-url="song.youtube_url"
        :can-export="false"
        @update:song-key="(k) => (keys[i] = k)"
        @update:dark="(d) => (dark = d)"
        @update:mode="(m) => (mode = m)"
        @print="printPage"
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
