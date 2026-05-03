"""
Iteration 3 backend tests for g00dweird.com.
Covers: 5 new rooms (hello, jello, heaven, mars, regular-cafe) with bg_url,
WS snapshot users include thought + last_message, *think prefix → thought
broadcast (no chat), *think alone clears thought, type:'thought' direct,
regular chat updates last_message, user_joined includes sprite_id+x+y.
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

EXPECTED_IDS = {"hello", "jello", "heaven", "mars", "regular-cafe"}


# --------- Rooms with bg_url ----------
class TestRoomsBg:
    def test_five_rooms_with_bg(self):
        r = requests.get(f"{API}/rooms", timeout=30)
        assert r.status_code == 200
        rooms = r.json()
        # Backend now serves 11 rooms (5 original + 6 new). Assert the original 5 are still present with bg_url.
        assert len(rooms) >= 5
        ids = {x["id"] for x in rooms}
        assert EXPECTED_IDS.issubset(ids)
        for room in rooms:
            if room["id"] in EXPECTED_IDS:
                assert "bg_url" in room
                assert room["bg_url"]
                assert room["bg_url"].startswith("/worlds/")
                assert room["bg_url"].endswith(".png")

    def test_regular_cafe_state_with_hyphen(self):
        r = requests.get(f"{API}/rooms/regular-cafe/state", timeout=30)
        assert r.status_code == 200
        assert r.json()["room_id"] == "regular-cafe"


# --------- Snapshot users include thought + last_message ----------
@pytest.mark.asyncio
async def test_snapshot_users_have_thought_and_last_message():
    r = requests.post(f"{API}/join", json={"nickname": "TEST_i3snap"}, timeout=30)
    u = r.json()
    url = f"{WS_BASE}/hello?user_id={u['user_id']}&nickname={u['nickname']}&sprite_id=ghost_tiny"
    async with websockets.connect(url) as ws:
        snap = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        assert snap["type"] == "snapshot"
        users = snap["users"]
        me = next((x for x in users if x["user_id"] == u["user_id"]), None)
        assert me is not None
        # Fields must exist (may be None)
        assert "thought" in me
        assert "last_message" in me
        assert me["thought"] is None
        assert me["last_message"] is None
        assert "x" in me and "y" in me
        assert me["sprite_id"] == "ghost_tiny"


# --------- *think intercepts chat → thought broadcast ----------
@pytest.mark.asyncio
async def test_think_prefix_broadcasts_thought_no_chat():
    r1 = requests.post(f"{API}/join", json={"nickname": "TEST_thA"}, timeout=30)
    r2 = requests.post(f"{API}/join", json={"nickname": "TEST_thB"}, timeout=30)
    a, b = r1.json(), r2.json()
    url_a = f"{WS_BASE}/jello?user_id={a['user_id']}&nickname={a['nickname']}"
    url_b = f"{WS_BASE}/jello?user_id={b['user_id']}&nickname={b['nickname']}"

    async with websockets.connect(url_a) as ws_a, websockets.connect(url_b) as ws_b:
        await asyncio.wait_for(ws_a.recv(), timeout=10)
        await asyncio.wait_for(ws_b.recv(), timeout=10)
        # drain
        for ws in (ws_a, ws_b):
            try:
                while True:
                    await asyncio.wait_for(ws.recv(), timeout=1.0)
            except asyncio.TimeoutError:
                pass

        # A sends *think
        await ws_a.send(json.dumps({"type": "chat", "text": "*think hello there"}))

        # Sender (A) should ALSO receive thought broadcast (no exclude)
        a_seen = False
        for _ in range(6):
            try:
                evt = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=4))
            except asyncio.TimeoutError:
                break
            if evt.get("type") == "thought" and evt.get("user_id") == a["user_id"]:
                assert evt["thought"] == "hello there"
                a_seen = True
                break
            assert evt.get("type") != "chat" or evt.get("system"), \
                "*think should NOT broadcast a non-system chat"
        assert a_seen, "sender did not receive thought broadcast"

        # B should also receive it
        b_seen = False
        for _ in range(6):
            try:
                evt = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=4))
            except asyncio.TimeoutError:
                break
            if evt.get("type") == "thought" and evt.get("user_id") == a["user_id"]:
                assert evt["thought"] == "hello there"
                b_seen = True
                break
            assert evt.get("type") != "chat" or evt.get("system")
        assert b_seen

        # Now A clears thought with bare "*think"
        await ws_a.send(json.dumps({"type": "chat", "text": "*think"}))
        cleared = False
        for _ in range(6):
            try:
                evt = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=4))
            except asyncio.TimeoutError:
                break
            if evt.get("type") == "thought" and evt.get("user_id") == a["user_id"]:
                assert evt["thought"] is None
                cleared = True
                break
        assert cleared, "*think alone did not clear thought"


# --------- direct type:'thought' ----------
@pytest.mark.asyncio
async def test_direct_thought_event():
    r = requests.post(f"{API}/join", json={"nickname": "TEST_th_direct"}, timeout=30)
    u = r.json()
    url = f"{WS_BASE}/heaven?user_id={u['user_id']}&nickname={u['nickname']}"
    async with websockets.connect(url) as ws:
        await asyncio.wait_for(ws.recv(), timeout=10)
        await ws.send(json.dumps({"type": "thought", "text": "direct thought"}))
        seen = False
        for _ in range(6):
            try:
                evt = json.loads(await asyncio.wait_for(ws.recv(), timeout=4))
            except asyncio.TimeoutError:
                break
            if evt.get("type") == "thought" and evt.get("user_id") == u["user_id"]:
                assert evt["thought"] == "direct thought"
                seen = True
                break
        assert seen


# --------- regular chat updates last_message in subsequent snapshot ----------
@pytest.mark.asyncio
async def test_regular_chat_updates_last_message_in_snapshot():
    r = requests.post(f"{API}/join", json={"nickname": "TEST_lm"}, timeout=30)
    u = r.json()
    url = f"{WS_BASE}/mars?user_id={u['user_id']}&nickname={u['nickname']}"
    async with websockets.connect(url) as ws:
        await asyncio.wait_for(ws.recv(), timeout=10)
        await ws.send(json.dumps({"type": "chat", "text": "TEST_lm hello bubble"}))
        # wait for echo
        for _ in range(6):
            try:
                evt = json.loads(await asyncio.wait_for(ws.recv(), timeout=4))
            except asyncio.TimeoutError:
                break
            if evt.get("type") == "chat" and evt.get("text") == "TEST_lm hello bubble":
                break

        # Open second connection from another user - snapshot should include last_message
        r2 = requests.post(f"{API}/join", json={"nickname": "TEST_lm_obs"}, timeout=30)
        u2 = r2.json()
        url2 = f"{WS_BASE}/mars?user_id={u2['user_id']}&nickname={u2['nickname']}"
        async with websockets.connect(url2) as ws2:
            snap = json.loads(await asyncio.wait_for(ws2.recv(), timeout=10))
            users = {x["user_id"]: x for x in snap["users"]}
            assert u["user_id"] in users
            lm = users[u["user_id"]]["last_message"]
            assert lm is not None
            assert lm["text"] == "TEST_lm hello bubble"
            assert "ts" in lm


# --------- user_joined now includes sprite_id + x + y ----------
@pytest.mark.asyncio
async def test_user_joined_includes_sprite_x_y():
    r1 = requests.post(f"{API}/join", json={"nickname": "TEST_ujA"}, timeout=30)
    r2 = requests.post(f"{API}/join", json={"nickname": "TEST_ujB"}, timeout=30)
    a, b = r1.json(), r2.json()
    url_a = f"{WS_BASE}/regular-cafe?user_id={a['user_id']}&nickname={a['nickname']}"
    url_b = (f"{WS_BASE}/regular-cafe?user_id={b['user_id']}&nickname={b['nickname']}"
             f"&sprite_id=ape_king")
    async with websockets.connect(url_a) as ws_a:
        await asyncio.wait_for(ws_a.recv(), timeout=10)
        async with websockets.connect(url_b) as ws_b:
            await asyncio.wait_for(ws_b.recv(), timeout=10)
            # A receives user_joined for B
            seen = False
            for _ in range(8):
                try:
                    evt = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=4))
                except asyncio.TimeoutError:
                    break
                if evt.get("type") == "user_joined" and evt.get("user", {}).get("user_id") == b["user_id"]:
                    user = evt["user"]
                    assert user.get("sprite_id") == "ape_king"
                    assert "x" in user and isinstance(user["x"], (int, float))
                    assert "y" in user and isinstance(user["y"], (int, float))
                    seen = True
                    break
            assert seen, "A did not see user_joined with sprite_id/x/y for B"
