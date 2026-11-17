<script setup lang="ts">
// Blue control bar above a song (v1 opensong.html #header): key, info, and action buttons.
import { computed, ref } from 'vue'
import { keyOptions } from '../lib/chords'
import type { ExportFormat, ViewMode } from '../lib/types'
import Icon from './Icon.vue'

const props = withDefaults(
  defineProps<{
    songKey: string
    originalKey: string
    info?: string
    dark: boolean
    mode: ViewMode
    youtubeUrl?: string
    canExport?: boolean
    canEdit?: boolean
    fullscreen?: boolean
  }>(),
  { info: '', youtubeUrl: '', canExport: true, canEdit: false, fullscreen: false },
)

const emit = defineEmits<{
  'update:songKey': [key: string]
  'update:dark': [dark: boolean]
  'update:mode': [mode: ViewMode]
  print: []
  export: [format: ExportFormat]
  edit: []
  fullscreen: []
}>()

const options = computed(() => keyOptions(props.originalKey || props.songKey))
const showKey = computed(() => props.mode === 'chords' && !!props.songKey)
const menuOpen = ref(false)

function choose(format: ExportFormat) {
  menuOpen.value = false
  emit('export', format)
}
</script>

<template>
  <div class="song-toolbar">
    <div class="toolbar-buttons">
      <button
        class="control-btn"
        :title="mode === 'chords' ? 'Show lyrics only' : 'Show chords'"
        @click="emit('update:mode', mode === 'chords' ? 'lyrics' : 'chords')"
      >
        <Icon :name="mode === 'chords' ? 'alignLeft' : 'music'" />
      </button>
      <button class="control-btn" :title="dark ? 'Light mode' : 'Dark mode'" @click="emit('update:dark', !dark)">
        <Icon :name="dark ? 'moonSolid' : 'moonRegular'" />
      </button>
      <a v-if="youtubeUrl" class="control-btn" :href="youtubeUrl" target="_blank" rel="noopener" title="YouTube">
        <Icon name="youtube" />
      </a>
      <button class="control-btn" title="Print" @click="emit('print')"><Icon name="print" /></button>
      <template v-if="canExport">
        <button class="control-btn" title="Save PDF" @click="choose('pdf')"><Icon name="filePdf" /></button>
        <span class="export-menu">
          <button class="control-btn" title="Export…" @click="menuOpen = !menuOpen"><Icon name="fileExport" /></button>
          <div v-if="menuOpen" class="menu-popover" @mouseleave="menuOpen = false">
            <button @click="choose('pdf')"><Icon name="filePdf" /> PDF ({{ mode }})</button>
            <button @click="choose('html')"><Icon name="fileCode" /> Web page (HTML)</button>
            <button @click="choose('chordpro')"><Icon name="download" /> ChordPro</button>
            <button @click="choose('opensong')"><Icon name="download" /> OpenSong</button>
          </div>
        </span>
      </template>
      <button v-if="canEdit && !fullscreen" class="control-btn" title="Edit song" @click="emit('edit')"><Icon name="pen" /></button>
      <button
        class="control-btn"
        :title="fullscreen ? 'Exit full screen (Esc or Ctrl+F)' : 'Full screen (Ctrl+F)'"
        @click="emit('fullscreen')"
      >
        <Icon :name="fullscreen ? 'compress' : 'expand'" />
      </button>
    </div>
    <div v-if="showKey || info" class="toolbar-meta">
      <div class="key-control" v-if="showKey">
        <label for="key-select">Key</label>
        <select
          id="key-select"
          :value="songKey"
          @change="emit('update:songKey', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="k in options" :key="k" :value="k">{{ k }}</option>
        </select>
      </div>
      <div class="info-text">{{ info }}</div>
    </div>
  </div>
</template>

<style>
.song-toolbar {
  color: white;
  background-color: #2589bd;
  padding: 5px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: -5px 0 10px 10px rgba(0, 0, 0, 0.05);
  font-family: 'Trebuchet MS', Helvetica, sans-serif;
}

/* Row 2: key on the left, last-set info on the right. */
.toolbar-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
}

.key-control {
  display: flex;
  align-items: center;
  font-size: medium;
}

#key-select {
  margin-left: 7px;
  border: none;
  border-radius: 2px;
  color: white;
  font-size: medium;
  background-color: #33a6e4;
  outline: none;
  cursor: pointer;
  padding: 1px 2px;
}

#key-select:hover {
  box-shadow: 0 0 3px 4px rgba(0, 0, 0, 0.2);
}

.info-text {
  font-style: italic;
  font-size: small;
  flex: 1;
  min-width: 0;
  text-align: right;
}

.toolbar-buttons {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  column-gap: 16px;
}

.control-btn {
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  /* No side padding: the icon's edges are the button's edges, so the row lines up with the key
     control below. Spacing comes from the row's gap. */
  padding: 4px 0;
  cursor: pointer;
  transition-duration: 0.2s;
  display: inline-flex;
  text-decoration: none;
}

.control-btn .icon,
.control-btn .icon svg {
  width: auto; /* the glyph's own width, not a padded 1em square */
}

.control-btn:hover {
  color: rgba(0, 0, 0, 0.5);
}

.export-menu {
  position: relative;
}

.menu-popover {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 20;
  background: #1d2838;
  border-radius: 5px 0 5px 5px;
  padding: 5px;
  display: flex;
  flex-direction: column;
  min-width: 190px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.menu-popover button {
  background: transparent;
  border: 1px solid transparent;
  color: white;
  text-align: left;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: medium;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  gap: 8px;
  align-items: center;
  font-family: inherit;
}

.menu-popover button:hover {
  background-color: #2589bd;
  border-color: #175a7c;
}

@media (max-width: 600px) {
  .toolbar-buttons {
    column-gap: 18px;
  }
  .control-btn {
    font-size: 20px;
    padding: 6px 0;
  }
}

@media print {
  .song-toolbar {
    display: none !important;
  }
}
</style>
