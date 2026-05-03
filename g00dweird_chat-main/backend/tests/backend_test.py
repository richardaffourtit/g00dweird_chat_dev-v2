"""
Backend tests for g00dweird.com Win95 retro chatroom.
Covers: /api/join, /api/rooms, /api/upload, /api/files, /api/users/{id}/media,
/api/media/recent, /api/rooms/{id}/state and WebSocket /api/ws/{room_id}.
"""
import os
import io
import json
import struct
import asyncio
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("http://", "ws://").replace("https://", "wss://") + "/api/ws"

# ------------- Fixtures -------------
@pytest.fixture(scope="module")
def user_a():
    r = requests.post(f"{API}/join", json={"nickname": "TEST_alpha"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()

@pytest.fixture(scope="module")
def user_b():
    r = requests.post(f"{API}/join", json={"nickname": "TEST_beta"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()

# Tiny valid PNG (1x1 transparent)
PNG_BYTES = bytes.fromhex(
    "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
    "0000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
)

def make_wav_bytes(samples=220):
    # Tiny 16-bit mono WAV
    sample_rate = 8000
    data = b"\x00\x00" * samples
    fmt = b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVE"
    fmt += b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16)
    fmt += b"data" + struct.pack("<I", len(data)) + data
    return fmt

def make_mp4_bytes():
    # Minimal ftyp box (not a valid playable mp4, but backend only stores bytes)
    return b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2mp41" + b"\x00" * 16

# ------------- /api/join -------------
class TestJoin:
    def test_join_valid(self):
        r = requests.post(f"{API}/join", json={"nickname": "TEST_joiner"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "user_id" in data and len(data["user_id"]) > 10
        assert data["nickname"] == "TEST_joiner"

    def test_join_too_short(self):
        r = requests.post(f"{API}/join", json={"nickname": "x"}, timeout=30)
        assert r.status_code == 400

    def test_join_too_long(self):
        r = requests.post(f"{API}/join", json={"nickname": "x" * 25}, timeout=30)
        assert r.status_code == 400

# ------------- /api/rooms -------------
class TestRooms:
    def test_list_rooms(self):
        r = requests.get(f"{API}/rooms", timeout=30)
        assert r.status_code == 200
        data = r.json()
        # 12 rooms: 5 original + 6 themed + inspiration-theatre (iter6)
        assert len(data) >= 11
        ids = {x["id"] for x in data}
        assert {"hello", "jello", "heaven", "mars", "regular-cafe"}.issubset(ids)
        assert {"toxic-void", "jungle", "liminal-backroom"}.issubset(ids)

    def test_room_state(self):
        r = requests.get(f"{API}/rooms/hello/state", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["room_id"] == "hello"
        assert "users" in data and "audio_queue" in data

    def test_room_state_not_found(self):
        r = requests.get(f"{API}/rooms/does-not-exist/state", timeout=30)
        assert r.status_code == 404

# ------------- /api/upload -------------
class TestUpload:
    def test_upload_avatar(self, user_a):
        files = {"file": ("avatar.png", PNG_BYTES, "image/png")}
        data = {"user_id": user_a["user_id"], "nickname": user_a["nickname"], "kind": "avatar"}
        r = requests.post(f"{API}/upload", files=files, data=data, timeout=120)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["kind"] == "avatar"
        assert rec["user_id"] == user_a["user_id"]
        assert rec["size"] > 0
        assert rec["storage_path"]
        pytest.avatar_rec = rec

    def test_upload_audio(self, user_a):
        files = {"file": ("t.wav", make_wav_bytes(), "audio/wav")}
        data = {"user_id": user_a["user_id"], "nickname": user_a["nickname"], "kind": "audio"}
        r = requests.post(f"{API}/upload", files=files, data=data, timeout=120)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["kind"] == "audio"
        pytest.audio_rec = rec

    def test_upload_video(self, user_a):
        files = {"file": ("t.mp4", make_mp4_bytes(), "video/mp4")}
        data = {"user_id": user_a["user_id"], "nickname": user_a["nickname"], "kind": "video"}
        r = requests.post(f"{API}/upload", files=files, data=data, timeout=120)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["kind"] == "video"
        pytest.video_rec = rec

    def test_upload_invalid_kind(self, user_a):
        files = {"file": ("t.bin", b"x", "application/octet-stream")}
        data = {"user_id": user_a["user_id"], "nickname": user_a["nickname"], "kind": "weird"}
        r = requests.post(f"{API}/upload", files=files, data=data, timeout=30)
        assert r.status_code == 400

    def test_download_uploaded_file(self, user_a):
        rec = getattr(pytest, "avatar_rec", None)
        assert rec is not None, "need avatar upload first"
        r = requests.get(f"{API}/files/{rec['storage_path']}", timeout=60)
        assert r.status_code == 200
        assert len(r.content) == rec["size"]
        assert "image" in r.headers.get("Content-Type", "")

    def test_user_media_list(self, user_a):
        r = requests.get(f"{API}/users/{user_a['user_id']}/media", timeout=30)
        assert r.status_code == 200
        data = r.json()
        kinds = {d["kind"] for d in data}
        assert {"avatar", "audio", "video"}.issubset(kinds)

    def test_recent_media_audio(self):
        r = requests.get(f"{API}/media/recent?kind=audio", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert all(d["kind"] == "audio" for d in data)
        assert len(data) >= 1

# ------------- WebSocket -------------
@pytest.mark.asyncio
async def test_ws_chat_and_presence(user_a, user_b):
    url_a = f"{WS_BASE}/hello?user_id={user_a['user_id']}&nickname={user_a['nickname']}"
    url_b = f"{WS_BASE}/hello?user_id={user_b['user_id']}&nickname={user_b['nickname']}"
    async with websockets.connect(url_a) as ws_a:
        snap_a = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=10))
        assert snap_a["type"] == "snapshot"
        # Connect B
        async with websockets.connect(url_b) as ws_b:
            snap_b = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=10))
            assert snap_b["type"] == "snapshot"
            # A should receive user_joined and a system chat about B
            got_join = False
            got_system = False
            try:
                for _ in range(6):
                    m = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5))
                    if m.get("type") == "user_joined":
                        got_join = True
                    if m.get("type") == "chat" and m.get("system"):
                        got_system = True
                    if got_join and got_system:
                        break
            except asyncio.TimeoutError:
                pass
            assert got_join, "A did not see user_joined for B"
            assert got_system, "A did not see system join message"

            # B sends chat, A receives
            await ws_b.send(json.dumps({"type": "chat", "text": "hello from beta"}))
            chat_seen = False
            for _ in range(6):
                m = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5))
                if m.get("type") == "chat" and m.get("text") == "hello from beta":
                    assert m["nickname"] == user_b["nickname"]
                    chat_seen = True
                    break
            assert chat_seen

            # Move
            await ws_b.send(json.dumps({"type": "move", "x": 123, "y": 88}))
            move_seen = False
            for _ in range(6):
                m = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5))
                if m.get("type") == "move" and m.get("user_id") == user_b["user_id"]:
                    assert m["x"] == 123 and m["y"] == 88
                    move_seen = True
                    break
            assert move_seen

            # Avatar update
            await ws_b.send(json.dumps({"type": "avatar", "avatar_url": "http://x/a.png"}))
            avatar_seen = False
            for _ in range(6):
                m = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5))
                if m.get("type") == "avatar" and m.get("user_id") == user_b["user_id"]:
                    assert m["avatar_url"] == "http://x/a.png"
                    avatar_seen = True
                    break
            assert avatar_seen

            # Jukebox play
            await ws_b.send(json.dumps({
                "type": "jukebox_play", "kind": "audio",
                "file_id": "fid", "url": "http://x/track.wav", "title": "demo",
            }))
            jb_seen = False
            for _ in range(6):
                m = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5))
                if m.get("type") == "jukebox_play":
                    assert m["kind"] == "audio"
                    jb_seen = True
                    break
            assert jb_seen

            # Confirm room state reflects current_audio
            r = requests.get(f"{API}/rooms/hello/state", timeout=15)
            assert r.status_code == 200
            state = r.json()
            assert state["current_audio"] is not None
            assert state["current_audio"]["title"] == "demo"

            # jukebox_stop
            await ws_b.send(json.dumps({"type": "jukebox_stop", "kind": "audio"}))
            await asyncio.sleep(0.5)
            r = requests.get(f"{API}/rooms/hello/state", timeout=15)
            assert r.json()["current_audio"] is None
