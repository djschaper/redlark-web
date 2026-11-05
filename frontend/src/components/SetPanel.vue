<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { api, printHtml, saveBlob } from '../lib/api'
import { ALL_KEYS, isValidKey, keyOptions } from '../lib/chords'
import type { ExportFormat, SetSummary, ViewMode } from '../lib/types'
import { useAppStore } from '../stores/app'
import { usePreviewStore } from '../stores/preview'
import { useSetStore, type SetEntry } from '../stores/set'
import Icon from './Icon.vue'
import ScrollTitle from './ScrollTitle.vue'

const props = defineProps<{ showOpen?: boolean }>()
const emit = defineEmits<{ preview: [] }>()

const app = useAppStore()
const set = useSetStore()
const preview = usePreviewStore()

const opening = ref(!!props.showOpen)
const sets = ref<SetSummary[]>([])
const setsLoading = ref(false)
const setFilter = ref('')
const exportOpen = ref(false)
const busy = ref(false)

watch(() => props.showOpen, (v) => v && showSets())

const filteredSets = computed(() => {
  const q = setFilter.value.trim().toLowerCase()
  return q ? sets.value.filter((s) => s.name.toLowerCase().includes(q)) : sets.value
})

async function showSets() {
  opening.value = true
  setsLoading.value = true
  try {
    sets.value = await api.sets(app.libraryId)
  } catch (e) {
    app.fail(e)
  } finally {
    setsLoading.value = false
  }
}

async function loadSet(s: SetSummary) {
  if (set.dirty && set.entries.length && !confirm('Discard unsaved changes to the current set?')) return
  try {
    await set.open(s.id)
    opening.value = false
  } catch (e) {
    app.fail(e)
  }
}

function newSet() {
  if (set.dirty && set.entries.length && !confirm('Discard unsaved changes to the current set?')) return
  set.clear()
}

function previewEntry(e: SetEntry) {
  set.selectedUid = e.uid
  preview.show(e.songId, { key: e.key, setUid: e.uid })
  emit('preview')
}

function onKey(e: SetEntry, k: string) {
  set.setKey(e.uid, k)
  if (preview.setUid === e.uid) preview.key = k
}

function keysFor(e: SetEntry) {
  return isValidKey(e.key) ? keyOptions(e.key) : ALL_KEYS
}

const setName = computed(() => set.name.trim() || 'Full Set')

async function doExport(format: ExportFormat, mode: ViewMode = app.view) {
  exportOpen.value = false
  busy.value = true
  try {
    const file = await api.export(app.libraryId, {
      format,
      mode,
      items: set.items(),
      name: setName.value,
      numbered: true,
      combine: true,
    })
    saveBlob(file)
  } catch (e) {
    app.fail(e)
  } finally {
    busy.value = false
  }
}

async function doPrint() {
  busy.value = true
  try {
    const html = await api.exportText(app.libraryId, {
      format: 'html',
      mode: app.view,
      items: set.items(),
      name: setName.value,
      combine: true,
      print_layout: true,
    })
    printHtml(html)
  } catch (e) {
    app.fail(e)
  } finally {
    busy.value = false
  }
}

// Copy an Order / Song / Key table with YouTube links (v1 copySetSongTable). Last song is "R".
async function copyTable() {
  busy.value = true
  try {
    const rows: string[] = []
    const plain: string[] = ['Order\tSong\tKey']
    for (let i = 0; i < set.entries.length; i++) {
      const e = set.entries[i]
      const song = await preview.fetchSong(e.songId)
      const order = i === set.entries.length - 1 ? 'R' : String(i + 1)
      const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
      rows.push(
        `<tr style="background:${i % 2 ? '#e9f7ff' : 'white'}"><td style="padding:3px 10px;text-align:center">${order}</td>` +
          `<td style="padding:3px 10px"><a href="${esc(song.youtube_url)}" style="color:#185c81">${esc(e.title)}</a></td>` +
          `<td style="padding:3px 10px;text-align:center">${esc(e.key)}</td></tr>`,
      )
      plain.push(`${order}\t${e.title}\t${e.key}`)
    }
    const th = 'style="background:#417b9b;color:white;padding:3px 10px;border:1px solid white"'
    const html =
      `<table style="border-collapse:collapse;font-size:small;color:black"><tr><th ${th}>Order</th><th ${th}>Song</th><th ${th}>Key</th></tr>` +
      rows.join('') +
      '</table>'
    if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain.join('\n')], { type: 'text/plain' }),
        }),
      ])
    } else {
      await navigator.clipboard.writeText(plain.join('\n'))
    }
    app.notify('Set table copied')
  } catch (e) {
    app.fail(e)
  } finally {
    busy.value = false
  }
}

function onChange() {
  set.dirty = true
}
</script>

