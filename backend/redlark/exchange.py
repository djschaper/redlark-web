"""Import and export of songs/sets in OpenSong, ChordPro, PDF and self-contained HTML."""

from __future__ import annotations

import io
import re
import zipfile
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import PurePosixPath
from typing import Literal

from .core.chordpro import parse_chordpro, song_to_chordpro
from .core.model import SetItem, Song, SongSet
from .core.opensong import parse_set_xml, parse_song_xml, set_to_xml, song_to_xml, transpose_song
from .render.html_export import build_document
from .render.payload import song_payload
from .storage.base import LibraryStore, NotFound
from .storage.folder import safe_filename

Format = Literal["opensong", "chordpro", "pdf", "html"]
Mode = Literal["chords", "lyrics"]

CHORDPRO_EXTS = {".cho", ".crd", ".chopro", ".chordpro", ".pro"}


@dataclass
class ExportItem:
    song_id: str
    key: str = ""  # target key; empty = song's own key


@dataclass
class ExportFile:
    filename: str
    content: bytes
    media_type: str


def _zip(files: Iterable[tuple[str, bytes]], name: str) -> ExportFile:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        used: set[str] = set()
        for path, content in files:
            base, n = path, 2
            while path in used:
                p = PurePosixPath(base)
                path = str(p.with_name(f"{p.stem} ({n}){p.suffix}"))
                n += 1
            used.add(path)
            zf.writestr(path, content)
    return ExportFile(f"{name}.zip", buf.getvalue(), "application/zip")


def _key_suffix(song: Song, key: str) -> str:
    return f" - {key}" if key else ""


def _render_doc(store: LibraryStore, items: list[ExportItem], title: str, mode: Mode, print_mode: bool) -> str:
    payloads = [song_payload(store.get_song(i.song_id), i.song_id, i.key or None) for i in items]
    return build_document(payloads, title=title, mode=mode, print_mode=print_mode)


def export_songs(
    store: LibraryStore,
    items: list[ExportItem],
    fmt: Format,
    *,
    mode: Mode = "chords",
    combine: bool = True,
    name: str = "Songs",
    numbered: bool = False,
    print_layout: bool = False,
) -> ExportFile:
    """Export one or many songs. Many songs become a zip unless ``combine`` (PDF/HTML only)."""
    from .render.pdf import html_to_pdf

    if not items:
        raise ValueError("Nothing to export")
    single = len(items) == 1
    lyrics_tag = " (lyrics)" if mode == "lyrics" else ""

    if fmt in ("pdf", "html") and (single or combine):
        title = store.get_song(items[0].song_id).title if single else name
        doc = _render_doc(store, items, title, mode, print_mode=(fmt == "pdf" or print_layout))
        if single:
            song = store.get_song(items[0].song_id)
            title = safe_filename(song.title) + _key_suffix(song, items[0].key)
        else:
            title = safe_filename(name)
        title += lyrics_tag
        if fmt == "pdf":
            return ExportFile(f"{title}.pdf", html_to_pdf(doc), "application/pdf")
        return ExportFile(f"{title}.html", doc.encode("utf-8"), "text/html")

    files: list[tuple[str, bytes]] = []
    for n, item in enumerate(items, 1):
        song = store.get_song(item.song_id)
        if item.key:
            song = transpose_song(song, item.key)
        prefix = f"{n:02d} " if numbered else ""
        base = prefix + safe_filename(song.title)
        if fmt == "opensong":
            files.append((f"Songs/{base}" if not single else base, song_to_xml(song).encode("utf-8")))
        elif fmt == "chordpro":
            files.append((base + ".cho", song_to_chordpro(song).encode("utf-8")))
        elif fmt == "html":
            doc = _render_doc(store, [item], song.title, mode, False)
            files.append((base + lyrics_tag + ".html", doc.encode("utf-8")))
        elif fmt == "pdf":
            doc = _render_doc(store, [item], song.title, mode, True)
            files.append((base + _key_suffix(song, item.key) + lyrics_tag + ".pdf", html_to_pdf(doc)))
        else:
            raise ValueError(f"Unknown format: {fmt}")

    if single:
        fname, content = files[0]
        media = {"opensong": "application/xml", "chordpro": "text/plain"}.get(fmt, "application/octet-stream")
        return ExportFile(PurePosixPath(fname).name, content, media)
    return _zip(files, safe_filename(name))


def export_set(
    store: LibraryStore,
    song_set: SongSet,
    fmt: Format,
    *,
    mode: Mode = "chords",
    combine: bool = True,
    print_layout: bool = False,
) -> ExportFile:
    items = [ExportItem(i.song_id, i.key) for i in song_set.items if i.song_id]
    if fmt == "opensong":
        files = [(f"Sets/{safe_filename(song_set.name)}", set_to_xml(song_set).encode("utf-8"))]
        for item in items:
            song = store.get_song(item.song_id)
            files.append((f"Songs/{safe_filename(song.title)}", song_to_xml(song).encode("utf-8")))
        return _zip(files, safe_filename(song_set.name))
    return export_songs(
        store, items, fmt, mode=mode, combine=combine, name=song_set.name, numbered=True, print_layout=print_layout
    )


