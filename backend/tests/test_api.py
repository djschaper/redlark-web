import io
import shutil
import zipfile

import pytest
from fastapi.testclient import TestClient

from redlark.app import create_app
from redlark.config import Settings


@pytest.fixture
def opensong_dir(tmp_path, fixtures):
    root = tmp_path / "OpenSong"
    (root / "Songs").mkdir(parents=True)
    (root / "Sets").mkdir()
    shutil.copy(fixtures / "songs" / "10,000 Reasons (Bless The Lord)", root / "Songs")
    (root / "Sets" / "2020-01-05").write_text(
        '<set><slide_groups><slide_group name="10,000 Reasons (Bless The Lord)" type="song" '
        'presentation="" path="/" key="E"/></slide_groups></set>'
    )
    return root


@pytest.fixture
def local_client(tmp_path, opensong_dir, monkeypatch):
    monkeypatch.delenv("APPDATA", raising=False)
    app = create_app(Settings(mode="local", data_dir=tmp_path / "data"))
    c = TestClient(app)
    lib = c.post("/api/libraries", json={"name": "OS", "kind": "folder", "path": str(opensong_dir)}).json()
    c.lib = lib["id"]
    return c


def test_local_songs_and_sets(local_client, opensong_dir):
    c, lib = local_client, local_client.lib
    songs = c.get(f"/api/libraries/{lib}/songs").json()
    assert songs[0]["title"] == "10,000 Reasons (Bless The Lord)"
    assert songs[0]["last_set"] == "2020-01-05" and songs[0]["recency"] == 1.0
    sid = songs[0]["id"]
    song = c.get(f"/api/libraries/{lib}/songs/{sid}").json()
    assert song["key"] == "D" and song["sections"][0]["label"] == "Chorus 1"
    assert song["lyrics_sections"][0]["lines"][0]["segments"][0]["lyric"] == "Bless the Lord O my soul O my soul"

    r = c.post(f"/api/libraries/{lib}/sets", json={"name": "2026-11-08", "items": [{"song_id": sid, "key": "G"}]})
    assert r.status_code == 201
    xml = (opensong_dir / "Sets" / "2026-11-08").read_text()
    assert 'name="10,000 Reasons (Bless The Lord)"' in xml and 'key="G"' in xml
    sets = c.get(f"/api/libraries/{lib}/sets").json()
    assert [s["name"] for s in sets] == ["2026-11-08", "2020-01-05"]
    got = c.get(f"/api/libraries/{lib}/sets/2026-11-08").json()
    assert got["items"] == [{"song_id": sid, "name": "10,000 Reasons (Bless The Lord)", "key": "G", "type": "song"}]


def test_edit_song_keeps_untouched_lyrics(local_client):
    c, lib = local_client, local_client.lib
    sid = c.get(f"/api/libraries/{lib}/songs").json()[0]["id"]
    song = c.get(f"/api/libraries/{lib}/songs/{sid}").json()
    fields = (
        "title",
        "author",
        "copyright",
        "ccli",
        "key",
        "tempo",
        "time_sig",
        "capo",
        "link_youtube",
        "notes",
        "lyrics",
    )
    body = {k: song[k] for k in fields}
    body["tempo"] = "75"
    r = c.put(f"/api/libraries/{lib}/songs/{sid}", json=body)
    assert r.status_code == 200 and r.json()["tempo"] == "75"
    assert r.json()["lyrics"] == song["lyrics"]


def test_export_opensong_and_chordpro(local_client):
    c, lib = local_client, local_client.lib
    sid = c.get(f"/api/libraries/{lib}/songs").json()[0]["id"]
    r = c.get(f"/api/libraries/{lib}/songs/{sid}/export", params={"format": "chordpro", "key": "G"})
    assert r.status_code == 200 and "{key: G}" in r.text and "[C]Lord" in r.text
    r = c.post(f"/api/libraries/{lib}/export", json={"format": "opensong", "all": True})
    names = zipfile.ZipFile(io.BytesIO(r.content)).namelist()
    assert "Songs/10,000 Reasons (Bless The Lord)" in names and "Sets/2020-01-05" in names


def test_import_chordpro(local_client, fixtures, opensong_dir):
    c, lib = local_client, local_client.lib
    files = {"files": ("Simple.cho", (fixtures / "songs" / "Simple.cho").read_bytes())}
    prev = c.post(f"/api/libraries/{lib}/import", files=files, data={"commit": "false"}).json()
    assert prev["items"][0]["title"] == "Simple Song" and prev["items"][0]["existing_id"] is None
    res = c.post(f"/api/libraries/{lib}/import", files=files, data={"commit": "true"}).json()
    assert res["songs"] == 1
    assert (opensong_dir / "Songs" / "Simple Song").exists()


def test_server_auth_and_roles(tmp_path):
    app = create_app(Settings(mode="server", database_url=f"sqlite:///{tmp_path / 's.db'}", allow_signup=True))
    owner = TestClient(app)
    assert owner.get("/api/libraries").status_code == 401
    r = owner.post("/api/auth/signup", json={"email": "a@x.org", "password": "password1", "library_name": "Church"})
    assert r.status_code == 201
    lib = owner.get("/api/libraries").json()[0]
    assert lib["name"] == "Church" and lib["role"] == "owner"
    r = owner.post(
        f"/api/libraries/{lib['id']}/songs", json={"title": "Test", "key": "G", "lyrics": "[V1]\n.G\n Hello"}
    )
    assert r.status_code == 201
    owner.post(
        f"/api/libraries/{lib['id']}/members", json={"email": "b@x.org", "password": "password2", "role": "viewer"}
    )

    viewer = TestClient(app)
    assert viewer.post("/api/auth/login", json={"email": "b@x.org", "password": "password2"}).status_code == 200
    assert len(viewer.get(f"/api/libraries/{lib['id']}/songs").json()) == 1
    assert viewer.post(f"/api/libraries/{lib['id']}/songs", json={"title": "Nope"}).status_code == 403
    stranger = TestClient(app)
    stranger.post("/api/auth/signup", json={"email": "c@x.org", "password": "password3"})
    assert stranger.get(f"/api/libraries/{lib['id']}/songs").status_code == 404
