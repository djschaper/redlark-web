"""JSON payloads consumed by the Vue SongSheet renderer (API, print/PDF and HTML export)."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote_plus

from ..core.chords import key_options, parse_key
from ..core.lyrics import lyrics_only
from ..core.model import Section, Song
from ..core.opensong import parse_lyrics, transpose_song


def sections_json(sections: list[Section]) -> list[dict[str, Any]]:
    return [
        {
            "code": s.code,
            "kind": s.kind,
            "label": s.label,
            "indented": s.indented,
            "lines": [
                {"kind": ln.kind, "segments": [{"chord": g.chord, "lyric": g.lyric} for g in ln.segments]}
                for ln in s.lines
            ],
        }
        for s in sections
    ]


def youtube_url(song: Song) -> str:
    if song.link_youtube:
        return song.link_youtube
    terms = " ".join(t for t in (song.title, song.author) if t)
    return "https://www.youtube.com/results?search_query=" + quote_plus(terms)


def song_payload(song: Song, song_id: str = "", key: str | None = None) -> dict[str, Any]:
    """Full song for rendering. If ``key`` is given the chords are transposed server-side."""
    original_key = parse_key(song.key)
    if key:
        song = transpose_song(song, key)
    sections = parse_lyrics(song.lyrics)
    return {
        "id": song_id,
        "uuid": song.uuid,
        "title": song.title,
        "author": song.author,
        "copyright": song.copyright,
        "ccli": song.ccli,
        "key": parse_key(song.key),
        "original_key": original_key,
        "tempo": song.tempo,
        "time_sig": song.time_sig,
        "capo": song.capo,
        "notes": song.notes,
        "link_youtube": song.link_youtube,
        "youtube_url": youtube_url(song),
        "last_modified": song.last_modified,
        "lyrics": song.lyrics,
        "key_options": key_options(parse_key(song.key)),
        "sections": sections_json(sections),
        "lyrics_sections": sections_json(lyrics_only(sections)),
    }
