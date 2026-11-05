"""Two-way sync between a local library and an online library.

Songs match by uuid, sets by name. A change is detected by comparing each side's
``last_modified`` with the time of the previous sync:

* changed on one side only -> copy it to the other side
* changed on both sides    -> conflict, resolved by the user ("local" or "remote")
* only on one side         -> copy it across (deletions are not propagated)
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal

import httpx

from .core.model import SetItem, Song, SongSet
from .storage.base import LibraryStore, NotFound, SetSummary, SongSummary

Action = Literal["push", "pull", "conflict", "same"]


@dataclass
class SyncEntry:
    key: str  # "song:<uuid>" or "set:<name>"
    kind: Literal["song", "set"]
    title: str
    action: Action
    local_id: str | None = None
    remote_id: str | None = None
    local_modified: str = ""
    remote_modified: str = ""


@dataclass
class SyncPlan:
    entries: list[SyncEntry] = field(default_factory=list)

    def summary(self) -> dict[str, int]:
        out = {"push": 0, "pull": 0, "conflict": 0, "same": 0}
        for e in self.entries:
            out[e.action] += 1
        return out

    def to_json(self) -> dict:
        return {"summary": self.summary(), "entries": [asdict(e) for e in self.entries if e.action != "same"]}


class RemoteStore:
    """LibraryStore-like client for an online library, via its /sync endpoints."""

    read_only = False

    def __init__(self, base_url: str, token: str, library_id: str, client: httpx.Client | None = None):
        self.base = base_url.rstrip("/") + f"/api/libraries/{library_id}/sync"
        self.client = client or httpx.Client(timeout=60, headers={"Authorization": f"Bearer {token}"})

    def _get(self, path: str):
        r = self.client.get(self.base + path)
        if r.status_code == 404:
            raise NotFound(path)
        r.raise_for_status()
        return r.json()

    def manifest(self) -> tuple[list[SongSummary], list[SetSummary]]:
        data = self._get("/manifest")
        return [SongSummary(**s) for s in data["songs"]], [SetSummary(**s) for s in data["sets"]]

    def get_song(self, song_id: str) -> Song:
        return Song(**self._get(f"/songs/{song_id}"))

    def save_song(self, song: Song) -> str:
        r = self.client.put(self.base + "/songs", json=asdict(song))
        r.raise_for_status()
        return r.json()["id"]

    def get_set(self, set_id: str) -> SongSet:
        data = self._get(f"/sets/{set_id}")
        return SongSet(name=data["name"], last_modified=data["last_modified"], items=[SetItem(**i) for i in data["items"]])

    def save_set(self, song_set: SongSet) -> str:
        r = self.client.put(self.base + "/sets", json=asdict(song_set))
        r.raise_for_status()
        return r.json()["id"]


def _changed(modified: str, since: str) -> bool:
    return not since or (modified or "") > since


def plan_sync(local: LibraryStore, remote: RemoteStore, last_sync: str = "") -> SyncPlan:
    plan = SyncPlan()
    r_songs, r_sets = remote.manifest()
    l_songs = {s.uuid: s for s in local.list_songs() if s.uuid}
    r_by_uuid = {s.uuid: s for s in r_songs if s.uuid}

    def decide(lm: str, rm: str) -> Action:
        if lm == rm:
            return "same"
        lc, rc = _changed(lm, last_sync), _changed(rm, last_sync)
        if lc and rc:
            if not last_sync:
                # First sync of an existing pair: newer wins rather than asking about every song.
                return "push" if lm > rm else "pull"
            return "conflict"
        if lc:
            return "push"
        if rc:
            return "pull"
        return "same"

    for uuid in sorted(set(l_songs) | set(r_by_uuid)):
        ls, rs = l_songs.get(uuid), r_by_uuid.get(uuid)
        title = (ls or rs).title  # type: ignore[union-attr]
        if ls and not rs:
            action: Action = "push"
        elif rs and not ls:
            action = "pull"
        else:
            action = decide(ls.last_modified, rs.last_modified)  # type: ignore[union-attr]
        plan.entries.append(
            SyncEntry(f"song:{uuid}", "song", title, action, ls.id if ls else None, rs.id if rs else None,
                      ls.last_modified if ls else "", rs.last_modified if rs else "")
        )

    l_sets = {s.name: s for s in local.list_sets()}
    r_set_by_name = {s.name: s for s in r_sets}
    for name in sorted(set(l_sets) | set(r_set_by_name), reverse=True):
        ls, rs = l_sets.get(name), r_set_by_name.get(name)
        if ls and not rs:
            action = "push"
        elif rs and not ls:
            action = "pull"
        else:
            action = decide(ls.last_modified, rs.last_modified)  # type: ignore[union-attr]
        plan.entries.append(
            SyncEntry(f"set:{name}", "set", name, action, ls.id if ls else None, rs.id if rs else None,
                      ls.last_modified if ls else "", rs.last_modified if rs else "")
        )
    return plan


def apply_sync(
    local: LibraryStore, remote: RemoteStore, plan: SyncPlan, resolutions: dict[str, Literal["local", "remote", "skip"]]
) -> dict[str, int]:
    counts = {"pushed": 0, "pulled": 0, "skipped": 0}
    # Songs before sets, so set items can be resolved to song ids on the receiving side.
    for e in sorted(plan.entries, key=lambda e: e.kind != "song"):
        action = e.action
        if action == "conflict":
            res = resolutions.get(e.key, "skip")
            action = {"local": "push", "remote": "pull"}.get(res, "skip")  # type: ignore[assignment]
        if action in ("same", "skip"):
            if action == "skip":
                counts["skipped"] += 1
            continue
        if e.kind == "song":
            if action == "push":
                remote.save_song(local.get_song(e.local_id))  # type: ignore[arg-type]
                counts["pushed"] += 1
            else:
                local.save_song(remote.get_song(e.remote_id), e.local_id, keep_timestamp=True)  # type: ignore[arg-type]
                counts["pulled"] += 1
        else:
            if action == "push":
                s = local.get_set(e.local_id)  # type: ignore[arg-type]
                for item in s.items:  # send song uuids so the server can resolve them
                    if item.song_id:
                        try:
                            item.attrs = {**item.attrs, "_uuid": local.get_song(item.song_id).uuid}
                        except NotFound:
                            pass
                remote.save_set(s)
                counts["pushed"] += 1
            else:
                s = remote.get_set(e.remote_id)  # type: ignore[arg-type]
                for item in s.items:
                    uuid = item.attrs.pop("_uuid", "")
                    item.song_id = local.find_song_id(uuid=uuid, title=item.name) or ""
                local.save_set(s, e.local_id, keep_timestamp=True)
                counts["pulled"] += 1
    return counts
