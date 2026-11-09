<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, printHtml, saveBlob } from '../lib/api'
import { useFullscreen } from '../lib/fullscreen'
import type { ExportFormat } from '../lib/types'
import { useAppStore } from '../stores/app'
import { usePreviewStore } from '../stores/preview'
import { useSetStore } from '../stores/set'
import Icon from './Icon.vue'
import SongSheet from './SongSheet.vue'
import SongToolbar from './SongToolbar.vue'

const app = useAppStore()
const preview = usePreviewStore()
const set = useSetStore()
const router = useRouter()
const busy = ref(false)
const windowEl = ref<HTMLElement | null>(null)
const fs = useFullscreen(windowEl)

const info = computed(() => {
  const s = preview.song
  if (!s) return ''
  const summary = app.songs.find((x) => x.id === s.id)
  return summary?.last_set ? `Last set: "${summary.last_set}"` : ''
})

async function doExport(format: ExportFormat) {
  const s = preview.song
  if (!s) return
  busy.value = true
  try {
    saveBlob(await api.exportSong(app.libraryId, s.id, format, preview.key, app.view))
  } catch (e) {
    app.fail(e)
  } finally {
    busy.value = false
  }
}

async function doPrint() {
  const s = preview.song
  if (!s) return
  try {
    const html = await api.exportText(app.libraryId, {
      format: 'html',
      mode: app.view,
      items: [{ song_id: s.id, key: preview.key }],
      combine: true,
      print_layout: true,
    })
    printHtml(html)
  } catch (e) {
    app.fail(e)
  }
}

// Previewing a song from the set: step through the set without leaving the preview.
const setIndex = computed(() =>
  preview.setUid === null ? -1 : set.entries.findIndex((e) => e.uid === preview.setUid),
)

function goSet(delta: number) {
  const e = set.entries[setIndex.value + delta]
  if (!e) return
  set.selectedUid = e.uid
  preview.show(e.songId, { key: e.key, setUid: e.uid })
  windowEl.value?.querySelector('.sheet-scroll')?.scrollTo(0, 0)
}

function edit() {
  if (preview.song) router.push({ name: 'edit-song', params: { id: preview.song.id } })
}
</script>

<template>
  <div id="preview" class="panel">
    <h2>Preview <span v-if="busy || preview.loading" class="mini-loader"></span></h2>
    <div id="preview-window" ref="windowEl" :class="{ dark: app.dark, 'is-fullscreen': fs.active.value }">
      <template v-if="preview.song">
        <nav v-if="setIndex >= 0" class="set-nav" aria-label="Songs in the set">
          <button title="Previous song in set" :disabled="setIndex === 0" @click="goSet(-1)">
            <Icon name="chevronLeft" />
          </button>
          <span class="set-nav-label">
            <b>{{ setIndex + 1 }} / {{ set.entries.length }}</b>
            <span class="set-nav-title">{{ set.entries[setIndex].title }}</span>
          </span>
          <button
            title="Next song in set"
            :disabled="setIndex === set.entries.length - 1"
            @click="goSet(1)"
          >
            <Icon name="chevronRight" />
          </button>
        </nav>
        <SongToolbar
          :song-key="preview.key"
          :original-key="preview.song.key"
          :info="info"
          :dark="app.dark"
          :mode="app.view"
          :youtube-url="preview.song.youtube_url"
          :can-edit="app.canEdit"
          :fullscreen="fs.active.value"
          @update:song-key="preview.changeKey"
          @update:dark="(d) => (app.dark = d)"
          @update:mode="(m) => (app.view = m)"
          @print="doPrint"
          @export="doExport"
          @edit="edit"
          @fullscreen="fs.toggle"
        />
        <div class="sheet-scroll">
          <SongSheet :song="preview.song" :target-key="preview.key" :mode="app.view" />
        </div>
      </template>
      <div v-else class="preview-empty">Select a song to preview it</div>
    </div>
  </div>
</template>

<style>
#preview {
  flex: 1;
  min-width: 0;
}

#preview-window {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--accent);
  border-radius: 5px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--sheet-bg);
  color: var(--sheet-fg);
}

.sheet-scroll {
  flex: 1;
  overflow: auto;
  scrollbar-width: none;
}

.sheet-scroll::-webkit-scrollbar {
  display: none;
}

/* Full screen: the Fullscreen API, or the CSS fallback that covers the window. */
#preview-window.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 100;
  border: none;
  border-radius: 0;
}

#preview-window:fullscreen {
  position: static;
}

#preview-window.is-fullscreen .song-sheet {
  font-size: 1.2em;
  padding: 12px 24px;
}

.set-nav {
  display: flex;
  align-items: center;
  background: var(--accent-dark);
  color: white;
  min-height: 40px;
}

.set-nav button {
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  width: 52px;
  align-self: stretch;
  cursor: pointer;
}

.set-nav button:disabled {
  opacity: 0.3;
  cursor: default;
}

.set-nav-label {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
}

.set-nav-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-empty {
  margin: auto;
  color: var(--muted);
  font-style: italic;
  padding: 20px;
  text-align: center;
}
</style>
