"""A library stored in SQL (one ``Library`` row; many libraries share the same database)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from ..core.model import SetItem, Song, SongSet
from ..core.opensong import now_iso, stable_uuid
from ..db.models import Library, SetItemRow, SetRow, SongRow
from .base import NotFound, SetSummary, SongSummary

_SONG_COLS = (
    "title", "author", "copyright", "ccli", "key", "tempo", "time_sig", "capo", "link_youtube", "notes",
    "lyrics", "uuid", "last_modified", "extra", "field_order",
)


def row_to_song(row: SongRow) -> Song:
    return Song(**{c: (getattr(row, c) or ({} if c == "extra" else [] if c == "field_order" else "")) for c in _SONG_COLS})


class SqlStore:
    def __init__(self, sessions: sessionmaker, library_id: str, read_only: bool = False):
        self.sessions = sessions
        self.library_id = library_id
        self.read_only = read_only

    @classmethod
    def ensure_library(cls, sessions: sessionmaker, name: str, library_id: str | None = None) -> str:
        with sessions() as db:
            lib = db.get(Library, library_id) if library_id else db.scalar(select(Library).limit(1))
            if lib is None:
                lib = Library(id=library_id, name=name) if library_id else Library(name=name)
                db.add(lib)
                db.commit()
            return lib.id

    def _check_writable(self) -> None:
        if self.read_only:
            raise PermissionError("This library is read-only")

    def _song_row(self, db: Session, song_id: str) -> SongRow:
        row = db.get(SongRow, song_id)
        if row is None or row.library_id != self.library_id:
            raise NotFound(song_id)
        return row

    def _set_row(self, db: Session, set_id: str) -> SetRow:
        row = db.get(SetRow, set_id)
        if row is None or row.library_id != self.library_id:
            raise NotFound(set_id)
        return row

    # ------------------------------------------------------------ songs
    def list_songs(self) -> list[SongSummary]:
        with self.sessions() as db:
            rows = db.execute(
                select(SongRow.id, SongRow.title, SongRow.author, SongRow.key, SongRow.uuid, SongRow.last_modified)
                .where(SongRow.library_id == self.library_id)
                .order_by(func.lower(SongRow.title))
            ).all()
            return [SongSummary(*r) for r in rows]

    def get_song(self, song_id: str) -> Song:
        with self.sessions() as db:
            return row_to_song(self._song_row(db, song_id))

    def find_song_id(self, *, uuid: str = "", title: str = "") -> str | None:
        with self.sessions() as db:
            q = select(SongRow.id).where(SongRow.library_id == self.library_id)
            if uuid:
                hit = db.scalar(q.where(SongRow.uuid == uuid))
                if hit:
                    return hit
            if title:
                return db.scalar(q.where(func.lower(SongRow.title) == title.strip().lower()))
            return None

    def save_song(self, song: Song, song_id: str | None = None, *, keep_timestamp: bool = False) -> str:
        self._check_writable()
        if not song.uuid:
            song.uuid = stable_uuid(song.title)
        if not keep_timestamp or not song.last_modified:
            song.last_modified = now_iso()
        with self.sessions() as db:
            if song_id:
                row = self._song_row(db, song_id)
            else:
                existing = db.scalar(
                    select(SongRow).where(SongRow.library_id == self.library_id, SongRow.uuid == song.uuid)
                )
                row = existing or SongRow(library_id=self.library_id)
                if existing is None:
                    db.add(row)
            for c in _SONG_COLS:
                setattr(row, c, getattr(song, c))
            db.commit()
            return row.id

    def delete_song(self, song_id: str) -> None:
        self._check_writable()
        with self.sessions() as db:
            db.delete(self._song_row(db, song_id))
            db.commit()

    # ------------------------------------------------------------ sets
    def list_sets(self) -> list[SetSummary]:
        with self.sessions() as db:
            rows = db.execute(
                select(SetRow.id, SetRow.name, SetRow.last_modified)
                .where(SetRow.library_id == self.library_id)
                .order_by(SetRow.name.desc())
            ).all()
            return [SetSummary(*r) for r in rows]

    def get_set(self, set_id: str) -> SongSet:
        with self.sessions() as db:
            row = self._set_row(db, set_id)
            items = []
            for it in row.items:
                name = it.name
                if it.song_id:
                    song = db.get(SongRow, it.song_id)
                    name = song.title if song else name
                items.append(SetItem(name=name, key=it.key, type=it.type, song_id=it.song_id or "", attrs=it.attrs or {}))
            return SongSet(name=row.name, items=items, last_modified=row.last_modified)

    def save_set(self, song_set: SongSet, set_id: str | None = None, *, keep_timestamp: bool = False) -> str:
        self._check_writable()
        with self.sessions() as db:
            if set_id:
                row = self._set_row(db, set_id)
            else:
                row = db.scalar(
                    select(SetRow).where(SetRow.library_id == self.library_id, SetRow.name == song_set.name)
                )
                if row is None:
                    row = SetRow(library_id=self.library_id)
                    db.add(row)
            row.name = song_set.name
            row.last_modified = song_set.last_modified if keep_timestamp and song_set.last_modified else now_iso()
            row.items.clear()
            db.flush()
            for pos, item in enumerate(song_set.items):
                song_id = item.song_id or None
                if song_id and (s := db.get(SongRow, song_id)) is not None and s.library_id != self.library_id:
                    song_id = None
                row.items.append(
                    SetItemRow(position=pos, song_id=song_id, name=item.name, key=item.key, type=item.type, attrs=item.attrs)
                )
            db.commit()
            return row.id

    def delete_set(self, set_id: str) -> None:
        self._check_writable()
        with self.sessions() as db:
            db.delete(self._set_row(db, set_id))
            db.commit()
