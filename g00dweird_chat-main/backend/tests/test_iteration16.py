"""Iteration 16 tests:
- GET /api/profile/{nickname} (new public profile endpoint)
- POST /api/upload (verify object storage upload path is alive)
- WS /api/ws/{room_id} updates user doc with sprite_id/anim_id/avatar_path/last_room_id/last_seen_at
- Profile reflects uploads + tags + live presence
"""
import asyncio
import io
import json
import os
import time
import uuid

import pytest
import requests
import websockets

def _read_frontend_url():
    p = "/app/frontend/.env"
    if os.path.exists(p):
        with open(p) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    return os.environ.get("REACT_APP_BACKEND_URL", "")

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_url()).rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL not configured"
API = f"{BASE}/api"
WS_BASE = BASE.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"


def _join(nick=None):
    nick = nick or f"TEST_i16_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/join", json={"nickname": nick}, timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    return d["user_id"], d["nickname"]


# ---------- profile endpoint ----------

class TestProfileEndpoint:
    def test_profile_unknown_nickname_returns_404(self):
        r = requests.get(f"{API}/profile/NOPE_does_not_exist_{uuid.uuid4().hex[:6]}", timeout=10)
        assert r.status_code == 404

    def test_profile_after_join_returns_expected_shape(self):
        uid, nick = _join()
        r = requests.get(f"{API}/profile/{nick}", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        # required fields
        for k in ("user_id", "nickname", "bio", "created_at",
                  "last_room_id", "last_seen_at",
                  "sprite_id", "anim_id", "avatar_path",
                  "live_room_id", "live_room_name", "tags", "uploads"):
            assert k in d, f"missing {k} in profile response: {d.keys()}"
        assert d["user_id"] == uid
        assert d["nickname"] == nick
        assert d["bio"] == ""
        assert isinstance(d["tags"], list)
        assert isinstance(d["uploads"], list)
        # no MongoDB _id leak
        assert "_id" not in d
        for t in d["tags"]:
            assert "_id" not in t
        for u in d["uploads"]:
            assert "_id" not in u

    def test_profile_reflects_bio_update(self):
        uid, nick = _join()
        bio = "TEST_iter16 bio cyber"
        rb = requests.put(f"{API}/users/{uid}/bio", json={"bio": bio}, timeout=10)
        assert rb.status_code == 200
        rp = requests.get(f"{API}/profile/{nick}", timeout=10)
        assert rp.status_code == 200
        assert rp.json()["bio"] == bio


# ---------- upload ----------

PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf"
    b"\xc0\xc0\xc0\xc0\xc0\x00\x00\x00\x06\x00\x03\x06\x05\xa7]\x00\x00\x00"
    b"\x00IEND\xaeB`\x82"
)


class TestUploads:
    def test_upload_avatar_returns_200_and_record(self):
        uid, nick = _join()
        files = {"file": ("avatar.png", PNG_BYTES, "image/png")}
        data = {"user_id": uid, "nickname": nick, "kind": "avatar"}
        r = requests.post(f"{API}/upload", files=files, data=data, timeout=20)
        assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
        rec = r.json()
        for k in ("id", "user_id", "kind", "storage_path", "original_filename"):
            assert k in rec, f"missing {k} in {rec}"
        assert rec["user_id"] == uid
        assert rec["kind"] == "avatar"
        assert rec["original_filename"] == "avatar.png"
        # Verify persisted via GET /api/users/{uid}/media
        rm = requests.get(f"{API}/users/{uid}/media", timeout=10)
        assert rm.status_code == 200
        assert any(f["id"] == rec["id"] for f in rm.json())

    def test_upload_appears_in_profile(self):
        uid, nick = _join()
        files = {"file": ("avatar.png", PNG_BYTES, "image/png")}
        data = {"user_id": uid, "nickname": nick, "kind": "avatar"}
        r = requests.post(f"{API}/upload", files=files, data=data, timeout=20)
        assert r.status_code == 200, r.text
        upload_id = r.json()["id"]
        # Profile should include this upload
        rp = requests.get(f"{API}/profile/{nick}", timeout=10)
        assert rp.status_code == 200
        ups = rp.json()["uploads"]
        assert any(u["id"] == upload_id for u in ups), f"upload {upload_id} not in profile uploads {ups}"


# ---------- WS persistence + live presence ----------

