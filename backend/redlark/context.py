"""Resolves which library stores a request may use, in server (hosted) or local (desktop) mode."""

from __future__ import annotations

import threading
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from .auth import membership_role
from .config import Settings
from .db.models import Library, Membership, User
from .db.session import create_all, make_engine, make_sessionmaker
from .local_settings import LocalLibrary, LocalSettingsStore
from .storage.base import LibraryStore
from .storage.folder import FolderStore
from .storage.sql import SqlStore


@dataclass
class LibraryInfo:
    id: str
    name: str
    role: str  # viewer | editor | owner
    kind: str  # sql | folder | sqlite
    path: str = ""


class AppContext:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.mode = settings.mode
        self.sessions: sessionmaker | None = None
        self.local: LocalSettingsStore | None = None
        self._local_stores: dict[str, tuple[str, LibraryStore]] = {}
        self._lock = threading.Lock()
        if self.mode == "server":
            engine = make_engine(settings.database_url)
            if settings.database_url.startswith("sqlite"):
                create_all(engine)
            self.sessions = make_sessionmaker(engine)
        else:
            self.local = LocalSettingsStore(settings.data_dir)

    # ------------------------------------------------------------ local mode
    def _open_local(self, lib: LocalLibrary) -> LibraryStore:
        if lib.kind == "folder":
            return FolderStore(lib.path, set_song_path=lib.set_song_path)
        path = Path(lib.path)
        path.parent.mkdir(parents=True, exist_ok=True)
        engine = make_engine(f"sqlite:///{path}")
        create_all(engine)
        sessions = make_sessionmaker(engine)
        lib_id = SqlStore.ensure_library(sessions, lib.name)
        return SqlStore(sessions, lib_id)

    def local_store(self, lib: LocalLibrary) -> LibraryStore:
        sig = lib.model_dump_json()
        with self._lock:
            cached = self._local_stores.get(lib.id)
            if cached and cached[0] == sig:
                return cached[1]
            store = self._open_local(lib)
            self._local_stores[lib.id] = (sig, store)
            return store

    # ------------------------------------------------------------ both modes
    def libraries_for(self, user: User | None) -> list[LibraryInfo]:
        if self.mode == "local":
            assert self.local
            return [LibraryInfo(lib.id, lib.name, "owner", lib.kind, lib.path) for lib in self.local.load().libraries]
        assert self.sessions and user
        with self.sessions() as db:
            if user.is_admin:
                libs = db.scalars(select(Library).order_by(Library.name)).all()
                return [LibraryInfo(lib.id, lib.name, "owner", "sql") for lib in libs]
            rows = db.execute(
                select(Library, Membership.role)
                .join(Membership, Membership.library_id == Library.id)
                .where(Membership.user_id == user.id)
                .order_by(Library.name)
            ).all()
            return [LibraryInfo(lib.id, lib.name, role, "sql") for lib, role in rows]

    def store_for(self, library_id: str, user: User | None) -> tuple[LibraryStore, str] | None:
        """Return (store, role) or None if the library doesn't exist / isn't accessible."""
        if self.mode == "local":
            assert self.local
            for lib in self.local.load().libraries:
                if lib.id == library_id:
                    return self.local_store(lib), "owner"
            return None
        assert self.sessions
        if user is None:
            return None
        with self.sessions() as db:
            lib = db.get(Library, library_id)
            if lib is None:
                return None
            role = membership_role(db, user, library_id)
            if role is None:
                return None
            return SqlStore(self.sessions, library_id, read_only=(role == "viewer")), role