<template>
  <div id="set" class="panel">
    <h2>Set <span v-if="busy" class="mini-loader"></span></h2>
    <div class="slider" :class="{ opening }">
      <div class="slide" id="edit-set-view">
        <div class="toolbar" id="edit-set-tools">
          <input id="set-name" v-model="set.name" type="text" placeholder="Unsaved Set" @input="set.dirty = true" />
          <button
            class="dark-button"
            title="Save set"
            :disabled="!set.canSave || set.saving || !app.canEdit"
            @click="set.save()"
          >
            <Icon name="save" />
          </button>
          <button class="dark-button" title="Open set" @click="showSets"><Icon name="folderOpen" /></button>
          <button class="dark-button" title="New set" @click="newSet"><Icon name="fileMedical" /></button>
        </div>
        <draggable
          v-model="set.entries"
          item-key="uid"
          tag="ul"
          id="set-song-list"
          class="object-list"
          :group="{ name: 'songs', pull: false, put: true }"
          handle=".grip"
          :animation="150"
          @change="onChange"
        >
          <template #item="{ element: e }">
            <li class="song" :class="{ selected: set.selectedUid === e.uid }">
              <span class="grip" title="Drag to reorder"><Icon name="grip" /></span>
              <ScrollTitle class="song-title-container" :text="e.title" @click="previewEntry(e)" />
              <select
                class="key"
                :class="{ unset: !isValidKey(e.key) }"
                :value="isValidKey(e.key) ? e.key : ''"
                title="Key"
                @change="onKey(e, ($event.target as HTMLSelectElement).value)"
              >
                <option value="" disabled>-</option>
                <option v-for="k in keysFor(e)" :key="k" :value="k">{{ k }}</option>
              </select>
              <button class="remove" title="Remove from set" @click="set.remove(e.uid)">
                <Icon name="circleMinus" />
              </button>
            </li>
          </template>
          <template #footer>
            <li v-if="!set.entries.length" class="drop-hint">Drag songs here, or tap + on a song</li>
          </template>
        </draggable>
        <div class="toolbar" id="export-set-tools">
          <button class="dark-button" title="Print set" :disabled="!set.canExport || busy" @click="doPrint">
            <Icon name="print" />
          </button>
          <button class="dark-button" title="Save set as PDF" :disabled="!set.canExport || busy" @click="doExport('pdf')">
            <Icon name="filePdf" />
          </button>
          <button class="dark-button" title="Copy set table" :disabled="!set.canExport || busy" @click="copyTable">
            <Icon name="copy" />
          </button>
          <span class="export-menu">
            <button class="dark-button" title="More exports…" :disabled="!set.canExport || busy" @click="exportOpen = !exportOpen">
              <Icon name="fileExport" />
            </button>
            <div v-if="exportOpen" class="menu-popover up" @mouseleave="exportOpen = false">
              <button @click="doExport('pdf', 'chords')"><Icon name="filePdf" /> PDF with chords</button>
              <button @click="doExport('pdf', 'lyrics')"><Icon name="filePdf" /> PDF lyrics only</button>
              <button @click="doExport('html')"><Icon name="fileCode" /> Web page (HTML)</button>
              <button @click="doExport('chordpro')"><Icon name="download" /> ChordPro files (zip)</button>
              <button @click="doExport('opensong')"><Icon name="download" /> OpenSong set (zip)</button>
            </div>
          </span>
        </div>
      </div>

      <div class="slide" id="open-set-view">
        <div class="toolbar">
          <button class="dark-button" title="Back" @click="opening = false"><Icon name="arrowLeft" /></button>
          <input v-model="setFilter" class="set-filter" type="search" placeholder="Find a set" />
        </div>
        <ul id="set-list" class="object-list">
          <div v-if="setsLoading" class="loader"></div>
          <li v-for="s in filteredSets" :key="s.id" class="set" @click="loadSet(s)">
            <ScrollTitle :text="s.name" />
          </li>
          <li v-if="!setsLoading && !filteredSets.length" class="drop-hint">No sets</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style>
#set {
  flex: 1;
  min-height: 200px;
  margin-left: 0;
  margin-right: 0;
}

.slider {
  flex: 1;
  min-height: 0;
  display: flex;
  width: calc(200% + 20px);
  gap: 20px;
  transition: transform 0.3s;
}

.slider.opening {
  transform: translateX(calc(-50% - 10px));
}

.slide {
  width: calc(50% - 10px);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

#set-name,
.set-filter {
  flex-grow: 1;
  min-width: 0;
  border: none;
  border-bottom: 1px solid var(--muted);
  font-style: italic;
  font-size: medium;
  background-color: transparent;
  color: var(--text);
  padding: 4px 2px;
}

#set-song-list {
  padding-bottom: 30px;
}

#set-song-list .song {
  padding-right: 2px;
}

.grip {
  color: var(--muted);
  padding: 0 4px 0 6px;
  cursor: grab;
  display: inline-flex;
  touch-action: none;
}

select.key {
  font-weight: bold;
  color: var(--key);
  background: transparent;
  border: none;
  font-size: medium;
  padding: 0 2px;
  cursor: pointer;
  appearance: none;
  text-align: center;
  min-width: 2.2em;
}

select.key.unset {
  color: var(--muted);
}

select.key option {
  color: black;
  background: white;
}

.song .remove {
  display: none;
  padding: 3px;
  background: none;
  border: none;
  color: var(--dark-button);
  cursor: pointer;
}

#set-song-list .song:hover .remove {
  display: inline-flex;
}

.drop-hint {
  color: var(--muted);
  font-style: italic;
  text-align: center;
  padding: 16px 8px;
  list-style: none;
}

#export-set-tools {
  padding-top: 10px;
  justify-content: center;
}

.menu-popover.up {
  top: auto;
  bottom: 100%;
  left: 50%;
  right: auto;
  transform: translateX(-50%);
  border-radius: 5px;
}

.set {
  padding: 6px 3px;
  border-bottom: solid rgba(0, 0, 0, 0.05) 1px;
  color: var(--item-text);
  cursor: pointer;
  display: flex;
}

.set:hover {
  background-color: var(--hover);
}

.mini-loader {
  width: 14px;
  height: 14px;
  border: 3px solid transparent;
  border-top-color: #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@media (max-width: 900px) {
  #set-song-list .song .remove {
    display: inline-flex;
    font-size: 18px;
    padding: 8px 10px;
  }
  .grip {
    font-size: 18px;
    padding: 8px 8px;
  }
  select.key {
    font-size: 1.1em;
    padding: 6px;
  }
  .set {
    padding: 12px 6px;
  }
}
</style>
