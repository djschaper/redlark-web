"""ChordPro import/export.

Import builds Sections (inline ``[G]`` chords) and stores them on the Song as OpenSong lyrics
text, which stays the canonical representation. Export goes the other way.
"""

from __future__ import annotations

import re

from .model import Line, Section, Segment, Song
from .opensong import header_code, parse_header, parse_lyrics, sections_to_lyrics, stable_uuid

_DIRECTIVE = re.compile(r"^\{\s*([A-Za-z_]+)\s*(?:[:\s]\s*(.*?))?\s*\}\s*$")
_CHORD = re.compile(r"\[([^\]]*)\]")

_ALIASES = {
    "t": "title",
    "st": "subtitle",
    "c": "comment",
    "ci": "comment_italic",
    "cb": "comment_box",
    "soc": "start_of_chorus",
    "eoc": "end_of_chorus",
    "sov": "start_of_verse",
    "eov": "end_of_verse",
    "sob": "start_of_bridge",
    "eob": "end_of_bridge",
    "sot": "start_of_tab",
    "eot": "end_of_tab",
    "sog": "start_of_grid",
    "eog": "end_of_grid",
}
_META = {
    "title": "title",
    "artist": "author",
    "composer": "author",
    "lyricist": "author",
    "copyright": "copyright",
    "ccli": "ccli",
    "key": "key",
    "tempo": "tempo",
    "time": "time_sig",
    "capo": "capo",
}
_KNOWN_SECTION_WORDS = (
    "verse", "chorus", "pre-chorus", "prechorus", "bridge", "intro", "outro", "ending", "tag",
    "instrumental", "interlude", "turnaround", "refrain", "coda",
)


def _parse_label(arg: str | None) -> str:
    if not arg:
        return ""
    m = re.search(r'label\s*=\s*"([^"]*)"', arg)
    return m.group(1) if m else arg.strip()


def _parse_line(text: str) -> Line:
    segs: list[Segment] = []
    pos = 0
    pending_chord = ""
    for m in _CHORD.finditer(text):
        lyric = text[pos : m.start()]
        if lyric or pending_chord:
            segs.append(Segment(pending_chord, lyric))
        pending_chord = m.group(1).strip()
        pos = m.end()
    tail = text[pos:]
    if tail or pending_chord:
        segs.append(Segment(pending_chord, tail))
    # Give chords that sit directly before another chord a trailing space so they don't collide.
    return Line(segs)


def _looks_like_label(text: str) -> bool:
    low = text.strip().lower().rstrip(":")
    return any(low.startswith(w) for w in _KNOWN_SECTION_WORDS) and len(low) <= 24


def parse_chordpro(text: str, fallback_title: str = "") -> Song:
    song = Song()
    sections: list[Section] = []
    current: Section | None = None
    in_env = False
    in_tab = False
    pending_label = ""
    verse_count = 0
    chorus_sections: list[Section] = []

    def new_section(kind: str, label: str) -> Section:
        nonlocal current, verse_count
        if not label:
            if kind == "verse":
                verse_count += 1
                label = f"Verse {verse_count}"
            else:
                label = kind.replace("_", " ").title()
        k, lab = parse_header(label)
        if kind in ("chorus", "verse", "bridge") and k != kind and not _looks_like_label(label):
            k = kind
        sec = Section(code="", kind=k, label=lab)
        sec.code = header_code(sec)
        sections.append(sec)
        current = sec
        if k == "chorus":
            chorus_sections.append(sec)
        return sec

    for raw in (text or "").replace("\r\n", "\n").split("\n"):
        line = raw.rstrip()
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        m = _DIRECTIVE.match(stripped)
        if m:
            name = m.group(1).lower()
            name = _ALIASES.get(name, name)
            arg = m.group(2) or ""
            if name in _META:
                cur = getattr(song, _META[name])
                if _META[name] == "author" and cur and arg not in cur:
                    setattr(song, "author", f"{cur}, {arg}")
                elif not cur:
                    setattr(song, _META[name], arg)
            elif name.startswith("start_of_"):
                kind = name[len("start_of_") :]
                in_tab = kind in ("tab", "grid")
                new_section("instrumental" if in_tab else kind, _parse_label(arg) or pending_label)
                pending_label = ""
                in_env = True
            elif name.startswith("end_of_"):
                in_env = in_tab = False
                current = None
            elif name == "chorus":
                # Recall the last chorus.
                if chorus_sections:
                    src = chorus_sections[-1]
                    sections.append(Section(src.code, src.kind, src.label, list(src.lines)))
                current = None
            elif name.startswith("comment"):
                if not in_env and _looks_like_label(arg):
                    pending_label = arg.strip().rstrip(":")
                    current = None
                else:
                    if current is None:
                        new_section("verse", pending_label)
                        pending_label = ""
                    current.lines.append(Line([Segment("", arg)], kind="comment"))
            continue

        if not stripped:
            if not in_env:
                current = None
            continue
        if not in_env and current is None and _looks_like_label(stripped) and "[" not in stripped:
            # Plain-text label line like "Verse 1" or "Chorus:".
            pending_label = stripped.rstrip(":")
            continue
        if current is None:
            new_section("verse", pending_label)
            pending_label = ""
        if in_tab:
            current.lines.append(Line([Segment(stripped, "")]))
        else:
            current.lines.append(_parse_line(line))

    if not song.title:
        song.title = fallback_title
    song.lyrics = sections_to_lyrics(sections)
    song.uuid = stable_uuid(song.title)
    return song


def _line_to_chordpro(line: Line) -> str:
    if line.kind == "comment":
        return "{comment: " + line.lyric_text.strip() + "}"
    out = ""
    for seg in line.segments:
        if seg.chord:
            out += f"[{seg.chord}]"
        out += seg.lyric
    # Join syllables split for chord spacing ("be - [G]fore" -> "be[G]fore").
    out = re.sub(r"(?<=\w)\s*-\s+((?:\[[^\]]*\])*)(?=\w)", r"\1", out)
    out = re.sub(r" {2,}", " ", out)
    return out.strip()


_ENV = {"chorus": "chorus", "verse": "verse", "bridge": "bridge"}


def song_to_chordpro(song: Song) -> str:
    out = [f"{{title: {song.title}}}"]
    if song.author:
        out.append(f"{{artist: {song.author}}}")
    for directive, attr in (("key", "key"), ("tempo", "tempo"), ("time", "time_sig"), ("capo", "capo"),
                            ("ccli", "ccli"), ("copyright", "copyright")):
        val = getattr(song, attr)
        if val:
            out.append(f"{{{directive}: {val}}}")
    for sec in parse_lyrics(song.lyrics):
        out.append("")
        env = _ENV.get(sec.kind, "verse")
        chord_only = sec.lines and all(not ln.lyric_text.strip() for ln in sec.lines)
        if chord_only:
            env = "grid"
        out.append(f"{{start_of_{env}: {sec.label}}}")
        for line in sec.lines:
            if chord_only:
                out.append(" ".join(s.chord for s in line.segments if s.chord))
            else:
                out.append(_line_to_chordpro(line))
        out.append(f"{{end_of_{env}}}")
    return "\n".join(out) + "\n"
