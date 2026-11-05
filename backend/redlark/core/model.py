"""The song/set data model shared by every parser, store, renderer and API.

A ``Song`` keeps its lyrics canonically as OpenSong-format text (``lyrics``), since the
primary library is an OpenSong folder and that guarantees lossless round-trips. The parsed
form (``sections``) is derived from it with :func:`redlark.core.opensong.parse_lyrics`.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

LineKind = Literal["music", "comment"]


@dataclass
class Segment:
    """A chord and the lyric text it sits above. Either may be empty."""

    chord: str = ""
    lyric: str = ""


@dataclass
class Line:
    segments: list[Segment] = field(default_factory=list)
    kind: LineKind = "music"

    @property
    def has_chords(self) -> bool:
        return any(s.chord for s in self.segments)

    @property
    def lyric_text(self) -> str:
        return "".join(s.lyric for s in self.segments)


@dataclass
class Section:
    code: str  # OpenSong header text without brackets, e.g. "V1", "C1b", "Turnaround 1"
    kind: str  # lowercase type: verse, chorus, pre-chorus, bridge, intro, tag, instrumental, ...
    label: str  # human title, e.g. "Verse 1", "Chorus 1b", "Turnaround 1"
    lines: list[Line] = field(default_factory=list)

    @property
    def indented(self) -> bool:
        return self.kind == "chorus"


@dataclass
class Song:
    title: str = ""
    author: str = ""
    copyright: str = ""
    ccli: str = ""
    key: str = ""
    tempo: str = ""
    time_sig: str = ""
    capo: str = ""
    link_youtube: str = ""
    notes: str = ""
    lyrics: str = ""  # OpenSong-format lyrics text (canonical)
    uuid: str = ""
    last_modified: str = ""  # ISO-8601
    # Any other OpenSong fields, preserved in document order for lossless export.
    extra: dict[str, str] = field(default_factory=dict)
    field_order: list[str] = field(default_factory=list)  # original XML element order

    META_FIELDS = (
        "title",
        "author",
        "copyright",
        "ccli",
        "key",
        "tempo",
        "time_sig",
        "capo",
        "link_youtube",
        "notes",
    )

    def meta(self) -> dict[str, str]:
        return {f: getattr(self, f) for f in self.META_FIELDS}

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        return d


@dataclass
class SetItem:
    name: str  # song name (OpenSong file name / title)
    key: str = ""
    type: str = "song"
    song_id: str = ""  # store-specific id, filled in by stores
    attrs: dict[str, str] = field(default_factory=dict)  # other slide_group attributes


@dataclass
class SongSet:
    name: str
    items: list[SetItem] = field(default_factory=list)
    last_modified: str = ""
