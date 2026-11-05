"""Sync endpoints.

Server side (hosted app): ``/api/libraries/{id}/sync/...`` exposes raw songs/sets for desktop clients.
Local side (desktop app): ``/api/sync/...`` connects to an online account and runs a sync.
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..context import AppContext
from ..core.model import SetItem, Song, SongSet
from ..core.opensong import now_iso
from ..local_settings import LocalLibrary
from ..storage.base import NotFound
from ..sync import RemoteStore, SyncEntry, SyncPlan, apply_sync, plan_sync
from .deps import LibraryAccess, editable_library, get_ctx, library_access

router = APIRouter(tags=["sync"])

# ---------------------------------------------------------------- server side


@router.get("/api/libraries/{library_id}/sync/manifest")
def manifest(access: LibraryAccess = Depends(library_access)):
    return {
        "songs": [asdict(s) for s in access.store.list_songs()],
        "sets": [asdict(s) for s in access.store.list_sets()],
    }


@router.get("/api/libraries/{library_id}/sync/songs/{song_id}")
def raw_song(song_id: str, access: LibraryAccess = Depends(library_access)):
    try:
        return asdict(access.store.get_song(song_id))
    except NotFound:
        raise HTTPException(404, "Song not found")


@router.put("/api/libraries/{library_id}/sync/songs")
def put_raw_song(song: dict, access: LibraryAccess = Depends(editable_library)):
    s = Song(**{k: v for k, v in song.items() if k in Song.__dataclass_fields__})
    existing = access.store.find_song_id(uuid=s.uuid) if s.uuid else None
    return {"id": access.store.save_song(s, existing, keep_timestamp=True)}


@router.get("/api/libraries/{library_id}/sync/sets/{set_id}")
def raw_set(set_id: str, access: LibraryAccess = Depends(library_access)):
    try:
        s = access.store.get_set(set_id)
    except NotFound:
        raise HTTPException(404, "Set not found")
    for item in s.items:
        if item.song_id:
            try:
                item.attrs = {**item.attrs, "_uuid": access.store.get_song(item.song_id).uuid}
            except NotFound:
                pass
    return asdict(s)


@router.put("/api/libraries/{library_id}/sync/sets")
def put_raw_set(data: dict, access: LibraryAccess = Depends(editable_library)):
    store = access.store
    items = []
    for raw in data.get("items", []):
        attrs = dict(raw.get("attrs") or {})
        uuid = attrs.pop("_uuid", "")
        item = SetItem(name=raw.get("name", ""), key=raw.get("key", ""), type=raw.get("type", "song"), attrs=attrs)
        item.song_id = store.find_song_id(uuid=uuid, title=item.name) or ""
        items.append(item)
    s = SongSet(name=data["name"], items=items, last_modified=data.get("last_modified", ""))
    existing = next((x.id for x in store.list_sets() if x.name == s.name), None)
    return {"id": store.save_set(s, existing, keep_timestamp=True)}


# ---------------------------------------------------------------- local side


def _local_only(ctx: AppContext) -> None:
    if ctx.mode != "local":
        raise HTTPException(404, "Not available")


class ConnectIn(BaseModel):
    url: str
    email: str
    password: str


@router.post("/api/sync/connect")
def connect(data: ConnectIn, ctx: AppContext = Depends(get_ctx)):
    """Log in to the online Redlark and remember the session for syncing."""
    _local_only(ctx)
    assert ctx.local
    url = data.url.strip().rstrip("/")
    try:
        r = httpx.post(f"{url}/api/auth/login", json={"email": data.email, "password": data.password}, timeout=20)
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Could not reach {url}: {exc}")
    if r.status_code != 200:
        try:
            detail = r.json().get("detail", r.text)
        except ValueError:
            detail = r.text
        raise HTTPException(401, f"Online login failed: {detail}")
    s = ctx.local.load()
    s.online_url = url
    s.remote_token = r.json()["token"]
    ctx.local.save(s)
    return {"user": r.json()["user"]}


def _remote_client(ctx: AppContext) -> tuple[str, str]:
    assert ctx.local
    s = ctx.local.load()
    if not s.online_url or not s.remote_token:
        raise HTTPException(400, "Connect to your online account first")
    return s.online_url, s.remote_token


@router.get("/api/sync/remote-libraries")
def remote_libraries(ctx: AppContext = Depends(get_ctx)):
    _local_only(ctx)
    url, token = _remote_client(ctx)
    try:
        r = httpx.get(f"{url}/api/libraries", headers={"Authorization": f"Bearer {token}"}, timeout=20)
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Could not reach {url}: {exc}")
    if r.status_code == 401:
        raise HTTPException(401, "Online session expired. Connect again.")
    r.raise_for_status()
    return r.json()


def _local_lib(ctx: AppContext, library_id: str) -> LocalLibrary:
    assert ctx.local
    lib = next((lib for lib in ctx.local.load().libraries if lib.id == library_id), None)
    if lib is None:
        raise HTTPException(404, "Library not found")
    return lib


class LinkIn(BaseModel):
    remote_library_id: str


@router.post("/api/sync/{library_id}/link")
def link(library_id: str, data: LinkIn, ctx: AppContext = Depends(get_ctx)):
    _local_only(ctx)
    assert ctx.local
    url, _ = _remote_client(ctx)
    s = ctx.local.load()
    lib = next((lib for lib in s.libraries if lib.id == library_id), None)
    if lib is None:
        raise HTTPException(404, "Library not found")
    lib.remote_url, lib.remote_library_id, lib.last_sync = url, data.remote_library_id, ""
    ctx.local.save(s)
    return {"ok": True}


def _plan(ctx: AppContext, library_id: str) -> tuple[LocalLibrary, RemoteStore, SyncPlan]:
    lib = _local_lib(ctx, library_id)
    if not lib.remote_library_id:
        raise HTTPException(400, "This library isn't linked to an online library")
    _, token = _remote_client(ctx)
    remote = RemoteStore(lib.remote_url, token, lib.remote_library_id)
    try:
        return lib, remote, plan_sync(ctx.local_store(lib), remote, lib.last_sync)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, f"Online library error: {exc.response.status_code}")
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Could not reach the online library: {exc}")


@router.post("/api/sync/{library_id}/preview")
def preview(library_id: str, ctx: AppContext = Depends(get_ctx)):
    _local_only(ctx)
    return _plan(ctx, library_id)[2].to_json()


class ApplyIn(BaseModel):
    resolutions: dict[str, Literal["local", "remote", "skip"]] = {}
    direction: Literal["both", "push", "pull"] = "both"


@router.post("/api/sync/{library_id}/apply")
def apply(library_id: str, data: ApplyIn, ctx: AppContext = Depends(get_ctx)):
    _local_only(ctx)
    assert ctx.local
    lib, remote, plan = _plan(ctx, library_id)
    if data.direction != "both":
        keep = "push" if data.direction == "push" else "pull"
        plan = SyncPlan(
            [e if e.action in (keep, "conflict") else SyncEntry(**{**asdict(e), "action": "same"}) for e in plan.entries]
        )
    started = now_iso()
    try:
        counts = apply_sync(ctx.local_store(lib), remote, plan, data.resolutions)
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Sync failed part-way: {exc}")
    s = ctx.local.load()
    for x in s.libraries:
        if x.id == library_id and data.direction == "both":
            x.last_sync = started
    ctx.local.save(s)
    return counts
