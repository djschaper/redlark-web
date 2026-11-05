"""Process-level configuration (environment variables, prefix ``REDLARK_``)."""

from __future__ import annotations

import os
import sys
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


def user_data_dir() -> Path:
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
        return base / "Redlark"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "Redlark"
    return Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "redlark"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="REDLARK_", env_file=".env", extra="ignore")

    # "server": hosted multi-user app (auth + SQL libraries).
    # "local": desktop/offline app (no auth, libraries configured in the local settings file).
    mode: Literal["server", "local"] = "local"
    database_url: str = "sqlite:///./redlark.db"
    data_dir: Path = user_data_dir()
    # Public URL the server can reach itself on (Playwright loads print pages from it).
    internal_url: str = ""
    cookie_secure: bool = False
    allow_signup: bool = False
    session_days: int = 30
    # Browser channel for PDF rendering: "chromium" (bundled with Playwright) or "msedge"/"chrome".
    pdf_browser_channel: str = ""
    static_dir: Path | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
