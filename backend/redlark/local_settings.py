"""Desktop/offline settings: which libraries exist locally, connection mode, display defaults."""

from __future__ import annotations

import json
import os
import threading
import uuid
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


class LocalLibrary(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    name: str
    kind: Literal["folder", "sqlite"]
    path: str  # OpenSong folder (containing Songs/ and Sets/) or .db file
    set_song_path: str = "/"
    # Online library this one syncs with, if any.
    remote_url: str = ""
    remote_library_id: str = ""
    last_sync: str = ""


class LocalSettings(BaseModel):
    connection: Literal["offline", "online"] = "offline"
    online_url: str = ""
    display_mode: Literal["light", "dark"] = "light"
    default_view: Literal["chords", "lyrics"] = "chords"
    libraries: list[LocalLibrary] = Field(default_factory=list)
    active_library: str = ""
    # Session token for the online server, used by sync.
    remote_token: str = ""


class LocalSettingsStore:
    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir)
        self.path = self.data_dir / "settings.json"
        self._lock = threading.Lock()

    def load(self) -> LocalSettings:
        with self._lock:
            if self.path.exists():
                try:
                    return LocalSettings.model_validate_json(self.path.read_text(encoding="utf-8"))
                except ValueError:
                    pass
            settings = LocalSettings()
            self._import_v1(settings)
            return settings

    def save(self, settings: LocalSettings) -> None:
        with self._lock:
            self.data_dir.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(settings.model_dump_json(indent=2), encoding="utf-8")
            tmp.replace(self.path)

    def _import_v1(self, settings: LocalSettings) -> None:
        """Pick up the OpenSong folder and dark mode from Redlark v1's user_settings.json."""
        appdata = os.environ.get("APPDATA")
        if not appdata:
            return
        v1 = Path(appdata) / "redlark" / "user_settings.json"
        if not v1.exists():
            return
        try:
            old = json.loads(v1.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return
        folder = old.get("opensong-folder")
        if folder and folder != "undefined":
            lib = LocalLibrary(
                name="OpenSong",
                kind="folder",
                path=folder,
                set_song_path=old.get("opensong-subfolder") or "/",
            )
            settings.libraries.append(lib)
            settings.active_library = lib.id
        if old.get("display-mode") == "dark":
            settings.display_mode = "dark"
