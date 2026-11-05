"""Library storage interface, shared by the OpenSong-folder and SQL stores."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Protocol

from ..core.model import Song, SongSet


class NotFound(KeyError):
    pass


@dataclass
class SongSummary:
    id: str
    title: str
    author: str = ""
    key: str = ""
    uuid: str = ""
    last_modified: str = ""


@dataclass
class SetSummary:
    id: str
    name: str
    last_modified: str = ""


class LibraryStore(Protocol):
    read_only: bool

    def list_songs(self) -> list[SongSummary]: ...
    def get_song(self, song_id: str) -> Song: ...
    def save_song(self, song: Song, song_id: str | None = None, *, keep_timestamp: bool = False) -> str: ...
    def delete_song(self, song_id: str) -> None: ...
    def find_song_id(self, *, uuid: str = "", title: str = "") -> str | None: ...

    def list_sets(self) -> list[SetSummary]: ...
    def get_set(self, set_id: str) -> SongSet: ...
    def save_set(self, song_set: SongSet, set_id: str | None = None, *, keep_timestamp: bool = False) -> str: ...
    def delete_set(self, set_id: str) -> None: ...


def parse_set_date(name: str) -> date | None:
    """Sets named like '2026-10-25' (optionally followed by text) are dated sets."""
    try:
        return date.fromisoformat(name.strip()[:10])
    except ValueError:
        return None


@dataclass
class Recency:
    set_name: str
    index: int  # 0 = the most recent dated set


def song_recency(store: LibraryStore, today: date | None = None) -> dict[str, Recency]:
    """For each song id, the most recent past dated set it appeared in (v1 'recent' dot)."""
    today = today or date.today()
    dated = [
        s for s in store.list_sets() if (d := parse_set_date(s.name)) is not None and d <= today
    ]
    dated.sort(key=lambda s: s.name, reverse=True)
    result: dict[str, Recency] = {}
    for idx, summary in enumerate(dated):
        try:
            song_set = store.get_set(summary.id)
        except NotFound:
            continue
        for item in song_set.items:
            if item.song_id and item.song_id not in result:
                result[item.song_id] = Recency(summary.name, idx)
    return result
