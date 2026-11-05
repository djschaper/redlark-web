import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { api, ApiError } from '../lib/api'
import type { AppInfo, LibraryInfo, SongSummary, ViewMode } from '../lib/types'

const LS_DARK = 'redlark.dark'
const LS_VIEW = 'redlark.view'
const LS_LIB = 'redlark.library'

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode */
  }
}

export const useAppStore = defineStore('app', () => {
  const info = ref<AppInfo | null>(null)
  const libraries = ref<LibraryInfo[]>([])
  const libraryId = ref<string>('')
  const songs = ref<SongSummary[]>([])
  const songsLoading = ref(false)
  const dark = ref(lsGet(LS_DARK) === '1')
  const view = ref<ViewMode>((lsGet(LS_VIEW) as ViewMode) || 'chords')
  const toast = ref<{ text: string; error: boolean } | null>(null)
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  const isLocal = computed(() => info.value?.mode === 'local')
  const user = computed(() => info.value?.user ?? null)
  const library = computed(() => libraries.value.find((l) => l.id === libraryId.value) ?? null)
  const canEdit = computed(() => !!library.value && library.value.role !== 'viewer')
  const needsLogin = computed(() => info.value?.mode === 'server' && !info.value.user)

  watch(dark, (v) => lsSet(LS_DARK, v ? '1' : '0'))
  watch(view, (v) => lsSet(LS_VIEW, v))
  watch(libraryId, (v) => {
    if (v) lsSet(LS_LIB, v)
    if (isLocal.value && v && info.value?.active_library !== v) {
      api.updateSettings({ active_library: v }).catch(() => {})
    }
  })

  function notify(text: string, error = false) {
    toast.value = { text, error }
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast.value = null), error ? 6000 : 3000)
  }

  function fail(e: unknown) {
    notify(e instanceof Error ? e.message : String(e), true)
  }

  async function load() {
    info.value = await api.info()
    if (lsGet(LS_DARK) === null && info.value.display_mode) dark.value = info.value.display_mode === 'dark'
    if (lsGet(LS_VIEW) === null && info.value.default_view) view.value = info.value.default_view
    if (needsLogin.value) return
    await loadLibraries()
  }

  async function loadLibraries() {
    try {
      libraries.value = await api.libraries()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && info.value) {
        info.value.user = null
        return
      }
      throw e
    }
    const preferred = [libraryId.value, info.value?.active_library, lsGet(LS_LIB)]
    const pick = preferred.find((id) => id && libraries.value.some((l) => l.id === id))
    libraryId.value = pick || libraries.value[0]?.id || ''
    await loadSongs()
  }

  async function loadSongs() {
    if (!libraryId.value) {
      songs.value = []
      return
    }
    songsLoading.value = true
    try {
      songs.value = await api.songs(libraryId.value)
    } catch (e) {
      songs.value = []
      fail(e)
    } finally {
      songsLoading.value = false
    }
  }

  async function logout() {
    await api.logout()
    if (info.value) info.value.user = null
    libraries.value = []
    songs.value = []
  }

  watch(libraryId, (v, old) => {
    if (old && v !== old) loadSongs()
  })

  return {
    info, libraries, libraryId, songs, songsLoading, dark, view, toast,
    isLocal, user, library, canEdit, needsLogin,
    load, loadLibraries, loadSongs, logout, notify, fail,
  }
})
