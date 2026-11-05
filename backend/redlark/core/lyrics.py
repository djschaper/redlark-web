"""Lyrics-only projection of a song: no chords, no chord-only lines/sections, joined syllables."""

from __future__ import annotations

import re

from .model import Line, Section, Segment

_SYLLABLE_SPLIT = re.compile(r"(?<=\w)\s*-\s+(?=\w)|(?<=\w)\s+-\s*(?=\w)")


def clean_lyric(text: str) -> str:
    text = _SYLLABLE_SPLIT.sub("", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def lyrics_only(sections: list[Section]) -> list[Section]:
    out = []
    for s in sections:
        lines = []
        for ln in s.lines:
            if ln.kind == "comment":
                continue
            text = clean_lyric(ln.lyric_text)
            if text:
                lines.append(Line([Segment("", text)]))
        if lines:
            out.append(Section(s.code, s.kind, s.label, lines))
    return out
