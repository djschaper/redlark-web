import type {
  AppInfo,
  ExportFormat,
  LibraryInfo,
  SetSummary,
  SongPayload,
  SongSetData,
  SongSummary,
  ViewMode,
} from './types'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin', headers: {} }
  if (body instanceof FormData) {
    init.body = body
  } else if (body !== undefined) {
    init.body = JSON.stringify(body)
    ;(init.headers as Record<string, string>)['content-type'] = 'application/json'
  }
  const res = await fetch(url, init)
  if (!res.ok) {
    let detail = res.statusText
    try {
      const data = await res.json()
      detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  const type = res.headers.get('content-type') || ''
  return (type.includes('application/json') ? res.json() : res.blob()) as Promise<T>
}

const lib = (id: string) => `/api/libraries/${encodeURIComponent(id)}`
const enc = encodeURIComponent

export interface SongInput {
  title: string
  author: string
  copyright: string
  ccli: string
  key: string
  tempo: string
  time_sig: string
  capo: string
  link_youtube: string
  notes: string
  lyrics: string
  chordpro?: string | null
}

export interface ExportRequest {
  format: ExportFormat
  mode?: ViewMode
  items?: { song_id: string; key: string }[]
  set_id?: string
  all?: boolean
  name?: string
  combine?: boolean
  numbered?: boolean
  print_layout?: boolean
}

export interface DownloadedFile {
  blob: Blob
  filename: string
}

async function download(method: string, url: string, body?: unknown): Promise<DownloadedFile> {
  const init: RequestInit = { method, credentials: 'same-origin' }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers = { 'content-type': 'application/json' }
  }
  const res = await fetch(url, init)
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail)
  }
  const cd = res.headers.get('content-disposition') || ''
  const m = /filename\*=UTF-8''([^;]+)/.exec(cd) || /filename="?([^";]+)"?/.exec(cd)
  return { blob: await res.blob(), filename: m ? decodeURIComponent(m[1]) : 'download' }
}

