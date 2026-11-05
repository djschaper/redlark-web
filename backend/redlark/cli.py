"""Redlark command line: run the server/desktop app, import/export, manage users."""

from __future__ import annotations

import os
from pathlib import Path

import typer

from . import __version__

app = typer.Typer(help="Redlark worship set planner.", no_args_is_help=True, add_completion=False)


def _store_for_path(path: Path):
    """An OpenSong folder, or a .db file (SQLite library)."""
    from .db.session import create_all, make_engine, make_sessionmaker
    from .storage.folder import FolderStore
    from .storage.sql import SqlStore

    if path.suffix == ".db":
        engine = make_engine(f"sqlite:///{path}")
        create_all(engine)
        sessions = make_sessionmaker(engine)
        return SqlStore(sessions, SqlStore.ensure_library(sessions, path.stem))
    if not (path / "Songs").is_dir():
        raise typer.BadParameter(f"{path} is not an OpenSong folder (no Songs/ inside)")
    return FolderStore(path)


@app.command()
def version() -> None:
    """Print the version."""
    typer.echo(__version__)


@app.command()
def serve(
    host: str = typer.Option("127.0.0.1", help="Interface to bind."),
    port: int = typer.Option(8000, help="Port."),
    mode: str = typer.Option(None, help="'server' (hosted, with accounts) or 'local' (no auth). Default: REDLARK_MODE."),
    library: Path | None = typer.Option(None, help="Local mode: add/select this OpenSong folder as a library."),
    reload: bool = typer.Option(False, help="Auto-reload on code changes (development)."),
) -> None:
    """Run the web app."""
    import uvicorn

    if mode:
        os.environ["REDLARK_MODE"] = mode
    if library:
        _register_local_library(library)
    uvicorn.run("redlark.app:create_app", factory=True, host=host, port=port, reload=reload)


def _register_local_library(path: Path) -> None:
    from .config import get_settings
    from .local_settings import LocalLibrary, LocalSettingsStore

    path = path.resolve()
    store = LocalSettingsStore(get_settings().data_dir)
    s = store.load()
    lib = next((x for x in s.libraries if Path(x.path) == path), None)
    if lib is None:
        kind = "sqlite" if path.suffix == ".db" else "folder"
        lib = LocalLibrary(name=path.stem if kind == "sqlite" else path.name, kind=kind, path=str(path))
        s.libraries.append(lib)
    s.active_library = lib.id
    store.save(s)


@app.command()
def desktop(port: int = typer.Option(0, help="Local port (0 = pick a free one).")) -> None:
    """Open the desktop app window."""
    from .desktop import run

    run(port=port)


@app.command("export")
def export_cmd(
    library: Path = typer.Argument(..., help="OpenSong folder or .db library."),
    out: Path = typer.Argument(..., help="Output file or folder."),
    format: str = typer.Option("html", "--format", "-f", help="opensong | chordpro | pdf | html"),
    songs: list[str] = typer.Option([], "--song", "-s", help="Song id/name (repeatable). Default: all songs."),
    set_name: str | None = typer.Option(None, "--set", help="Export this set (in its keys)."),
    lyrics: bool = typer.Option(False, help="Lyrics only (pdf/html)."),
    combine: bool = typer.Option(False, help="pdf/html: one document instead of one file per song."),
) -> None:
    """Export songs, a set, or the whole library (replaces tools/batch-export-html.js)."""
    import io
    import zipfile

    from .exchange import ExportItem, export_library, export_set, export_songs

    store = _store_for_path(library)
    mode = "lyrics" if lyrics else "chords"
    if set_name:
        set_id = next((s.id for s in store.list_sets() if s.name == set_name), None)
        if not set_id:
            raise typer.BadParameter(f"No set named {set_name!r}")
        f = export_set(store, store.get_set(set_id), format, mode=mode, combine=combine)  # type: ignore[arg-type]
    elif songs:
        ids = []
        for s in songs:
            sid = store.find_song_id(title=s) or s
            ids.append(ExportItem(sid))
        f = export_songs(store, ids, format, mode=mode, combine=combine)  # type: ignore[arg-type]
    elif format in ("opensong", "chordpro"):
        f = export_library(store, format, name=library.name)  # type: ignore[arg-type]
    else:
        f = export_songs(store, [ExportItem(s.id) for s in store.list_songs()], format, mode=mode,  # type: ignore[arg-type]
                         combine=combine, name=library.name)

    if f.filename.endswith(".zip") and (out.is_dir() or not out.suffix):
        out.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(io.BytesIO(f.content)) as zf:
            zf.extractall(out)
            typer.echo(f"Wrote {len(zf.namelist())} files to {out}")
        return
    target = out / f.filename if out.is_dir() else out
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(f.content)
    typer.echo(f"Wrote {target}")


