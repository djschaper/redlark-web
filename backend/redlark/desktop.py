"""Desktop app: runs the local (offline) server and opens it in a native window via pywebview.

When the local settings say ``connection = "online"`` the window opens the hosted Redlark instead,
so the desktop app behaves exactly like the website. The app menu switches between the two.
"""

from __future__ import annotations

import json
import os
import socket
import threading
import time
import urllib.request

from . import __version__

GITHUB_LATEST = "https://api.github.com/repos/djschaper/redlark-web/releases/latest"
MIN_WIDTH, MIN_HEIGHT = 1200, 700  # same as v1 (src/app.js)


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _start_server(port: int) -> None:
    import uvicorn

    from .app import create_app

    os.environ["REDLARK_MODE"] = "local"
    config = uvicorn.Config(create_app(), host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    threading.Thread(target=server.run, daemon=True).start()
    for _ in range(200):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.1):
                return
        except OSError:
            time.sleep(0.05)
    raise RuntimeError("The local Redlark server did not start")


def _version_tuple(v: str) -> tuple:
    parts = []
    for p in v.lstrip("v").replace("-", ".").split("."):
        parts.append(int(p) if p.isdigit() else -1 if p.startswith(("a", "b", "rc", "alpha", "beta")) else 0)
    return tuple(parts)


def check_for_update() -> dict | None:
    """Return {"version", "url"} if a newer GitHub release exists (desktop builds only)."""
    try:
        req = urllib.request.Request(
            GITHUB_LATEST, headers={"Accept": "application/vnd.github+json", "User-Agent": "Redlark"}
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.load(r)
    except Exception:
        return None
    tag = data.get("tag_name", "")
    if tag and _version_tuple(tag) > _version_tuple(__version__):
        return {"version": tag.lstrip("v"), "url": data.get("html_url", "")}
    return None


class DesktopApi:
    """Functions callable from the page as ``window.pywebview.api.*``."""

    def __init__(self) -> None:
        self._window = None
        self._local_url = ""

    def pick_folder(self) -> str:
        import webview

        result = self._window.create_file_dialog(webview.FOLDER_DIALOG) if self._window else None
        return result[0] if result else ""

    def open_external(self, url: str) -> None:
        import webbrowser

        if url.startswith(("http://", "https://")):
            webbrowser.open(url)

    def update_info(self) -> dict | None:
        return check_for_update()

    def go_offline(self) -> None:
        self._set_connection("offline")
        if self._window:
            self._window.load_url(self._local_url)

    def go_online(self) -> None:
        url = self._set_connection("online")
        if self._window and url:
            self._window.load_url(url)

    def _set_connection(self, mode: str) -> str:
        from .config import get_settings
        from .local_settings import LocalSettingsStore

        store = LocalSettingsStore(get_settings().data_dir)
        s = store.load()
        s.connection = mode  # type: ignore[assignment]
        store.save(s)
        return s.online_url


def run(port: int = 0) -> None:
    import webview
    from webview.menu import Menu, MenuAction

    from .config import get_settings
    from .local_settings import LocalSettingsStore

    os.environ.setdefault("REDLARK_PDF_BROWSER_CHANNEL", "")
    port = port or _free_port()
    _start_server(port)
    local_url = f"http://127.0.0.1:{port}/"

    settings = LocalSettingsStore(get_settings().data_dir).load()
    start_url = settings.online_url if settings.connection == "online" and settings.online_url else local_url

    api = DesktopApi()
    api._local_url = local_url
    window = webview.create_window(
        f"Redlark {__version__}",
        start_url,
        js_api=api,
        width=1400,
        height=850,
        min_size=(MIN_WIDTH, MIN_HEIGHT),
        text_select=True,
    )
    api._window = window

    menu = [
        Menu(
            "Redlark",
            [
                MenuAction("Use offline libraries", api.go_offline),
                MenuAction("Use online account", api.go_online),
                MenuAction("Settings", lambda: window.load_url(local_url + "settings")),
            ],
        )
    ]
    webview.settings["ALLOW_DOWNLOADS"] = True
    webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True
    webview.start(menu=menu, private_mode=False, storage_path=str(get_settings().data_dir / "webview"))


if __name__ == "__main__":
    run()