export const api = {
  info: () => request<AppInfo>('GET', '/api/info'),
  login: (email: string, password: string) => request<{ user: AppInfo['user'] }>('POST', '/api/auth/login', { email, password }),
  signup: (data: { email: string; password: string; name: string; library_name: string }) =>
    request<{ user: AppInfo['user'] }>('POST', '/api/auth/signup', data),
  logout: () => request<void>('POST', '/api/auth/logout'),

  libraries: () => request<LibraryInfo[]>('GET', '/api/libraries'),
  createLibrary: (data: { name: string; kind?: string; path?: string; set_song_path?: string }) =>
    request<LibraryInfo>('POST', '/api/libraries', data),
  updateLibrary: (id: string, data: { name?: string; set_song_path?: string; path?: string }) =>
    request<LibraryInfo>('PATCH', lib(id), data),
  deleteLibrary: (id: string) => request<void>('DELETE', lib(id)),
  members: (id: string) => request<(AppInfo['user'] & { role: string })[]>('GET', `${lib(id)}/members`),
  addMember: (id: string, data: { email: string; role: string; password?: string; name?: string }) =>
    request('POST', `${lib(id)}/members`, data),
  removeMember: (id: string, userId: string) => request<void>('DELETE', `${lib(id)}/members/${enc(userId)}`),

  songs: (libId: string) => request<SongSummary[]>('GET', `${lib(libId)}/songs`),
  song: (libId: string, songId: string) => request<SongPayload>('GET', `${lib(libId)}/songs/${enc(songId)}`),
  createSong: (libId: string, data: SongInput) => request<SongPayload>('POST', `${lib(libId)}/songs`, data),
  updateSong: (libId: string, songId: string, data: SongInput) =>
    request<SongPayload>('PUT', `${lib(libId)}/songs/${enc(songId)}`, data),
  deleteSong: (libId: string, songId: string) => request<void>('DELETE', `${lib(libId)}/songs/${enc(songId)}`),

  sets: (libId: string) => request<SetSummary[]>('GET', `${lib(libId)}/sets`),
  set: (libId: string, setId: string) => request<SongSetData>('GET', `${lib(libId)}/sets/${enc(setId)}`),
  saveSet: (libId: string, name: string, items: { song_id: string; key: string }[]) =>
    request<SongSetData>('POST', `${lib(libId)}/sets`, { name, items }),
  deleteSet: (libId: string, setId: string) => request<void>('DELETE', `${lib(libId)}/sets/${enc(setId)}`),

  exportSong: (libId: string, songId: string, format: ExportFormat, key: string, mode: ViewMode) =>
    download(
      'GET',
      `${lib(libId)}/songs/${enc(songId)}/export?format=${format}&key=${enc(key)}&mode=${mode}`,
    ),
  export: (libId: string, req: ExportRequest) => download('POST', `${lib(libId)}/export`, req),
  exportText: async (libId: string, req: ExportRequest) => (await download('POST', `${lib(libId)}/export`, req)).blob.text(),

  importFiles: (libId: string, files: File[], commit: boolean, decisions: Record<string, string> = {}) => {
    const form = new FormData()
    for (const f of files) form.append('files', f, (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name)
    form.append('commit', String(commit))
    form.append('decisions', JSON.stringify(decisions))
    return request<ImportPreview | ImportResult>('POST', `${lib(libId)}/import`, form)
  },

  convert: (text: string, to: 'opensong' | 'chordpro') =>
    request<{ text: string }>('POST', '/api/convert', { text, to }).then((r) => r.text),

  settings: () => request<LocalSettings>('GET', '/api/settings'),
  updateSettings: (data: Partial<LocalSettings>) => request<LocalSettings>('PATCH', '/api/settings', data),

  syncConnect: (url: string, email: string, password: string) =>
    request<{ user: AppInfo['user'] }>('POST', '/api/sync/connect', { url, email, password }),
  syncRemoteLibraries: () => request<LibraryInfo[]>('GET', '/api/sync/remote-libraries'),
  syncLink: (libId: string, remoteLibraryId: string) =>
    request('POST', `/api/sync/${enc(libId)}/link`, { remote_library_id: remoteLibraryId }),
  syncPreview: (libId: string) => request<SyncPreview>('POST', `/api/sync/${enc(libId)}/preview`),
  syncApply: (libId: string, resolutions: Record<string, string>, direction = 'both') =>
    request<Record<string, number>>('POST', `/api/sync/${enc(libId)}/apply`, { resolutions, direction }),
}

export interface ImportPreview {
  items: {
    source: string
    kind: 'song' | 'set'
    format: 'opensong' | 'chordpro'
    title: string
    existing_id: string | null
    error: string
  }[]
}

export type ImportResult = Record<'songs' | 'sets' | 'skipped' | 'errors', number>

export interface LocalLibrary {
  id: string
  name: string
  kind: 'folder' | 'sqlite'
  path: string
  set_song_path: string
  remote_url: string
  remote_library_id: string
  last_sync: string
}

export interface LocalSettings {
  connection: 'offline' | 'online'
  online_url: string
  display_mode: 'light' | 'dark'
  default_view: ViewMode
  libraries: LocalLibrary[]
  active_library: string
  remote_token: boolean
}

export interface SyncPreview {
  summary: Record<'push' | 'pull' | 'conflict' | 'same', number>
  entries: {
    key: string
    kind: 'song' | 'set'
    title: string
    action: 'push' | 'pull' | 'conflict'
    local_modified: string
    remote_modified: string
  }[]
}

export function saveBlob(file: DownloadedFile): void {
  const url = URL.createObjectURL(file.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Print an HTML document via a hidden iframe (v1 printHTML). */
export function printHtml(html: string): void {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(frame)
  frame.addEventListener('load', () => {
    const win = frame.contentWindow!
    const go = () => {
      win.focus()
      win.print()
      setTimeout(() => frame.remove(), 60_000)
    }
    // The viewer sets __REDLARK_READY__ after rendering.
    const wait = (n: number) =>
      (win as unknown as { __REDLARK_READY__?: boolean }).__REDLARK_READY__ || n <= 0 ? go() : setTimeout(() => wait(n - 1), 50)
    wait(60)
  })
  frame.srcdoc = html
}
