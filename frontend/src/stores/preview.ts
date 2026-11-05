import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../lib/api'
import type { SongPayload } from '../lib/types'
import { useAppStore } from './app'
import { useSetStore } from './set'

/** The song shown in the Preview panel. */
export const usePreviewStore = defineStore('preview', () => {
  const song = ref<SongPayload | null>(null)
  const key = ref('')
  const loading = ref(false)
  const setUid = ref<number | null>(null) // set entry being previewed, if any
  const cache = new Map<string, SongPayload>()
  let token = 0

  async function fetchSong(songId: string, force = false): Promise<SongPayload> {
    const app = useAppStore()
    const cacheKey = `${app.libraryId}/${songId}`
    if (!force && cache.has(cacheKey)) return cache.get(cacheKey)!
    const data = await api.song(app.libraryId, songId)
    cache.set(cacheKey, data)
    return data
  }

  async function show(songId: string, opts: { key?: string; setUid?: number | null } = {}) {
    const my = ++token
    loading.value = true
    try {
      const data = await fetchSong(songId)
      if (my !== token) return
      song.value = data
      key.value = opts.key || data.key
      setUid.value = opts.setUid ?? null
    } catch (e) {
      useAppStore().fail(e)
    } finally {
      if (my === token) loading.value = false
    }
  }

  /** Changing the key of a song previewed from the set updates that set entry (v1 behaviour). */
  function changeKey(k: string) {
    key.value = k
    if (setUid.value !== null) useSetStore().setKey(setUid.value, k)
  }

  function replace(data: SongPayload) {
    const app = useAppStore()
    cache.set(`${app.libraryId}/${data.id}`, data)
    if (song.value?.id === data.id || !song.value) {
      song.value = data
      key.value = data.key
    }
  }

  function forget(songId?: string) {
    if (!songId) cache.clear()
    else for (const k of [...cache.keys()]) if (k.endsWith('/' + songId)) cache.delete(k)
    if (songId && song.value?.id === songId) song.value = null
  }

  return { song, key, loading, setUid, fetchSong, show, changeKey, replace, forget }
})
