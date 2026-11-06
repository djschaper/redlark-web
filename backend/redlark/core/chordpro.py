"""ChordPro import/export.

Import builds Sections (inline ``[G]`` chords) and stores them on the Song as OpenSong lyrics
text, which stays the canonical representation. Export goes the other way.

OpenSong -> ChordPro -> OpenSong is lossless: lyric spacing and syllable hyphens ("be - fore")
are kept verbatim, chord-only lines become inline chords with their spacing ("[|] [C] [.]  [F/C]"),
several authors become several ``{artist}`` lines, and OpenSong fields ChordPro has no directive
for travel as ``{meta: opensong.<field> <value>}``.
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
    "a": "artist",
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
    "verse",
    "chorus",
    "pre-chorus",
    "pre chorus",
    "prechorus",
    "bridge",
    "intro",
    "outro",
    "ending",
    "tag",
    "instrumental",
    "interlude",
    "turnaround",
    "refrain",
    "coda",
)
AUTHOR_SEPARATOR = " | "
META_PREFIX = "opensong."
# Song attributes exported as {meta: opensong.<name> ...} (the rest have real ChordPro directives).
_META_SONG_FIELDS = ("link_youtube", "notes", "uuid", "last_modified")


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
    return Line(segs)


def _looks_like_label(text: str) -> bool:
    low = text.strip().lower().rstrip(":")
    return any(low.startswith(w) for w in _KNOWN_SECTION_WORDS) and len(low) <= 24


def _escape_meta(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\r\n", "\n").replace("\n", "\\n")


def _unescape_meta(value: str) -> str:
    return re.sub(r"\\(.)", lambda m: "\n" if m.group(1) == "n" else m.group(1), value)


# ------------------------------------------------------------------ CCLI footer

_FOOTER_START = re.compile(r"^\s*CCLI\b", re.IGNORECASE)


def split_ccli_footer(lines: list[str]) -> tuple[list[str], list[str]]:
    """Split off a SongSelect footer ("CCLI Song # ...", copyright, licence lines).

    It counts as a footer only when it starts with "CCLI" and is separated from the song by at least
    two blank lines (whitespace-only lines are blank). Working on the raw ChordPro text means a
    chord-only line such as ``[|] [C] [|]`` is never mistaken for a blank line.
    """
    for k, line in enumerate(lines):
        if not _FOOTER_START.match(line):
            continue
        start = k
        while start > 0 and not lines[start - 1].strip():
            start -= 1
        if k - start >= 2 and any(ln.strip() for ln in lines[:start]):
            return lines[:start], lines[k:]
    return lines, []


def _apply_footer(song: Song, footer: list[str]) -> None:
    for line in footer:
        text = line.strip()
        m = re.match(r"CCLI\s+Song\s*#?\s*(\d+)", text, re.IGNORECASE)
        if m and not song.ccli:
            song.ccli = m.group(1)
        elif text.startswith(("©", "(c)", "Copyright")) and not song.copyright:
            song.copyright = re.sub(r"^(©|\(c\)|Copyright)\s*", "", text, flags=re.IGNORECASE)


# ------------------------------------------------------------------ import


def parse_chordpro(text: str, fallback_title: str = "") -> Song:
    song = Song()
    sections: list[Section] = []
    authors: list[str] = []
    exact_author = ""  # {meta: opensong.author ...}: the original text, when re-joining would alter it
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

    lines, footer = split_ccli_footer((text or "").replace("\r\n", "\n").split("\n"))

    for raw in lines:
        line = raw.rstrip()
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        m = _DIRECTIVE.match(stripped)
        if m:
            name = m.group(1).lower()
            name = _ALIASES.get(name, name)
            arg = m.group(2) or ""
            if name == "meta":
                # {meta: name value}: our own opensong.* fields, or standard metadata names.
                meta_name, _, value = arg.partition(" ")
                meta_name = meta_name.lower()
                if meta_name.startswith(META_PREFIX):
                    field = meta_name[len(META_PREFIX) :]
                    value = _unescape_meta(value)
                    if field == "author":
                        exact_author = value
                    elif field in _META_SONG_FIELDS:
                        setattr(song, field, value)
                    else:
                        song.extra[field] = value
                    continue
                name, arg = _ALIASES.get(meta_name, meta_name), value
            if name in _META:
                if _META[name] == "author":
                    if arg and arg not in authors:
                        authors.append(arg)
                elif not getattr(song, _META[name]):
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

    if authors:
        song.author = AUTHOR_SEPARATOR.join(authors)
    if exact_author:
        song.author = exact_author
    _apply_footer(song, footer)
    if not song.title:
        song.title = fallback_title
    song.lyrics = sections_to_lyrics(sections)
    if not song.uuid:
        song.uuid = stable_uuid(song.title)
    return song


# ------------------------------------------------------------------ export


def _line_to_chordpro(line: Line) -> str:
    if line.kind == "comment":
        return "{comment: " + line.lyric_text.strip() + "}"
    # Verbatim: keep the spacing and syllable hyphens so converting back gives the same columns.
    return "".join((f"[{seg.chord}]" if seg.chord else "") + seg.lyric for seg in line.segments).rstrip()


_ENV = {"chorus": "chorus", "verse": "verse", "bridge": "bridge"}


def song_to_chordpro(song: Song) -> str:
    out = [f"{{title: {song.title}}}"]
    authors = [a.strip() for a in song.author.split("|") if a.strip()]
    out.extend(f"{{artist: {a}}}" for a in authors)
    if song.author and AUTHOR_SEPARATOR.join(authors) != song.author:
        # Odd spacing around "|" (e.g. non-breaking spaces): keep the exact original too.
        out.append(f"{{meta: {META_PREFIX}author {_escape_meta(song.author)}}}")
    for directive, attr in (
        ("key", "key"),
        ("tempo", "tempo"),
        ("time", "time_sig"),
        ("capo", "capo"),
        ("ccli", "ccli"),
        ("copyright", "copyright"),
    ):
        val = getattr(song, attr)
        if val:
            out.append(f"{{{directive}: {val}}}")
    for field in _META_SONG_FIELDS:
        val = getattr(song, field)
        if val:
            out.append(f"{{meta: {META_PREFIX}{field} {_escape_meta(val)}}}")
    for field, val in song.extra.items():
        if val:
            out.append(f"{{meta: {META_PREFIX}{field} {_escape_meta(val)}}}")
    for sec in parse_lyrics(song.lyrics):
        out.append("")
        env = _ENV.get(sec.kind, "verse")
        out.append(f"{{start_of_{env}: {sec.label}}}")
        out.extend(_line_to_chordpro(line) for line in sec.lines)
        out.append(f"{{end_of_{env}}}")
    return "\n".join(out) + "\n"
