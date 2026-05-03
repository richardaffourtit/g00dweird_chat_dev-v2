"""
Iteration 2 backend tests for g00dweird.com.
Covers: chat history (/api/rooms/{id}/history + WS snapshot.history),
guestbook GET/POST, upload mime/kind validation + rate limit,
streaming download (Content-Length), WS typing/sprite/jukebox queue events.
"""
import os
import json
import asyncio
import pytest
import requests
import websockets

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()).rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("http://", "ws://").replace("https://", "wss://") + "/api/ws"

PNG_BYTES = bytes.fromhex(
    "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
    "0000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
)


@pytest.fixture(scope="module")
def user():
    r = requests.post(f"{API}/join", json={"nickname": "TEST_iter2"}, timeout=30)
    assert r.status_code == 200
    return r.json()


# --------- Guestbook ----------
class TestGuestbook:
    def test_post_and_get(self, user):
        msg = "TEST_gb hello world"
        r = requests.post(f"{API}/guestbook", json={
            "user_id": user["user_id"], "nickname": user["nickname"], "message": msg
        }, timeout=30)
        assert r.status_code == 200, r.text
        entry = r.json()
        assert entry["message"] == msg
        assert "id" in entry and "created_at" in entry

        # Newest-first
        r2 = requests.get(f"{API}/guestbook", timeout=30)
        assert r2.status_code == 200
        entries = r2.json()
        assert len(entries) >= 1
        assert entries[0]["message"] == msg

    def test_post_empty_rejected(self, user):
        r = requests.post(f"{API}/guestbook", json={
            "user_id": user["user_id"], "nickname": user["nickname"], "message": "   "
        }, timeout=30)
        assert r.status_code == 400

    def test_post_too_long_rejected(self, user):
        r = requests.post(f"{API}/guestbook", json={
            "user_id": user["user_id"], "nickname": user["nickname"], "message": "x" * 401
        }, timeout=30)
        assert r.status_code == 400


# --------- Upload mime/kind validation ----------
class TestUploadValidation:
    def test_audio_kind_rejects_image_mime(self, user):
        files = {"file": ("foo.png", PNG_BYTES, "image/png")}
        data = {"user_id": user["user_id"], "nickname": user["nickname"], "kind": "audio"}
        r = requests.post(f"{API}/upload", files=files, data=data, timeout=30)
        assert r.status_code == 400, r.text

    def test_video_kind_rejects_audio_mime(self, user):
        files = {"file": ("foo.mp3", b"ID3" + b"\x00" * 100, "audio/mpeg")}
        data = {"user_id": user["user_id"], "nickname": user["nickname"], "kind": "video"}
        r = requests.post(f"{API}/upload", files=files, data=data, timeout=30)
        assert r.status_code == 400, r.text

    def test_avatar_kind_accepts_image(self, user):
        files = {"file": ("a.png", PNG_BYTES, "image/png")}
        data = {"user_id": user["user_id"], "nickname": user["nickname"], "kind": "avatar"}
        r = requests.post(f"{API}/upload", files=files, data=data, timeout=60)
        assert r.status_code == 200, r.text
        rec = r.json()
        # Streaming download verification
        d = requests.get(f"{API}/files/{rec['storage_path']}", timeout=60)
        assert d.status_code == 200
        assert d.headers.get("Content-Length") == str(rec["size"])
        assert len(d.content) == rec["size"]
        assert d.content == PNG_BYTES


# --------- Upload rate limit ----------
class TestRateLimit:
    def test_eleven_uploads_hits_429(self):
        # Fresh user to avoid contamination
        r = requests.post(f"{API}/join", json={"nickname": "TEST_rl"}, timeout=30)
        assert r.status_code == 200
        u = r.json()
        statuses = []
        for i in range(11):
            files = {"file": (f"a{i}.png", PNG_BYTES, "image/png")}
            data = {"user_id": u["user_id"], "nickname": u["nickname"], "kind": "avatar"}
            resp = requests.post(f"{API}/upload", files=files, data=data, timeout=60)
            statuses.append(resp.status_code)
        # First 10 should be 200, 11th must be 429
        assert statuses[:10].count(200) == 10, f"unexpected: {statuses}"
        assert statuses[10] == 429, f"unexpected: {statuses}"


