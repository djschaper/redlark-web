import shutil
import time

from fastapi.testclient import TestClient

from redlark.app import create_app
from redlark.config import Settings
from redlark.core.opensong import now_iso
from redlark.storage.folder import FolderStore
from redlark.sync import RemoteStore, apply_sync, plan_sync


def _server(tmp_path):
    app = create_app(Settings(mode="server", database_url=f"sqlite:///{tmp_path / 's.db'}", allow_signup=True))
    c = TestClient(app)
    token = c.post("/api/auth/signup", json={"email": "a@x.org", "password": "password1"}).json()["token"]
    c.headers["Authorization"] = f"Bearer {token}"
    lib = c.get("/api/libraries").json()[0]["id"]
    return c, lib


def test_push_then_pull_and_conflict(tmp_path, fixtures):
    root = tmp_path / "OpenSong"
    (root / "Songs").mkdir(parents=True)
    (root / "Sets").mkdir()
    shutil.copy(fixtures / "songs" / "10,000 Reasons (Bless The Lord)", root / "Songs")
    (root / "Sets" / "2026-01-04").write_text(
        '<set><slide_groups><slide_group name="10,000 Reasons (Bless The Lord)" type="song" '
        'presentation="" path="/" key="E"/></slide_groups></set>'
    )
    local = FolderStore(root)
    client, lib = _server(tmp_path)
    remote = RemoteStore("http://testserver", "", lib, client=client)

    plan = plan_sync(local, remote)
    assert plan.summary()["push"] == 2
    assert apply_sync(local, remote, plan, {}) == {"pushed": 2, "pulled": 0, "skipped": 0}
    remote_set = client.get(f"/api/libraries/{lib}/sets").json()[0]
    items = client.get(f"/api/libraries/{lib}/sets/{remote_set['id']}").json()["items"]
    assert items[0]["song_id"] and items[0]["key"] == "E"

    last_sync = now_iso()
    assert plan_sync(local, remote, last_sync).summary() == {"push": 0, "pull": 0, "conflict": 0, "same": 2}

    # Edit online -> pull.
    time.sleep(0.01)
    sid = client.get(f"/api/libraries/{lib}/songs").json()[0]["id"]
    song = client.get(f"/api/libraries/{lib}/songs/{sid}").json()
    body = {k: song[k] for k in ("title", "author", "key", "lyrics")} | {"tempo": "99"}
    client.put(f"/api/libraries/{lib}/songs/{sid}", json=body)
    plan = plan_sync(local, remote, last_sync)
    assert plan.summary()["pull"] == 1
    apply_sync(local, remote, plan, {})
    assert local.get_song("10,000 Reasons (Bless The Lord)").tempo == "99"

    # Edit both sides -> conflict.
    last_sync = now_iso()
    time.sleep(0.01)
    s = local.get_song("10,000 Reasons (Bless The Lord)")
    s.tempo = "100"
    local.save_song(s, "10,000 Reasons (Bless The Lord)")
    client.put(f"/api/libraries/{lib}/songs/{sid}", json=body | {"tempo": "101"})
    plan = plan_sync(local, remote, last_sync)
    conflict = next(e for e in plan.entries if e.action == "conflict")
    apply_sync(local, remote, plan, {conflict.key: "local"})
    assert client.get(f"/api/libraries/{lib}/songs/{sid}").json()["tempo"] == "100"


def test_old_settings_with_connection_mode_still_load(tmp_path, monkeypatch):
    from redlark.local_settings import LocalSettingsStore

    monkeypatch.setenv("REDLARK_SKIP_V1_IMPORT", "1")
    (tmp_path / "settings.json").write_text(
        '{"connection": "online", "online_url": "https://r.example.org", "display_mode": "dark"}'
    )
    store = LocalSettingsStore(tmp_path)
    s = store.load()
    assert s.online_url == "https://r.example.org" and s.display_mode == "dark"
    store.save(s)
    assert "connection" not in (tmp_path / "settings.json").read_text()
