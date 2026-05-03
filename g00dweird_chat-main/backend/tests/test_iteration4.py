"""
Iteration 4 backend tests: fullfunk flag on chat & thought broadcasts.
- chat with fullfunk:true broadcasts msg with fullfunk=true and persists in db.messages
- *think with fullfunk:true broadcasts thought with fullfunk=true and updates conn.thought_fullfunk
- Subsequent snapshot to a NEW client includes thought + thought_fullfunk for the thinking user
- Regular chat (fullfunk:false) -> last_message.fullfunk=false in snapshot for new joiner (<8s)
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


async def _drain(ws, t=1.0):
    try:
        while True:
            await asyncio.wait_for(ws.recv(), timeout=t)
    except asyncio.TimeoutError:
        pass


@pytest.mark.asyncio
async def test_chat_fullfunk_true_broadcasts_and_persists():
    r = requests.post(f"{API}/join", json={"nickname": "TEST_i4ff_a"}, timeout=30)
    a = r.json()
    r2 = requests.post(f"{API}/join", json={"nickname": "TEST_i4ff_b"}, timeout=30)
    b = r2.json()
    url_a = f"{WS_BASE}/hello?user_id={a['user_id']}&nickname={a['nickname']}"
    url_b = f"{WS_BASE}/hello?user_id={b['user_id']}&nickname={b['nickname']}"
    async with websockets.connect(url_a) as ws_a, websockets.connect(url_b) as ws_b:
        await asyncio.wait_for(ws_a.recv(), timeout=10)
        await asyncio.wait_for(ws_b.recv(), timeout=10)
        await _drain(ws_a); await _drain(ws_b)
        await ws_a.send(json.dumps({"type": "chat", "text": "TEST_HI_FF", "fullfunk": True}))
        seen = False
        for _ in range(8):
            try:
                evt = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=4))
            except asyncio.TimeoutError:
                break
            if evt.get("type") == "chat" and evt.get("text") == "TEST_HI_FF" and not evt.get("system"):
                assert evt.get("fullfunk") is True, f"fullfunk flag not propagated: {evt}"
                seen = True
                break
        assert seen, "B did not see the fullfunk chat message"

    # Verify persisted via /api/rooms/hello/history
    hist = requests.get(f"{API}/rooms/hello/history?limit=50", timeout=30).json()
    matching = [m for m in hist if m.get("text") == "TEST_HI_FF"]
    assert matching, "fullfunk message not persisted"
    assert matching[-1].get("fullfunk") is True, "persisted message missing fullfunk=true"


@pytest.mark.asyncio
async def test_think_fullfunk_broadcasts_and_snapshot_includes_thought_fullfunk():
    r = requests.post(f"{API}/join", json={"nickname": "TEST_i4_thff"}, timeout=30)
    u = r.json()
    url = f"{WS_BASE}/jello?user_id={u['user_id']}&nickname={u['nickname']}"
    async with websockets.connect(url) as ws:
        await asyncio.wait_for(ws.recv(), timeout=10)
        await ws.send(json.dumps({"type": "chat", "text": "*think cloud dream", "fullfunk": True}))
        seen = False
        for _ in range(8):
            try:
                evt = json.loads(await asyncio.wait_for(ws.recv(), timeout=4))
            except asyncio.TimeoutError:
                break
            if evt.get("type") == "thought" and evt.get("user_id") == u["user_id"]:
                assert evt.get("thought") == "cloud dream"
                assert evt.get("fullfunk") is True
                seen = True
                break
            assert evt.get("type") != "chat" or evt.get("system"), \
                "*think should NOT broadcast a non-system chat"
        assert seen, "thought broadcast with fullfunk not received"

        # New client joins same room - snapshot must include thought + thought_fullfunk
        r2 = requests.post(f"{API}/join", json={"nickname": "TEST_i4_thff_obs"}, timeout=30)
        u2 = r2.json()
        url2 = f"{WS_BASE}/jello?user_id={u2['user_id']}&nickname={u2['nickname']}"
        async with websockets.connect(url2) as ws2:
            snap = json.loads(await asyncio.wait_for(ws2.recv(), timeout=10))
            assert snap["type"] == "snapshot"
            users = {x["user_id"]: x for x in snap["users"]}
            assert u["user_id"] in users
            me = users[u["user_id"]]
            assert me.get("thought") == "cloud dream"
            assert "thought_fullfunk" in me, "snapshot user missing thought_fullfunk"
            assert me["thought_fullfunk"] is True


@pytest.mark.asyncio
async def test_regular_chat_fullfunk_false_in_snapshot_last_message():
    r = requests.post(f"{API}/join", json={"nickname": "TEST_i4_lmff"}, timeout=30)
    u = r.json()
    url = f"{WS_BASE}/mars?user_id={u['user_id']}&nickname={u['nickname']}"
    async with websockets.connect(url) as ws:
        await asyncio.wait_for(ws.recv(), timeout=10)
        await ws.send(json.dumps({"type": "chat", "text": "TEST_lmff_plain", "fullfunk": False}))
        for _ in range(8):
            try:
                evt = json.loads(await asyncio.wait_for(ws.recv(), timeout=4))
            except asyncio.TimeoutError:
                break
            if evt.get("type") == "chat" and evt.get("text") == "TEST_lmff_plain":
                assert evt.get("fullfunk") is False
                break

        r2 = requests.post(f"{API}/join", json={"nickname": "TEST_i4_lmff_obs"}, timeout=30)
        u2 = r2.json()
        url2 = f"{WS_BASE}/mars?user_id={u2['user_id']}&nickname={u2['nickname']}"
        async with websockets.connect(url2) as ws2:
            snap = json.loads(await asyncio.wait_for(ws2.recv(), timeout=10))
            users = {x["user_id"]: x for x in snap["users"]}
            assert u["user_id"] in users
            lm = users[u["user_id"]]["last_message"]
            assert lm is not None
            assert lm.get("text") == "TEST_lmff_plain"
            assert "fullfunk" in lm
            assert lm["fullfunk"] is False