# --------- Chat history ----------
@pytest.mark.asyncio
async def test_chat_history_endpoint_and_snapshot():
    r = requests.post(f"{API}/join", json={"nickname": "TEST_hist"}, timeout=30)
    u = r.json()
    url = f"{WS_BASE}/jello?user_id={u['user_id']}&nickname={u['nickname']}"
    # First connection: post 3 messages
    msgs = ["TEST_hist_msg_1", "TEST_hist_msg_2", "TEST_hist_msg_3"]
    async with websockets.connect(url) as ws:
        snap = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        assert snap["type"] == "snapshot"
        assert "history" in snap and isinstance(snap["history"], list)
        for m in msgs:
            await ws.send(json.dumps({"type": "chat", "text": m}))
            # Drain echoed chat to ensure server stored it
            for _ in range(5):
                evt = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
                if evt.get("type") == "chat" and evt.get("text") == m and not evt.get("system"):
                    break
    await asyncio.sleep(0.5)
    # GET /history
    r = requests.get(f"{API}/rooms/jello/history?limit=50", timeout=30)
    assert r.status_code == 200
    hist = r.json()
    texts = [h["text"] for h in hist]
    for m in msgs:
        assert m in texts

    # Reconnect: snapshot.history must contain them
    async with websockets.connect(url) as ws2:
        snap2 = json.loads(await asyncio.wait_for(ws2.recv(), timeout=10))
        h_texts = [h["text"] for h in snap2["history"]]
        for m in msgs:
            assert m in h_texts


# --------- Sprite snapshot + broadcast ----------
@pytest.mark.asyncio
async def test_sprite_snapshot_and_broadcast():
    r1 = requests.post(f"{API}/join", json={"nickname": "TEST_spA"}, timeout=30)
    r2 = requests.post(f"{API}/join", json={"nickname": "TEST_spB"}, timeout=30)
    a, b = r1.json(), r2.json()
    url_a = f"{WS_BASE}/mars?user_id={a['user_id']}&nickname={a['nickname']}&sprite_id=ape_king"
    url_b = f"{WS_BASE}/mars?user_id={b['user_id']}&nickname={b['nickname']}"

    async with websockets.connect(url_a) as ws_a:
        await asyncio.wait_for(ws_a.recv(), timeout=10)  # snapshot
        async with websockets.connect(url_b) as ws_b:
            snap_b = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=10))
            users = {u["user_id"]: u for u in snap_b["users"]}
            assert a["user_id"] in users
            assert users[a["user_id"]]["sprite_id"] == "ape_king"

            # B updates sprite -> A receives broadcast
            await ws_b.send(json.dumps({"type": "sprite", "sprite_id": "ghost_tiny"}))
            seen = False
            for _ in range(8):
                evt = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5))
                if evt.get("type") == "sprite" and evt.get("user_id") == b["user_id"]:
                    assert evt["sprite_id"] == "ghost_tiny"
                    seen = True
                    break
            assert seen


# --------- Typing not echoed back to sender ----------
@pytest.mark.asyncio
async def test_typing_broadcast_excludes_sender():
    r1 = requests.post(f"{API}/join", json={"nickname": "TEST_tyA"}, timeout=30)
    r2 = requests.post(f"{API}/join", json={"nickname": "TEST_tyB"}, timeout=30)
    a, b = r1.json(), r2.json()
    url_a = f"{WS_BASE}/hello?user_id={a['user_id']}&nickname={a['nickname']}"
    url_b = f"{WS_BASE}/hello?user_id={b['user_id']}&nickname={b['nickname']}"

    async with websockets.connect(url_a) as ws_a, websockets.connect(url_b) as ws_b:
        await asyncio.wait_for(ws_a.recv(), timeout=10)
        await asyncio.wait_for(ws_b.recv(), timeout=10)
        # Drain user_joined/system from a
        try:
            while True:
                await asyncio.wait_for(ws_a.recv(), timeout=1.5)
        except asyncio.TimeoutError:
            pass
        # A sends typing
        await ws_a.send(json.dumps({"type": "typing", "typing": True}))
        # B should receive typing
        b_seen = False
        for _ in range(6):
            try:
                evt = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=4))
            except asyncio.TimeoutError:
                break
            if evt.get("type") == "typing" and evt.get("user_id") == a["user_id"]:
                assert evt.get("typing") is True
                b_seen = True
                break
        assert b_seen, "B did not receive typing event"
        # A must NOT receive its own typing back
        a_echo = False
        try:
            while True:
                evt = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=2))
                if evt.get("type") == "typing" and evt.get("user_id") == a["user_id"]:
                    a_echo = True
                    break
        except asyncio.TimeoutError:
            pass
        assert not a_echo, "typing event was echoed back to sender"


