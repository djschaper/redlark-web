# PyInstaller spec for the Windows desktop app:  uv run pyinstaller packaging/redlark.spec
# (build the frontend first so redlark/static exists)
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

ROOT = Path(SPECPATH).parent  # backend/
ICON = ROOT.parent / "build" / "icon.ico"

datas = [
    (str(ROOT / "redlark" / "static"), "redlark/static"),
    (str(ROOT / "redlark" / "db" / "migrations"), "redlark/db/migrations"),
    (str(ROOT / "redlark" / "db" / "alembic.ini"), "redlark/db"),
]
datas += collect_data_files("webview")

hiddenimports = collect_submodules("uvicorn") + collect_submodules("redlark") + ["webview.platforms.edgechromium"]

a = Analysis(
    [str(ROOT / "packaging" / "desktop_main.py")],
    pathex=[str(ROOT)],
    datas=datas,
    hiddenimports=hiddenimports,
    excludes=["tkinter", "psycopg", "psycopg_binary"],
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Redlark",
    icon=str(ICON),
    console=False,
)
coll = COLLECT(exe, a.binaries, a.datas, name="Redlark")
