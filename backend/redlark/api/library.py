"""Songs, sets, import and export within one library."""

from __future__ import annotations

import json
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ..core.chordpro import parse_chordpro
from ..core.model import SetItem, Song, SongSet
from ..core.opensong import parse_lyrics, sections_to_lyrics
from ..exchange import (
    ExportFile,
    ExportItem,
    analyse,
    apply_import,
    export_library,
    export_set,
    export_songs,
    read_upload,
)
from ..render.payload import song_payload
from ..storage.base import NotFound, song_recency
from .deps import LibraryAccess, editable_library, library_access

router = APIRouter(prefix="/api/libraries/{library_id}", tags=["library"])

RECENT_SET_THRESHOLD = 12  # v1: the "recent" dot fades out over the last 12 sets


def _file_response(f: ExportFile) -> Response:
    disposition = f"attachment; filename*=UTF-8''{quote(f.filename)}"
    return Response(f.content, media_type=f.media_type, headers={"Content-Disposition": disposition})


def _not_found(exc: Exception) -> HTTPException:
    return HTTPException(404, f"Not found: {exc}")


# ---------------------------------------------------------------- songs


@router.get("/songs")
def list_songs(access: LibraryAccess = Depends(library_access)):
    recency = song_recency(access.store)
    out = []
    for s in access.store.list_songs():
        r = recency.get(s.id)
        out.append(
            {
                "id": s.id,
                "title": s.title,
                "author": s.author,
                "key": s.key,
                "uuid": s.uuid,
                "last_set": r.set_name if r else None,
                "recency": max(0.0, (RECENT_SET_THRESHOLD - r.index) / RECENT_SET_THRESHOLD) if r else 0.0,
            }
        )
    return out


@router.get("/songs/{song_id}")
def get_song(song_id: str, access: LibraryAccess = Depends(library_access)):
    try:
        return song_payload(access.store.get_song(song_id), song_id)
    except NotFound as exc:
        raise _not_found(exc)


class SongIn(BaseModel):
    title: str = Field(min_length=1)
    author: str = ""
    copyright: str = ""
    ccli: str = ""
    key: str = ""
    tempo: str = ""
    time_sig: str = ""
    capo: str = ""
    link_youtube: str = ""
    notes: str = ""
    lyrics: str = ""
    # Alternative to `lyrics`: ChordPro body to convert (used by the editor's ChordPro mode).
    chordpro: str | None = None


def _apply_song(song: Song, data: SongIn) -> Song:
    for f in Song.META_FIELDS:
        setattr(song, f, getattr(data, f))
    if data.chordpro is not None:
        song.lyrics = parse_chordpro(data.chordpro).lyrics
    else:
        song.lyrics = data.lyrics
    # Normalise, so what's stored is always valid OpenSong text.
    song.lyrics = sections_to_lyrics(parse_lyrics(song.lyrics)) if song.lyrics.strip() else ""
    return song


@router.post("/songs", status_code=201)
def create_song(data: SongIn, access: LibraryAccess = Depends(editable_library)):
    song = _apply_song(Song(), data)
    new_id = access.store.save_song(song)
    return song_payload(access.store.get_song(new_id), new_id)


@router.put("/songs/{song_id}")
def update_song(song_id: str, data: SongIn, access: LibraryAccess = Depends(editable_library)):
    try:
        song = access.store.get_song(song_id)
    except NotFound as exc:
        raise _not_found(exc)
    lyrics_before = song.lyrics
    song = _apply_song(song, data)
    if data.chordpro is None and data.lyrics == lyrics_before:
        song.lyrics = lyrics_before  # untouched: keep the exact original text
    new_id = access.store.save_song(song, song_id)
    return song_payload(access.store.get_song(new_id), new_id)


@router.delete("/songs/{song_id}", status_code=204)
def delete_song(song_id: str, access: LibraryAccess = Depends(editable_library)):
    try:
        access.store.delete_song(song_id)
    except NotFound as exc:
        raise _not_found(exc)


@router.get("/songs/{song_id}/export")
def export_one_song(
    song_id: str,
    format: Literal["opensong", "chordpro", "pdf", "html"],
    key: str = "",
    mode: Literal["chords", "lyrics"] = "chords",
    access: LibraryAccess = Depends(library_access),
):
    try:
        return _file_response(export_songs(access.store, [ExportItem(song_id, key)], format, mode=mode))
    except NotFound as exc:
        raise _not_found(exc)


# ---------------------------------------------------------------- sets


class SetItemIn(BaseModel):
    song_id: str
    key: str = ""


class SetIn(BaseModel):
    name: str = Field(min_length=1)
    items: list[SetItemIn]


def _set_out(set_id: str, s: SongSet) -> dict:
    return {
        "id": set_id,
        "name": s.name,
        "last_modified": s.last_modified,
        "items": [{"song_id": i.song_id or None, "name": i.name, "key": i.key, "type": i.type} for i in s.items],
    }