# --------- Jukebox queue/next/clear ----------
@pytest.mark.asyncio
async def test_jukebox_enqueue_next_clear():
    r = requests.post(f"{API}/join", json={"nickname": "TEST_jq"}, timeout=30)
    u = r.json()
    room = "heaven"
    # Reset state by hitting state endpoint (no reset endpoint; rely on isolated room)
    url = f"{WS_BASE}/{room}?user_id={u['user_id']}&nickname={u['nickname']}"
    async with websockets.connect(url) as ws:
        await asyncio.wait_for(ws.recv(), timeout=10)  # snapshot

        # Ensure no current_audio (clear if any)
        await ws.send(json.dumps({"type": "jukebox_stop", "kind": "audio"}))
        await ws.send(json.dumps({"type": "jukebox_clear", "kind": "audio"}))
        await asyncio.sleep(0.4)
        # Drain
        try:
            while True:
                await asyncio.wait_for(ws.recv(), timeout=0.8)
        except asyncio.TimeoutError:
            pass

        # First enqueue should auto-promote to current_audio
        await ws.send(json.dumps({
            "type": "jukebox_enqueue", "kind": "audio",
            "file_id": "f1", "url": "http://x/1.wav", "title": "track1",
        }))
        got_play = False
        for _ in range(10):
            try:
                evt = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
            except asyncio.TimeoutError:
                break
            if evt.get("type") == "jukebox_play" and evt.get("kind") == "audio":
                assert evt["track"]["title"] == "track1"
                got_play = True
                break
        assert got_play, "first enqueue did not promote to current_audio"

        # Second enqueue -> goes to queue, broadcast jukebox_queue
        await ws.send(json.dumps({
            "type": "jukebox_enqueue", "kind": "audio",
            "file_id": "f2", "url": "http://x/2.wav", "title": "track2",
        }))
        got_q = False
        for _ in range(8):
            try:
                evt = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
            except asyncio.TimeoutError:
                break
            if evt.get("type") == "jukebox_queue" and evt.get("kind") == "audio":
                if any(t.get("title") == "track2" for t in evt["queue"]):
                    got_q = True
                    break
        assert got_q

        # Verify state
        s = requests.get(f"{API}/rooms/{room}/state", timeout=15).json()
        assert s["current_audio"]["title"] == "track1"
        assert any(t["title"] == "track2" for t in s["audio_queue"])

        # Next -> track2 becomes current
        await ws.send(json.dumps({"type": "jukebox_next", "kind": "audio"}))
        got_next = False
        for _ in range(8):
            try:
                evt = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
            except asyncio.TimeoutError:
                break
            if evt.get("type") == "jukebox_play" and evt.get("track", {}).get("title") == "track2":
                got_next = True
                break
        assert got_next

        # Enqueue another then clear
        await ws.send(json.dumps({
            "type": "jukebox_enqueue", "kind": "audio",
            "file_id": "f3", "url": "http://x/3.wav", "title": "track3",
        }))
        await asyncio.sleep(0.3)
        await ws.send(json.dumps({"type": "jukebox_clear", "kind": "audio"}))
        await asyncio.sleep(0.4)
        s2 = requests.get(f"{API}/rooms/{room}/state", timeout=15).json()
        assert s2["audio_queue"] == []
