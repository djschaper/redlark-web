"""OpenSong song/set file reading & writing, and lyrics text <-> section parsing.

Lyrics format (one line each):
  ``[V1]``   section header
  ``.G   D`` chord line (columns line up with the following lyric line)
  `` text``  lyric line (leading space)
  ``;text``  comment line
"""

from __future__ import annotations

import re
import uuid as uuidlib
import xml.etree.ElementTree as ET
from datetime import UTC, datetime

from .chords import parse_key, transpose_chord
from .model import Line, Section, Segment, SetItem, Song, SongSet

SECTION_ABBREV_TO_TITLES = {
    "I": "Intro",
    "V": "Verse",
    "P": "Pre-Chorus",
    "C": "Chorus",
    "B": "Bridge",
    "E": "Ending",
    "O": "Outro",
    "T": "Tag",
}
TITLE_TO_ABBREV = {v.lower(): k for k, v in SECTION_ABBREV_TO_TITLES.items()}

# Fields mapped onto Song attributes. Everything else is preserved in Song.extra.
_FIELD_MAP = {
    "title": "title",
    "author": "author",
    "copyright": "copyright",
    "ccli": "ccli",
    "key": "key",
    "tempo": "tempo",
    "time_sig": "time_sig",
    "capo": "capo",
    "link_youtube": "link_youtube",
    "notes": "notes",
    "lyrics": "lyrics",
    "uuid": "uuid",
    "last_modified": "last_modified",
}
# Field order used when writing a song that didn't come from an OpenSong file.
_DEFAULT_ORDER = [
    "uuid", "last_modified", "title", "author", "copyright", "presentation", "hymn_number", "capo",
    "tempo", "time_sig", "duration", "predelay", "ccli", "theme", "alttheme", "user1", "user2", "user3",
    "key", "keyoriginal", "aka", "midi", "midi_index", "notes", "lyrics", "pad_file", "custom_chords",
    "link_youtube", "link_web", "link_audio", "loop_audio", "link_other", "abcnotation", "abctranspose",
]
UUID_NAMESPACE = uuidlib.UUID("5b0c6f0e-6b8b-4f7c-9a57-8a1f4f0f9e11")


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def stable_uuid(name: str) -> str:
    """Deterministic uuid for songs whose file lacks one, so the same song matches across libraries."""
    return str(uuidlib.uuid5(UUID_NAMESPACE, name.strip().lower()))


# ---------------------------------------------------------------- song XML


def parse_song_xml(xml: str | bytes, fallback_name: str = "") -> Song:
    root = ET.fromstring(xml)
    if root.tag != "song":
        raise ValueError("Not an OpenSong song file (root element is not <song>)")
    song = Song()
    song.field_order = [el.tag for el in root]
    for el in root:
        text = el.text or ""
        if el.tag in _FIELD_MAP:
            setattr(song, _FIELD_MAP[el.tag], text)
        else:
            song.extra[el.tag] = text
            if el.attrib:
                for k, v in el.attrib.items():
                    song.extra[f"{el.tag}@{k}"] = v
    if not song.title:
        song.title = fallback_name
    if not song.uuid:
        song.uuid = stable_uuid(song.title or fallback_name)
    return song


def song_to_xml(song: Song) -> str:
    root = ET.Element("song")
    values: dict[str, str] = {}
    attrs: dict[str, dict[str, str]] = {}
    for k, v in song.extra.items():
        if "@" in k:
            tag, attr = k.split("@", 1)
            attrs.setdefault(tag, {})[attr] = v
        else:
            values[k] = v
    for tag, attr in _FIELD_MAP.items():
        values[tag] = getattr(song, attr)
    seen = list(song.field_order or _DEFAULT_ORDER)
    for tag in list(_DEFAULT_ORDER) + list(values):
        if tag not in seen and (tag in values):
            seen.append(tag)
    for tag in seen:
        el = ET.SubElement(root, tag, attrs.get(tag, {}))
        el.text = values.get(tag, "")
    ET.indent(root, space="  ")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode") + "\n"


# ---------------------------------------------------------------- lyrics


def parse_header(inner: str) -> tuple[str, str]:
    """'C1b' -> ('chorus', 'Chorus 1b'); 'Turnaround 2' -> ('turnaround', 'Turnaround 2')."""
    inner = inner.strip()
    m = re.fullmatch(r"(\D+?)\s*(\d+[a-z]*)", inner)
    if m:
        type_, num = m.group(1).strip(), m.group(2)
    else:
        type_, num = inner, ""
    title = SECTION_ABBREV_TO_TITLES.get(type_, type_)
    low = title.lower()
    if "pre" in low and "chorus" in low:
        kind = "pre-chorus"
    elif "chorus" in low:
        kind = "chorus"
    else:
        kind = low.split()[0] if low else "section"
    return kind, f"{title} {num}".strip()


_CHORD_TOKEN = re.compile(r"\S+")


