"""PyInstaller entry point for the desktop app."""

import multiprocessing
import os
import sys

if getattr(sys, "frozen", False):
    # Static files are bundled next to the package inside the PyInstaller archive.
    os.environ.setdefault("REDLARK_STATIC_DIR", os.path.join(sys._MEIPASS, "redlark", "static"))  # type: ignore[attr-defined]

from redlark.desktop import run  # noqa: E402

if __name__ == "__main__":
    multiprocessing.freeze_support()
    run()