@app.command("import")
def import_cmd(
    library: Path = typer.Argument(..., help="Target OpenSong folder or .db library."),
    files: list[Path] = typer.Argument(..., help="OpenSong/ChordPro files, folders, or zips."),
    overwrite: bool = typer.Option(False, help="Overwrite songs/sets that already exist (default: skip)."),
) -> None:
    """Import OpenSong or ChordPro files into a library."""
    from .exchange import analyse, apply_import, read_upload

    store = _store_for_path(library)
    uploads = []
    for p in files:
        paths = [x for x in p.rglob("*") if x.is_file()] if p.is_dir() else [p]
        uploads.extend((str(x.relative_to(p.parent)), x.read_bytes()) for x in paths)
    candidates = analyse(store, read_upload(uploads))
    decisions = {c.source: ("overwrite" if overwrite else "skip") for c in candidates if c.existing_id}
    for c in candidates:
        state = "error: " + c.error if c.error else ("exists" if c.existing_id else "new")
        typer.echo(f"  {c.kind:4} {c.format:8} {c.title}  [{state}]")
    typer.echo(apply_import(store, candidates, decisions))


@app.command()
def migrate() -> None:
    """Apply database migrations (hosted Postgres)."""
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(Path(__file__).resolve().parent / "db" / "alembic.ini"))
    cfg.set_main_option("script_location", str(Path(__file__).resolve().parent / "db" / "migrations"))
    command.upgrade(cfg, "head")
    typer.echo("Database is up to date")


@app.command("create-user")
def create_user_cmd(
    email: str,
    password: str = typer.Option(..., prompt=True, hide_input=True, confirmation_prompt=True),
    name: str = typer.Option("", help="Display name."),
    admin: bool = typer.Option(False, help="Site admin (can see every library)."),
    library: str = typer.Option("", help="Create a library with this name owned by the user."),
) -> None:
    """Create a user in the hosted database (REDLARK_DATABASE_URL)."""
    from .auth import create_user
    from .config import get_settings
    from .db.models import Library, Membership
    from .db.session import make_engine, make_sessionmaker

    sessions = make_sessionmaker(make_engine(get_settings().database_url))
    with sessions() as db:
        user = create_user(db, email, password, name, is_admin=admin)
        if library:
            lib = Library(name=library)
            db.add(lib)
            db.flush()
            db.add(Membership(user_id=user.id, library_id=lib.id, role="owner"))
        db.commit()
    typer.echo(f"Created {email}")


@app.command("upload-library")
def upload_library(
    source: Path = typer.Argument(..., help="OpenSong folder to copy into an online library."),
    library_id: str = typer.Argument(..., help="Target library id in the hosted database."),
) -> None:
    """Bulk copy an OpenSong folder into a hosted library (run where REDLARK_DATABASE_URL points)."""
    from .config import get_settings
    from .db.session import make_engine, make_sessionmaker
    from .storage.sql import SqlStore
    from .sync import apply_sync, plan_sync  # noqa: F401  (shared semantics)

    src = _store_for_path(source)
    dst = SqlStore(make_sessionmaker(make_engine(get_settings().database_url)), library_id)
    n = 0
    for s in src.list_songs():
        dst.save_song(src.get_song(s.id), dst.find_song_id(uuid=s.uuid), keep_timestamp=True)
        n += 1
    for st in src.list_sets():
        song_set = src.get_set(st.id)
        for item in song_set.items:
            uuid = src.get_song(item.song_id).uuid if item.song_id else ""
            item.song_id = dst.find_song_id(uuid=uuid, title=item.name) or ""
        existing = next((x.id for x in dst.list_sets() if x.name == song_set.name), None)
        dst.save_set(song_set, existing, keep_timestamp=True)
    typer.echo(f"Uploaded {n} songs and {len(src.list_sets())} sets")


if __name__ == "__main__":
    app()