async def _ws_connect_and_send(room_id, uid, nick, sprite_id="frog", anim_id=None, send_msgs=None, hold=0.5):
    qs = f"user_id={uid}&nickname={nick}&sprite_id={sprite_id}"
    if anim_id:
        qs += f"&anim_id={anim_id}"
    url = f"{WS_BASE}/{room_id}?{qs}"
    async with websockets.connect(url) as ws:
        # consume initial snapshot
        try:
            await asyncio.wait_for(ws.recv(), timeout=3.0)
        except asyncio.TimeoutError:
            pass
        for m in (send_msgs or []):
            await ws.send(json.dumps(m))
            await asyncio.sleep(0.15)
        await asyncio.sleep(hold)


class TestWSProfileIntegration:
    def test_ws_join_persists_sprite_anim_to_user_doc(self):
        uid, nick = _join()
        # Use first available room
        rooms = requests.get(f"{API}/rooms", timeout=10).json()
        assert len(rooms) >= 1
        room_id = rooms[0]["id"]

        async def go():
            await _ws_connect_and_send(room_id, uid, nick, sprite_id="frog", anim_id="ghost",
                                       send_msgs=[], hold=0.6)
        asyncio.run(go())
        # Give server a tick to flush
        time.sleep(0.4)
        rp = requests.get(f"{API}/profile/{nick}", timeout=10)
        assert rp.status_code == 200
        d = rp.json()
        assert d["last_room_id"] == room_id, f"last_room_id={d['last_room_id']} expected {room_id}"
        assert d["sprite_id"] == "frog"
        assert d["anim_id"] == "ghost"
        # last_seen_at should be set after disconnect
        assert d["last_seen_at"], "last_seen_at not set after disconnect"
        # We disconnected, so live_room_id should be None
        assert d["live_room_id"] is None

    def test_profile_shows_live_room_while_connected(self):
        uid, nick = _join()
        rooms = requests.get(f"{API}/rooms", timeout=10).json()
        room_id = rooms[0]["id"]
        room_name = rooms[0]["name"]

        async def go():
            qs = f"user_id={uid}&nickname={nick}&sprite_id=cat"
            url = f"{WS_BASE}/{room_id}?{qs}"
            async with websockets.connect(url) as ws:
                try:
                    await asyncio.wait_for(ws.recv(), timeout=3.0)
                except asyncio.TimeoutError:
                    pass
                # While connected, query profile
                await asyncio.sleep(0.4)
                rp = requests.get(f"{API}/profile/{nick}", timeout=10)
                assert rp.status_code == 200
                d = rp.json()
                assert d["live_room_id"] == room_id, f"live_room_id={d['live_room_id']}"
                assert d["live_room_name"] == room_name
        asyncio.run(go())

    def test_profile_reflects_sprayed_tags(self):
        uid, nick = _join()
        rooms = requests.get(f"{API}/rooms", timeout=10).json()
        room_id = rooms[0]["id"]

        async def go():
            qs = f"user_id={uid}&nickname={nick}&sprite_id=cat"
            url = f"{WS_BASE}/{room_id}?{qs}"
            async with websockets.connect(url) as ws:
                try:
                    await asyncio.wait_for(ws.recv(), timeout=3.0)
                except asyncio.TimeoutError:
                    pass
                # Spray a tag via WS
                await ws.send(json.dumps({
                    "type": "tag_spray",
                    "tag": "TEST_i16",
                    "x": 100, "y": 100,
                    "scale": 1.0, "rot": 0,
                    "color": "#ff00ff",
                }))
                await asyncio.sleep(0.4)
        asyncio.run(go())
        time.sleep(0.3)
        rp = requests.get(f"{API}/profile/{nick}", timeout=10)
        assert rp.status_code == 200
        tags = rp.json()["tags"]
        assert any(t.get("tag") == "TEST_i16" for t in tags), f"sprayed tag not in profile.tags: {tags}"


# ---------- existing flows regression ----------

class TestExistingFlows:
    def test_join(self):
        r = requests.post(f"{API}/join", json={"nickname": "TEST_i16_join"}, timeout=10)
        assert r.status_code == 200
        assert "user_id" in r.json()

    def test_get_rooms(self):
        r = requests.get(f"{API}/rooms", timeout=10)
        assert r.status_code == 200
        rooms = r.json()
        assert isinstance(rooms, list) and len(rooms) >= 1
        assert all("id" in rm and "name" in rm for rm in rooms)

    def test_bio_round_trip(self):
        uid, nick = _join()
        r = requests.put(f"{API}/users/{uid}/bio", json={"bio": "hello world"}, timeout=10)
        assert r.status_code == 200
        rg = requests.get(f"{API}/users/{uid}/bio", timeout=10)
        assert rg.status_code == 200
        assert rg.json()["bio"] == "hello world"
