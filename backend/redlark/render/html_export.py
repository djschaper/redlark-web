"""Self-contained HTML documents built from the single-file Vue viewer (frontend/standalone).

The viewer bundle (``static/standalone.html``) contains all JS/CSS inline and reads its data from
``<script id="redlark-data" type="application/json">``. The same document is used for PDF output.
"""

from __future__ import annotations

import html
import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from ..config import get_settings

DATA_MARKER = '<script id="redlark-data" type="application/json"></script>'


def static_dir() -> Path:
    configured = get_settings().static_dir
    return Path(configured) if configured else Path(__file__).resolve().parents[1] / "static"


@lru_cache(maxsize=4)
def _template(path: str, mtime: float) -> str:
    return Path(path).read_text(encoding="utf-8")


def viewer_template() -> str:
    path = static_dir() / "standalone.html"
    if not path.exists():
        raise FileNotFoundError(
            f"{path} is missing. Build the frontend first: `npm run build` in frontend/."
        )
    return _template(str(path), path.stat().st_mtime)


def build_document(
    songs: list[dict[str, Any]],
    *,
    title: str,
    mode: Literal["chords", "lyrics"] = "chords",
    print_mode: bool = False,
    dark: bool = False,
) -> str:
    data = {"title": title, "songs": songs, "mode": mode, "print": print_mode, "dark": dark}
    # Escape "</" so song text can never close the script tag.
    blob = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    doc = viewer_template()
    doc = doc.replace("<title>Redlark</title>", f"<title>{html.escape(title)}</title>", 1)
    return doc.replace(DATA_MARKER, f'<script id="redlark-data" type="application/json">{blob}</script>', 1)