def _split_chord_line(chord_line: str, lyric_line: str) -> list[Segment]:
    """Anchor each chord to the lyric text under it (port of v1 generateHTML)."""
    chords = [(m.group(0), m.start()) for m in _CHORD_TOKEN.finditer(chord_line)]
    segs: list[Segment] = []

    def add(chord: str, lyric: str) -> None:
        if chord or lyric:
            segs.append(Segment(chord, lyric))

    end = 0
    for j, (chord, start) in enumerate(chords):
        last = end
        nxt = chords[j + 1][1] if j + 1 < len(chords) else None
        end = start
        if end < len(lyric_line) and lyric_line[end] == " ":
            while end < len(lyric_line) and lyric_line[end] == " " and (nxt is None or end < nxt):
                end += 1
        else:
            while (
                end < len(lyric_line)
                and lyric_line[end] not in " -"
                and (nxt is None or end < nxt)
            ):
                end += 1
        add("", lyric_line[last:start])
        add(chord, lyric_line[start:end])
    add("", lyric_line[end:])
    return segs


def _is_lyric_line(line: str) -> bool:
    return bool(line) and (line[0] == " " or line[0].isdigit())


def parse_lyrics(text: str) -> list[Section]:
    sections: list[Section] = []
    current: Section | None = None
    lines = (text or "").replace("\r\n", "\n").split("\n")

    def ensure() -> Section:
        nonlocal current
        if current is None:
            current = Section(code="", kind="verse", label="")
            sections.append(current)
        return current

    i = 0
    while i < len(lines):
        line = lines[i]
        i += 1
        if not line.strip():
            continue
        c = line[0]
        if c == "[":
            inner = line[1 : line.index("]")] if "]" in line else line[1:]
            kind, label = parse_header(inner)
            current = Section(code=inner.strip(), kind=kind, label=label)
            sections.append(current)
        elif c == ".":
            chord_line = line[1:].rstrip()
            lyric_line = ""
            if i < len(lines) and _is_lyric_line(lines[i]):
                lyric_line = lines[i][1:]
                i += 1
            ensure().lines.append(Line(_split_chord_line(chord_line, lyric_line)))
        elif c == ";":
            ensure().lines.append(Line([Segment("", line[1:].strip())], kind="comment"))
        elif c == "-":
            continue  # page / column breaks
        else:
            lyric = line[1:] if c == " " else line
            if c.isdigit():
                lyric = line[1:]
            ensure().lines.append(Line([Segment("", lyric.replace("||", "").replace("|", ""))]))
    return sections


def header_code(section: Section) -> str:
    if section.code:
        return section.code
    parts = section.label.rsplit(" ", 1)
    title, num = (parts[0], parts[1]) if len(parts) == 2 and parts[1][:1].isdigit() else (section.label, "")
    abbrev = TITLE_TO_ABBREV.get(title.lower())
    if abbrev:
        return f"{abbrev}{num}"
    return f"{title} {num}".strip() or "V"


def _line_to_text(line: Line) -> list[str]:
    if line.kind == "comment":
        return [";" + line.lyric_text]
    if not line.has_chords:
        return [" " + line.lyric_text]
    lyric = ""
    chords = ""
    for seg in line.segments:
        if seg.chord:
            target = len(chords) + 1 if chords else 0
            if len(lyric) < target:
                pad_n = target - len(lyric)
                mid_word = bool(lyric) and lyric[-1].isalnum() and seg.lyric[:1].isalnum()
                lyric += (" - " + " " * max(0, pad_n - 3)) if mid_word else " " * pad_n
            chords = chords.ljust(len(lyric)) + seg.chord
        lyric += seg.lyric
    out = ["." + chords.rstrip()]
    if lyric.strip():
        out.append(" " + lyric)
    return out


def sections_to_lyrics(sections: list[Section]) -> str:
    blocks = []
    for s in sections:
        rows = [f"[{header_code(s)}]"]
        for line in s.lines:
            rows.extend(_line_to_text(line))
        blocks.append("\n".join(rows))
    return "\n\n".join(blocks)


def transpose_sections(sections: list[Section], change: int) -> list[Section]:
    if change % 12 == 0:
        return sections
    return [
        Section(
            s.code,
            s.kind,
            s.label,
            [Line([Segment(transpose_chord(g.chord, change) if g.chord else "", g.lyric) for g in ln.segments], ln.kind) for ln in s.lines],
        )
        for s in sections
    ]


def transpose_song(song: Song, target_key: str) -> Song:
    from dataclasses import replace

    from .chords import transposition_change

    target = parse_key(target_key)
    if not target or not song.key:
        return song
    change = transposition_change(song.key, target)
    if change == 0:
        return replace(song, key=target)
    return replace(song, key=target, lyrics=sections_to_lyrics(transpose_sections(parse_lyrics(song.lyrics), change)))


# ---------------------------------------------------------------- sets


def parse_set_xml(xml: str | bytes, name: str) -> SongSet:
    root = ET.fromstring(xml)
    items = []
    for sg in root.iter("slide_group"):
        attrs = dict(sg.attrib)
        items.append(
            SetItem(
                name=attrs.pop("name", ""),
                key=attrs.pop("key", ""),
                type=attrs.pop("type", "song"),
                attrs=attrs,
            )
        )
    return SongSet(name=name, items=items)


def set_to_xml(song_set: SongSet, default_path: str = "/") -> str:
    root = ET.Element("set")
    groups = ET.SubElement(root, "slide_groups")
    for item in song_set.items:
        attrs = {"name": item.name, "type": item.type or "song", "presentation": "", "path": default_path}
        attrs.update(item.attrs)
        if item.key:
            attrs["key"] = item.key
        ET.SubElement(groups, "slide_group", attrs)
    ET.indent(root, space="    ")
    return ET.tostring(root, encoding="unicode") + "\n"
