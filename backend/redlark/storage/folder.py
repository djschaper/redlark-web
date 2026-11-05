"""A library backed directly by an OpenSong folder (``Songs/`` and ``Sets/``), as v1 did.

Song and set ids are their file names. Files are re-read only when their mtime/size change, so a
library on a synced drive (e.g. Google Drive) stays cheap to list.
"""

from __future__ import annotations

import copy
import os
import re
import threading
from datetime import UTC
from pathlib import Path

from ..core.model import Song, SongSet
from ..core.opensong import now_iso, parse_set_xml, parse_song_xml, set_to_xml, song_to_xml
from .base import NotFound, SetSummary, SongSummary

SONGS_SUB_FOLDER = "Songs"
SETS_SUB_FOLDER = "Sets"
_BAD_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def safe_filename(name: str) -> str:
    name = _BAD_CHARS.sub("", name).strip().rstrip(".")
    # OpenSong song/set files have no extension; v1 skipped any file containing a dot.
    name = name.replace(".", "")
    return name or "Untitled"


def _mtime_iso(p: Path) -> str:
    from datetime import datetime

    ts = datetime.fromtimestamp(p.stat().st_mtime, UTC)
    return ts.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _set_mtime(p: Path, iso: str) -> None:
    from datetime import datetime

    try:
        ts = datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()
        os.utime(p, (ts, ts))
    except ValueError:
        pass


def _is_entry(p: Path) -> bool:
    return p.is_file() and "." not in p.name


class FolderStore:
    def __init__(self, root: str | os.PathLike, set_song_path: str = "/", read_only: bool = False):
        self.root = Path(root)
        self.set_song_path = set_song_path or "/"
        self.read_only = read_only
        self._cache: dict[Path, tuple[tuple[float, int], object]] = {}
        self._lock = threading.Lock()

    @property
    def songs_dir(self) -> Path:
        return self.root / SONGS_SUB_FOLDER

    @property
    def sets_dir(self) -> Path:
        return self.root / SETS_SUB_FOLDER

    # ------------------------------------------------------------ helpers
    def _cached(self, path: Path, loader):
        st = path.stat()
        sig = (st.st_mtime, st.st_size)
        with self._lock:
            hit = self._cache.get(path)
            if hit and hit[0] == sig:
                return hit[1]
        value = loader(path)
        with self._lock:
            self._cache[path] = (sig, value)
        return value

    def _song_path(self, song_id: str) -> Path:
        p = self.songs_dir / song_id
        if p.parent != self.songs_dir or not _is_entry(p):
            raise NotFound(song_id)
        return p

    def _set_path(self, set_id: str) -> Path:
        p = self.sets_dir / set_id
        if p.parent != self.sets_dir or not _is_entry(p):
            raise NotFound(set_id)
        return p

    def _load_song(self, path: Path) -> Song:
        def load(p: Path) -> Song:
            song = parse_song_xml(p.read_bytes(), p.name)
            if not song.last_modified:
                song.last_modified = _mtime_iso(p)
            return song

        return self._cached(path, load)

    def _check_writable(self) -> None:
        if self.read_only:
            raise PermissionError("This library is read-only")

    # ------------------------------------------------------------ songs
    def list_songs(self) -> list[SongSummary]:
        if not self.songs_dir.is_dir():
            return []
        out = []
        for p in self.songs_dir.iterdir():
            if not _is_entry(p):
                continue
            try:
                s = self._load_song(p)
                out.append(SongSummary(p.name, p.name, s.author, s.key, s.uuid, s.last_modified))
            except Exception:  # unreadable file: still list it by name
                out.append(SongSummary(p.name, p.name))
        out.sort(key=lambda s: s.title.lower())
        return out

    def get_song(self, song_id: str) -> Song:
        return copy.deepcopy(self._load_song(self._song_path(song_id)))

    def find_song_id(self, *, uuid: str = "", title: str = "") -> str | None:
        songs = self.list_songs()
        if uuid:
            for s in songs:
                if s.uuid == uuid:
                    return s.id
        if title:
            want = title.strip().lower()
            for s in songs:
                if s.title.lower() == want:
                    return s.id
        return None

    def save_song(self, song: Song, song_id: str | None = None, *, keep_timestamp: bool = False) -> str:
        self._check_writable()
        self.songs_dir.mkdir(parents=True, exist_ok=True)
        new_id = safe_filename(song.title)
        if song_id and song_id != new_id:
            # Title changed: rename the file, keeping the old one if the new name is taken.
            old = self._song_path(song_id)
            if (self.songs_dir / new_id).exists():
                new_id = song_id
            else:
                old.unlink()
        elif not song_id and (self.songs_dir / new_id).exists():
            base, n = new_id, 2
            while (self.songs_dir / f"{base} ({n})").exists():
                n += 1
            new_id = f"{base} ({n})"
        if not keep_timestamp or not song.last_modified:
            song.last_modified = now_iso()
        (self.songs_dir / new_id).write_text(song_to_xml(song), encoding="utf-8")
        return new_id

    def delete_song(self, song_id: str) -> None:
        self._check_writable()
        self._song_path(song_id).unlink()

    # ------------------------------------------------------------ sets
    def list_sets(self) -> list[SetSummary]:
        if not self.sets_dir.is_dir():
            return []
        out = [SetSummary(p.name, p.name, _mtime_iso(p)) for p in self.sets_dir.iterdir() if _is_entry(p)]
        out.sort(key=lambda s: s.name, reverse=True)
        return out

    def get_set(self, set_id: str) -> SongSet:
        path = self._set_path(set_id)
        song_set: SongSet = copy.deepcopy(self._cached(path, lambda p: parse_set_xml(p.read_bytes(), p.name)))
        song_set.last_modified = _mtime_iso(path)
        names = {s.id for s in self.list_songs()}
        for item in song_set.items:
            item.song_id = item.name if item.name in names else ""
        return song_set

    def save_set(self, song_set: SongSet, set_id: str | None = None, *, keep_timestamp: bool = False) -> str:
        self._check_writable()
        self.sets_dir.mkdir(parents=True, exist_ok=True)
        new_id = safe_filename(song_set.name)
        for item in song_set.items:
            if item.song_id:
                item.name = item.song_id
        target = self.sets_dir / new_id
        target.write_text(set_to_xml(song_set, self.set_song_path), encoding="utf-8")
        if keep_timestamp and song_set.last_modified:
            _set_mtime(target, song_set.last_modified)
        if set_id and set_id != new_id:
            try:
                self._set_path(set_id).unlink()
            except NotFound:
                pass
        return new_id

    def delete_set(self, set_id: str) -> None:
        self._check_writable()
        self._set_path(set_id).unlink()
