// Chord transposition — TypeScript twin of backend/redlark/core/chords.py.
// Both are checked against shared/fixtures/chords.json.

export const BASE_CHORDS = ['A', 'Bb', 'B', 'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#']
export const MAJOR_KEYS = [...BASE_CHORDS]
export const MINOR_KEYS = BASE_CHORDS.map((k) => k + 'm')
export const ALL_KEYS = [...MAJOR_KEYS, ...MINOR_KEYS]

const ENHARMONIC: Record<string, string> = {
  'A#': 'Bb', Ab: 'G#', Db: 'C#', 'D#': 'Eb', Gb: 'F#', Cb: 'B', Fb: 'E', 'E#': 'F', 'B#': 'C',
}

const BASE_RE = /^\W*([A-G][b#]?)/

export function baseChord(chord: string): [string, string] | null {
  const m = BASE_RE.exec(chord || '')
  if (!m) return null
  const old = m[1]
  return [old, ENHARMONIC[old] ?? old]
}

export function transposeChord(chord: string, change: number): string {
  if (chord.includes('/')) return chord.split('/').map((c) => transposeChord(c, change)).join('/')
  const res = baseChord(chord)
  if (!res) return chord
  const [old, base] = res
  const n = BASE_CHORDS.length
  const next = BASE_CHORDS[(((BASE_CHORDS.indexOf(base) + change) % n) + n) % n]
  return chord.replace(old, next)
}

export function parseKey(key: string): string {
  const k = (key || '').trim()
  return k ? transposeChord(k, 0) : ''
}

export function isMinor(key: string): boolean {
  return /^[A-G][b#]?m(?!aj)/.test(key || '')
}

export function transpositionChange(key: string, targetKey: string): number {
  const a = baseChord(key)
  const b = baseChord(targetKey)
  if (!a || !b) return 0
  return BASE_CHORDS.indexOf(b[1]) - BASE_CHORDS.indexOf(a[1])
}

export function keyOptions(key: string): string[] {
  return isMinor(key) ? MINOR_KEYS : MAJOR_KEYS
}

export function isValidKey(key: string | null | undefined): boolean {
  return !!key && ALL_KEYS.includes(parseKey(key))
}