def _set_from(store, data: SetIn) -> SongSet:
    items = []
    for i in data.items:
        try:
            title = store.get_song(i.song_id).title
        except NotFound:
            raise HTTPException(400, f"Unknown song: {i.song_id}")
        items.append(SetItem(name=title, key=i.key, song_id=i.song_id))
    return SongSet(name=data.name.strip(), items=items)


@router.get("/sets")
def list_sets(access: LibraryAccess = Depends(library_access)):
    return [{"id": s.id, "name": s.name, "last_modified": s.last_modified} for s in access.store.list_sets()]


@router.get("/sets/{set_id}")
def get_set(set_id: str, access: LibraryAccess = Depends(library_access)):
    try:
        return _set_out(set_id, access.store.get_set(set_id))
    except NotFound as exc:
        raise _not_found(exc)


@router.post("/sets", status_code=201)
def create_set(data: SetIn, access: LibraryAccess = Depends(editable_library)):
    """Save a set by name (overwrites a set with the same name, like v1)."""
    store = access.store
    existing = next((s.id for s in store.list_sets() if s.name == data.name.strip()), None)
    new_id = store.save_set(_set_from(store, data), existing)
    return _set_out(new_id, store.get_set(new_id))


@router.put("/sets/{set_id}")
def update_set(set_id: str, data: SetIn, access: LibraryAccess = Depends(editable_library)):
    store = access.store
    try:
        store.get_set(set_id)
    except NotFound as exc:
        raise _not_found(exc)
    new_id = store.save_set(_set_from(store, data), set_id)
    return _set_out(new_id, store.get_set(new_id))


@router.delete("/sets/{set_id}", status_code=204)
def delete_set(set_id: str, access: LibraryAccess = Depends(editable_library)):
    try:
        access.store.delete_set(set_id)
    except NotFound as exc:
        raise _not_found(exc)


# ---------------------------------------------------------------- export


class ExportRequest(BaseModel):
    format: Literal["opensong", "chordpro", "pdf", "html"]
    mode: Literal["chords", "lyrics"] = "chords"
    # One of: explicit items (unsaved set / selection), a saved set, or the whole library.
    items: list[SetItemIn] | None = None
    set_id: str | None = None
    all: bool = False
    name: str = ""
    combine: bool = True  # PDF/HTML: one document instead of a zip of files
    numbered: bool = False
    print_layout: bool = False  # HTML: lay out for printing (no toolbar), used by the Print buttons


@router.post("/export")
def export(req: ExportRequest, access: LibraryAccess = Depends(library_access)):
    store = access.store
    try:
        if req.all:
            if req.format not in ("opensong", "chordpro"):
                items = [ExportItem(s.id) for s in store.list_songs()]
                f = export_songs(
                    store,
                    items,
                    req.format,
                    mode=req.mode,
                    combine=req.combine,
                    name=req.name or "Library",
                    print_layout=req.print_layout,
                )
            else:
                f = export_library(store, req.format, name=req.name or "Library")
        elif req.set_id:
            f = export_set(
                store,
                store.get_set(req.set_id),
                req.format,
                mode=req.mode,
                combine=req.combine,
                print_layout=req.print_layout,
            )
        elif req.items:
            items = [ExportItem(i.song_id, i.key) for i in req.items]
            if req.format == "opensong" and req.name and req.numbered:
                f = export_set(store, _set_from(store, SetIn(name=req.name, items=req.items)), "opensong")
            else:
                f = export_songs(
                    store,
                    items,
                    req.format,
                    mode=req.mode,
                    combine=req.combine,
                    name=req.name or "Songs",
                    numbered=req.numbered,
                    print_layout=req.print_layout,
                )
        else:
            raise HTTPException(400, "Nothing selected to export")
    except NotFound as exc:
        raise _not_found(exc)
    return _file_response(f)


# ---------------------------------------------------------------- import


@router.post("/import")
async def import_files(
    files: list[UploadFile] = File(...),
    commit: bool = Form(False),
    decisions: str = Form("{}"),
    access: LibraryAccess = Depends(library_access),
):
    """Upload OpenSong/ChordPro files or zips. ``commit=false`` previews; ``true`` saves.

    ``decisions`` is a JSON map of source file name -> "skip" | "overwrite" | "new".
    """
    if commit:
        access.require("editor")
    uploads = [(f.filename or "upload", await f.read()) for f in files]
    try:
        candidates = analyse(access.store, read_upload(uploads))
    except Exception as exc:
        raise HTTPException(400, f"Could not read upload: {exc}")
    if not commit:
        return {
            "items": [
                {
                    "source": c.source,
                    "kind": c.kind,
                    "format": c.format,
                    "title": c.title,
                    "existing_id": c.existing_id,
                    "error": c.error,
                }
                for c in candidates
            ]
        }
    try:
        parsed = json.loads(decisions or "{}")
    except ValueError:
        raise HTTPException(400, "decisions must be JSON")
    return apply_import(access.store, candidates, parsed)