def export_library(store: LibraryStore, fmt: Literal["opensong", "chordpro"], name: str = "Library") -> ExportFile:
    files: list[tuple[str, bytes]] = []
    for summary in store.list_songs():
        song = store.get_song(summary.id)
        if fmt == "opensong":
            files.append((f"Songs/{safe_filename(song.title)}", song_to_xml(song).encode("utf-8")))
        else:
            files.append((f"{safe_filename(song.title)}.cho", song_to_chordpro(song).encode("utf-8")))
    if fmt == "opensong":
        for s in store.list_sets():
            files.append((f"Sets/{safe_filename(s.name)}", set_to_xml(store.get_set(s.id)).encode("utf-8")))
    return _zip(files, safe_filename(name))


# ------------------------------------------------------------------ import


@dataclass
class ImportCandidate:
    source: str  # file name inside the upload
    kind: Literal["song", "set"]
    format: Literal["opensong", "chordpro"]
    title: str
    existing_id: str | None = None
    error: str = ""
    song: Song | None = field(default=None, repr=False)
    song_set: SongSet | None = field(default=None, repr=False)


def _decode(content: bytes) -> str:
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", "replace")


def _classify(name: str, content: bytes) -> ImportCandidate | None:
    path = PurePosixPath(name.replace("\\", "/"))
    base = path.name
    if not base or base.startswith(".") or base.lower() in ("desktop.ini", "thumbs.db"):
        return None
    suffix = path.suffix.lower()
    text = _decode(content)
    stripped = text.lstrip()
    try:
        if suffix in CHORDPRO_EXTS or (suffix == ".txt" and not stripped.startswith("<")):
            song = parse_chordpro(text, fallback_title=path.stem)
            return ImportCandidate(name, "song", "chordpro", song.title, song=song)
        if stripped.startswith("<"):
            if re.search(r"<song[\s>]", stripped[:500]):
                song = parse_song_xml(text.encode("utf-8"), base)
                return ImportCandidate(name, "song", "opensong", song.title, song=song)
            if re.search(r"<set[\s>]", stripped[:500]):
                song_set = parse_set_xml(text.encode("utf-8"), base)
                return ImportCandidate(name, "set", "opensong", base, song_set=song_set)
    except Exception as exc:  # malformed file
        return ImportCandidate(name, "song", "opensong", base, error=str(exc) or exc.__class__.__name__)
    return None


def read_upload(files: list[tuple[str, bytes]]) -> list[ImportCandidate]:
    """Expand zips and classify every file as an OpenSong song/set or a ChordPro song."""
    out: list[ImportCandidate] = []
    for name, content in files:
        if name.lower().endswith(".zip"):
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                for info in zf.infolist():
                    if info.is_dir() or info.file_size > 5_000_000:
                        continue
                    cand = _classify(info.filename, zf.read(info))
                    if cand:
                        out.append(cand)
        else:
            cand = _classify(name, content)
            if cand:
                out.append(cand)
    return out


def analyse(store: LibraryStore, candidates: list[ImportCandidate]) -> list[ImportCandidate]:
    sets = {s.name: s.id for s in store.list_sets()}
    for c in candidates:
        if c.song:
            c.existing_id = store.find_song_id(uuid=c.song.uuid, title=c.song.title)
        elif c.song_set:
            c.existing_id = sets.get(c.song_set.name)
    return candidates


Decision = Literal["skip", "overwrite", "new"]


def apply_import(
    store: LibraryStore, candidates: list[ImportCandidate], decisions: dict[str, Decision]
) -> dict[str, int]:
    """Save candidates; songs first so sets can resolve their song references."""
    counts = {"songs": 0, "sets": 0, "skipped": 0, "errors": 0}
    for c in sorted(candidates, key=lambda c: c.kind != "song"):
        if c.error:
            counts["errors"] += 1
            continue
        decision = decisions.get(c.source, "overwrite" if c.existing_id else "new")
        if decision == "skip":
            counts["skipped"] += 1
            continue
        if c.song:
            song = c.song
            target = c.existing_id if decision == "overwrite" else None
            if decision == "new" and c.existing_id:
                import uuid as uuidlib

                song.uuid = str(uuidlib.uuid4())
            store.save_song(song, target, keep_timestamp=True)
            counts["songs"] += 1
        elif c.song_set:
            items: list[SetItem] = []
            for item in c.song_set.items:
                item.song_id = store.find_song_id(title=item.name) or ""
                items.append(item)
            c.song_set.items = items
            store.save_set(c.song_set, c.existing_id if decision == "overwrite" else None)
            counts["sets"] += 1
    return counts


__all__ = [
    "ExportFile",
    "ExportItem",
    "ImportCandidate",
    "NotFound",
    "analyse",
    "apply_import",
    "export_library",
    "export_set",
    "export_songs",
    "read_upload",
]
