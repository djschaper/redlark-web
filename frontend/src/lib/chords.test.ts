import { describe, expect, it } from 'vitest'
import fixtures from '../../../shared/fixtures/chords.json'
import { keyOptions, parseKey, transposeChord, transpositionChange } from './chords'

describe('chords (shared fixtures with the Python backend)', () => {
  it('transposes chords', () => {
    for (const c of fixtures.transpose) expect(transposeChord(c.chord, c.change), JSON.stringify(c)).toBe(c.expected)
  })

  it('computes key changes', () => {
    for (const c of fixtures.change) expect(transpositionChange(c.from, c.to), JSON.stringify(c)).toBe(c.expected)
  })

  it('normalises keys and offers minor keys for minor songs', () => {
    expect(parseKey('A#')).toBe('Bb')
    expect(keyOptions('Em')).toContain('F#m')
    expect(keyOptions('Ebmaj7')).toContain('Eb')
  })
})
