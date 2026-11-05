export interface Segment {
  chord: string
  lyric: string
}

export interface SongLine {
  kind: 'music' | 'comment'
  segments: Segment[]
}

export interface SongSection {
  code: string
  kind: string
  label: string
  indented: boolean
  lines: SongLine[]
}

export interface SongPayload {
  id: string
  uuid: string
  title: string
  author: string
  copyright: string
  ccli: string
  key: string
  original_key: string
  tempo: string
  time_sig: string
  capo: string
  notes: string
  link_youtube: string
  youtube_url: string
  last_modified: string
  lyrics: string
  key_options: string[]
  sections: SongSection[]
  lyrics_sections: SongSection[]
}

export interface SongSummary {
  id: string
  title: string
  author: string
  key: string
  uuid: string
  last_set: string | null
  recency: number
}

export interface SetSummary {
  id: string
  name: string
  last_modified: string
}

export interface SetItem {
  song_id: string | null
  name: string
  key: string
  type: string
}

export interface SongSetData {
  id: string
  name: string
  last_modified: string
  items: SetItem[]
}

export interface LibraryInfo {
  id: string
  name: string
  role: 'viewer' | 'editor' | 'owner'
  kind: 'sql' | 'folder' | 'sqlite'
  path: string
}

export interface User {
  id: string
  email: string
  name: string
  is_admin: boolean
}

export interface AppInfo {
  version: string
  mode: 'server' | 'local'
  user: User | null
  allow_signup: boolean
  display_mode?: 'light' | 'dark'
  default_view?: 'chords' | 'lyrics'
  active_library?: string
}

export type ViewMode = 'chords' | 'lyrics'
export type ExportFormat = 'opensong' | 'chordpro' | 'pdf' | 'html'

/** Data embedded in standalone (exported / print) documents. */
export interface StandaloneData {
  title: string
  songs: SongPayload[]
  mode: ViewMode
  print: boolean
  dark: boolean
}
