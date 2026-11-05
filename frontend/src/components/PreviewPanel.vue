<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, printHtml, saveBlob } from '../lib/api'
import type { ExportFormat } from '../lib/types'
import { useAppStore } from '../stores/app'
import { usePreviewStore } from '../stores/preview'
import SongSheet from './SongSheet.vue'
import SongToolbar from './SongToolbar.vue'

const app = useAppStore()
const preview = usePreviewStore()
const router = useRouter()
const busy = ref(false)

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

function edit() {
  if (preview.song) router.push({ name: 'edit-song', params: { id: preview.song.id } })
}
</script>

<template>
  <div id="preview" class="panel">
    <h2>Preview <span v-if="busy || preview.loading" class="mini-loader"></span></h2>
    <div id="preview-window" :class="{ dark: app.dark }">
      <template v-if="preview.song">
        <SongToolbar
          :song-key="preview.key"
          :original-key="preview.song.key"
          :info="info"
          :dark="app.dark"
          :mode="app.view"
          :youtube-url="preview.song.youtube_url"
          :can-edit="app.canEdit"
          @update:song-key="preview.changeKey"
          @update:dark="(d) => (app.dark = d)"
          @update:mode="(m) => (app.view = m)"
          @print="doPrint"
          @export="doExport"
          @edit="edit"
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

.preview-empty {
  margin: auto;
  color: var(--muted);
  font-style: italic;
  padding: 20px;
  text-align: center;
}
</style>
