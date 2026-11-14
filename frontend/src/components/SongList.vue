<script setup lang="ts">
import { computed, ref } from 'vue'
import draggable from 'vuedraggable'
import type { SongSummary } from '../lib/types'
import { useAppStore } from '../stores/app'
import { usePreviewStore } from '../stores/preview'
import { useSetStore, type SetEntry } from '../stores/set'
import Icon from './Icon.vue'
import ScrollTitle from './ScrollTitle.vue'

const emit = defineEmits<{ preview: []; newSong: [] }>()

const app = useAppStore()
const set = useSetStore()
const preview = usePreviewStore()
const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return app.songs
  return app.songs.filter(
    (s) => s.title.toLowerCase().includes(q) || s.author.toLowerCase().includes(q),
  )
})

function open(song: SongSummary) {
  preview.show(song.id)
  emit('preview')
}

function addToSet(song: SongSummary) {
  set.add(song)
  app.notify(`Added "${song.title}" to the set`)
}

// Enter in the search box adds the top match, then clears the search for the next one.
function addTopResult(e: KeyboardEvent) {
  if (e.isComposing || !search.value.trim()) return
  const top = filtered.value[0]
  if (!top) return
  addToSet(top)
  search.value = ''
}

// Shift+Enter previews the top match without adding it; the search stays so Enter can still add it.
function previewTopResult(e: KeyboardEvent) {
  if (e.isComposing || !search.value.trim()) return
  const top = filtered.value[0]
  if (top) open(top)
}

// Dragging a song into the Set panel clones it into a set entry.
let uid = 1_000_000
function toEntry(song: SongSummary): SetEntry {
  return { uid: uid++, songId: song.id, title: song.title, key: song.key || '' }
}
</script>

<template>
  <div id="songs" class="panel">
    <h2>
      Songs
      <button v-if="app.canEdit" class="dark-button" title="New song" @click="emit('newSong')">
        <Icon name="plus" />
      </button>
    </h2>
    <div id="song-searchbox-container">
      <input id="song-searchbox" v-model="search" type="search" placeholder="" aria-label="Search songs"
        @keydown.enter.exact.prevent="addTopResult"
        @keydown.shift.enter.exact.prevent="previewTopResult"
        @keydown.esc.exact.prevent="search = ''"
      />
      <Icon name="search" />
    </div>
    <div v-if="app.songsLoading && !app.songs.length" class="object-list"><div class="loader"></div></div>
    <div v-else-if="!app.libraryId" class="object-list empty-hint">
      <p>No library yet.</p>
      <RouterLink class="btn" to="/settings">Add a library</RouterLink>
    </div>
    <draggable
      v-else
      :list="filtered"
      item-key="id"
      tag="ul"
      id="song-list"
      class="object-list"
      :group="{ name: 'songs', pull: 'clone', put: false }"
      :sort="false"
      :clone="toEntry"
      :delay="250"
      :delay-on-touch-only="true"
    >
      <template #item="{ element: song }">
        <li class="song" :class="{ selected: preview.song?.id === song.id && preview.setUid === null }">
          <ScrollTitle class="song-title-container" :text="song.title" @click="open(song)" />
          <span
            class="recent"
            v-if="song.recency > 0"
            :style="{ opacity: song.recency }"
            :title="`Last set: ${song.last_set}`"
          ><Icon name="circle" /></span>
          <button class="add" title="Add to set" @click.stop="addToSet(song)"><Icon name="plus" /></button>
        </li>
      </template>
    </draggable>
  </div>
</template>

<style>
#songs {
  width: 320px;
  min-width: 320px;
}

#song-searchbox-container {
  margin-bottom: 10px;
  border-radius: 5px;
  border: 1px solid var(--muted);
  display: flex;
  align-items: center;
  background-color: var(--input-bg);
  min-height: 35px;
  color: var(--text);
}

#song-searchbox {
  border: none;
  background-color: transparent;
  font-size: medium;
  padding: 5px 5px 5px 10px;
  flex-grow: 1;
  min-width: 0;
  height: 100%;
  color: var(--text);
  outline: none;
}

#song-searchbox-container .icon {
  padding: 5px 10px;
  opacity: 0.5;
}

.empty-hint {
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
}

.song {
  display: flex;
  flex-direction: row;
  align-items: center;
  min-height: 25px;
  margin-bottom: 2px;
  border-radius: 4px;
  background-color: var(--item-bg);
  border: 1px solid var(--item-border);
  color: var(--item-text);
  cursor: default;
  user-select: none;
  transition: transform 0.1s;
}

.song:hover,
.song.selected {
  background-color: var(--hover);
  border-color: var(--accent);
}

#song-list .song:hover {
  transform: translateX(5px);
}

.song .recent {
  padding: 0 5px;
  font-size: 7px;
  color: #277aa7;
  display: inline-flex;
}

.song .add {
  display: none;
  background: none;
  border: none;
  color: var(--dark-button);
  padding: 2px 6px;
  font-size: 14px;
  cursor: pointer;
}

.song:hover .add {
  display: inline-flex;
}

.song.sortable-ghost {
  opacity: 0.5;
}

@media (max-width: 900px) {
  #songs {
    width: 100%;
    min-width: 0;
  }
  .song {
    min-height: 40px;
    font-size: 1.05em;
  }
  .song .add {
    display: inline-flex;
    font-size: 18px;
    padding: 8px 12px;
  }
  #song-list .song:hover {
    transform: none;
  }
}
</style>
