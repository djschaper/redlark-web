"""Chord parsing and transposition.

Ported from the v1 ``opensong.js`` (getBaseChord / transposeChord / getTranspositionChange),
keeping its fixed sharp/flat spelling so transposed sheets look the same as before.
The TypeScript twin lives in ``frontend/src/lib/chords.ts``; both are checked against
``shared/fixtures/chords.json``.
"""

from __future__ import annotations

import re

BASE_CHORDS = ["A", "Bb", "B", "C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#"]
MAJOR_KEYS = list(BASE_CHORDS)
MINOR_KEYS = [k + "m" for k in BASE_CHORDS]
ALL_KEYS = MAJOR_KEYS + MINOR_KEYS

ENHARMONIC = {"A#": "Bb", "Ab": "G#", "Db": "C#", "D#": "Eb", "Gb": "F#", "Cb": "B", "Fb": "E", "E#": "F", "B#": "C"}

_BASE_RE = re.compile(r"^\W*([A-G][b#]?)")


def base_chord(chord: str) -> tuple[str, str] | None:
    """Return (base as written, normalised base) or None if ``chord`` has no root note."""
    m = _BASE_RE.match(chord or "")
    if not m:
        return None
    old = m.group(1)
    return old, ENHARMONIC.get(old, old)


def transpose_chord(chord: str, change: int) -> str:
    if "/" in chord:
        return "/".join(transpose_chord(c, change) for c in chord.split("/"))
    res = base_chord(chord)
    if res is None:
        return chord
    old, base = res
    new = BASE_CHORDS[(BASE_CHORDS.index(base) + change) % len(BASE_CHORDS)]
    return chord.replace(old, new, 1)


def parse_key(key: str) -> str:
    """Normalise a key name (e.g. 'A#' -> 'Bb', 'Dbm' -> 'C#m'). Unknown input is returned stripped."""
    key = (key or "").strip()
    if not key:
        return ""
    return transpose_chord(key, 0)


def is_minor(key: str) -> bool:
    return bool(re.match(r"^[A-G][b#]?m(?!aj)", key or ""))


def transposition_change(key: str, target_key: str) -> int:
    a, b = base_chord(key), base_chord(target_key)
    if a is None or b is None:
        return 0
    return BASE_CHORDS.index(b[1]) - BASE_CHORDS.index(a[1])


def key_options(key: str) -> list[str]:
    return MINOR_KEYS if is_minor(key) else MAJOR_KEYS
