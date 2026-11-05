import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '../lib/api'
import { isValidKey } from '../lib/chords'
import type { SongSummary } from '../lib/types'
import { useAppStore } from './app'

export interface SetEntry {
  uid: number // unique per entry so the same song can appear twice
  songId: string
  title: string
  key: string // '' until chosen
}

let nextUid = 1

/** The set being edited in the Set panel (v1 home.js set logic). */
export const useSetStore = defineStore('set', () => {
  const name = ref('')
  const entries = ref<SetEntry[]>([])
  const dirty = ref(false)
  const saving = ref(false)
  const selectedUid = ref<number | null>(null)

  const allKeysSet = computed(() => entries.value.every((e) => isValidKey(e.key)))
  const canExport = computed(() => entries.value.length > 0 && allKeysSet.value)
  const canSave = computed(() => dirty.value && !!name.value.trim() && canExport.value)

  function add(song: SongSummary, key = '') {
    const entry = { uid: nextUid++, songId: song.id, title: song.title, key: key || song.key || '' }
    entries.value.push(entry)
    dirty.value = true
    return entry
  }

  function remove(uid: number) {
    entries.value = entries.value.filter((e) => e.uid !== uid)
    if (selectedUid.value === uid) selectedUid.value = null
    dirty.value = true
  }

  function setKey(uid: number, key: string) {
    const e = entries.value.find((x) => x.uid === uid)
    if (e && e.key !== key) {
      e.key = key
      dirty.value = true
    }
  }

  function clear() {
    name.value = ''
    entries.value = []
    selectedUid.value = null
    dirty.value = false
  }

  async function open(setId: string) {
    const app = useAppStore()
    const data = await api.set(app.libraryId, setId)
    const titles = new Map(app.songs.map((s) => [s.id, s.title]))
    entries.value = data.items
      .filter((i) => i.song_id && titles.has(i.song_id))
      .map((i) => ({ uid: nextUid++, songId: i.song_id!, title: titles.get(i.song_id!)!, key: i.key }))
    const missing = data.items.filter((i) => !i.song_id || !titles.has(i.song_id)).map((i) => i.name)
    name.value = data.name
    selectedUid.value = null
    dirty.value = false
    if (missing.length) app.notify(`Not in this library: ${missing.join(', ')}`, true)
  }

  async function save() {
    const app = useAppStore()
    saving.value = true
    try {
      await api.saveSet(app.libraryId, name.value.trim(), items())
      dirty.value = false
      app.notify(`Saved set "${name.value.trim()}"`)
      app.loadSongs() // refresh "last set" dots
    } catch (e) {
      app.fail(e)
    } finally {
      saving.value = false
    }
  }

  function items() {
    return entries.value.map((e) => ({ song_id: e.songId, key: e.key }))
  }

  return { name, entries, dirty, saving, selectedUid, allKeysSet, canExport, canSave, add, remove, setKey, clear, open, save, items }
})
