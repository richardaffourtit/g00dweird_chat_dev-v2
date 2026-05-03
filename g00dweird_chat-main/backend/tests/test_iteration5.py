"""
Iteration 5 backend tests: graffiti tags (spray) + animated sprite WS events.

Coverage:
- WS tag_spray places tag, broadcasts to other clients, persists to MongoDB
- REST GET /api/rooms/{id}/tags returns array without _id field
- REST DELETE /api/rooms/{id}/tags clears tags
- WS snapshot on join includes 'tags' array
- WS tag_clear broadcasts tag_clear and removes tags
- WS stance broadcasts user stance to other clients + snapshot reflects anim_stance
- WS anim broadcasts anim_id change + snapshot reflects anim_id
- MAX_TAGS_PER_ROOM cap respected (soft check: after spamming, count <= 80)
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


async def _drain(ws, t=0.8):
    try:
        while True:
            await asyncio.wait_for(ws.recv(), timeout=t)
    except asyncio.TimeoutError:
        pass


async def _recv_snapshot(ws):
    snap = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
    assert snap["type"] == "snapshot"
    return snap


# ---------- tag REST ----------

@pytest.mark.asyncio
async def test_rest_get_and_delete_tags_empty():
    # clear first
    r = requests.delete(f"{API}/rooms/spiderweb/tags", timeout=30)
    assert r.status_code == 200
    assert r.json().get("cleared") is True
    # get returns list
    r2 = requests.get(f"{API}/rooms/spiderweb/tags", timeout=30)
    assert r2.status_code == 200
    assert isinstance(r2.json(), list)


@pytest.mark.asyncio
async def test_rest_tags_404_unknown_room():
    r = requests.get(f"{API}/rooms/not-a-room/tags", timeout=30)
    assert r.status_code == 404
    r2 = requests.delete(f"{API}/rooms/not-a-room/tags", timeout=30)
    assert r2.status_code == 404


# ---------- WS tag_spray ----------

@pytest.mark.asyncio
async def test_ws_tag_spray_broadcasts_persists_and_no_objectid():
    # Clear first
    requests.delete(f"{API}/rooms/jungle/tags", timeout=30)

    a = requests.post(f"{API}/join", json={"nickname": "TEST_i5spr_a"}, timeout=30).json()
    b = requests.post(f"{API}/join", json={"nickname": "TEST_i5spr_b"}, timeout=30).json()
    url_a = f"{WS_BASE}/jungle?user_id={a['user_id']}&nickname={a['nickname']}"
    url_b = f"{WS_BASE}/jungle?user_id={b['user_id']}&nickname={b['nickname']}"
    async with websockets.connect(url_a) as ws_a, websockets.connect(url_b) as ws_b:
        await _recv_snapshot(ws_a)
        await _recv_snapshot(ws_b)
        await _drain(ws_a); await _drain(ws_b)
        await ws_a.send(json.dumps({
            "type": "tag_spray", "tag": "GOOD", "custom": False,
            "x": 123.4, "y": 222.2, "rot": 5.0, "scale": 1.5,
        }))
        # B should receive tag_spray
        seen = None
        for _ in range(10):
            try:
                evt = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=4))
            except asyncio.TimeoutError:
                break
            if evt.get("type") == "tag_spray":
                seen = evt
                break
        assert seen is not None, "User B did not receive tag_spray broadcast"
        tag = seen["tag"]
        for key in ("id", "room_id", "user_id", "nickname", "tag", "custom", "x", "y", "rot", "scale", "created_at"):
            assert key in tag, f"tag missing {key}"
        assert tag["tag"] == "GOOD"
        assert tag["room_id"] == "jungle"
        assert tag["nickname"] == "TEST_i5spr_a"
        assert "_id" not in tag, "tag payload leaks mongo _id"
        assert abs(tag["x"] - 123.4) < 0.01
        assert abs(tag["scale"] - 1.5) < 0.01

    # Verify REST GET returns it, no _id
    resp = requests.get(f"{API}/rooms/jungle/tags", timeout=30)
    assert resp.status_code == 200
    arr = resp.json()
    assert any(t["tag"] == "GOOD" and t["nickname"] == "TEST_i5spr_a" for t in arr)
    for t in arr:
        assert "_id" not in t


@pytest.mark.asyncio
async def test_ws_snapshot_on_join_includes_tags():
    requests.delete(f"{API}/rooms/heaven/tags", timeout=30)
    a = requests.post(f"{API}/join", json={"nickname": "TEST_i5snap_a"}, timeout=30).json()
    url_a = f"{WS_BASE}/heaven?user_id={a['user_id']}&nickname={a['nickname']}"
    async with websockets.connect(url_a) as ws_a:
        await _recv_snapshot(ws_a)
        await ws_a.send(json.dumps({"type": "tag_spray", "tag": "RAD",
                                    "x": 100, "y": 100, "rot": 0, "scale": 1.0}))
        await asyncio.sleep(0.4)

    # New joiner receives snapshot with tags array populated
    b = requests.post(f"{API}/join", json={"nickname": "TEST_i5snap_b"}, timeout=30).json()
    url_b = f"{WS_BASE}/heaven?user_id={b['user_id']}&nickname={b['nickname']}"
    async with websockets.connect(url_b) as ws_b:
        snap = await _recv_snapshot(ws_b)
        assert "tags" in snap, "snapshot missing tags array"
        assert isinstance(snap["tags"], list)
        assert any(t.get("tag") == "RAD" for t in snap["tags"])
        for t in snap["tags"]:
            assert "_id" not in t


@pytest.mark.asyncio
async def test_ws_tag_clear_broadcasts_and_deletes():
    requests.delete(f"{API}/rooms/mars/tags", timeout=30)
    a = requests.post(f"{API}/join", json={"nickname": "TEST_i5clr_a"}, timeout=30).json()
    b = requests.post(f"{API}/join", json={"nickname": "TEST_i5clr_b"}, timeout=30).json()
    url_a = f"{WS_BASE}/mars?user_id={a['user_id']}&nickname={a['nickname']}"
    url_b = f"{WS_BASE}/mars?user_id={b['user_id']}&nickname={b['nickname']}"
    async with websockets.connect(url_a) as ws_a, websockets.connect(url_b) as ws_b:
        await _recv_snapshot(ws_a); await _recv_snapshot(ws_b)
        await _drain(ws_a); await _drain(ws_b)
        await ws_a.send(json.dumps({"type": "tag_spray", "tag": "CHAOS",
                                    "x": 200, "y": 200, "rot": 0, "scale": 1}))
        await asyncio.sleep(0.4)
        await _drain(ws_a); await _drain(ws_b)
        await ws_a.send(json.dumps({"type": "tag_clear"}))
        seen_clear = False
        for _ in range(10):
            try:
                evt = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=4))
            except asyncio.TimeoutError:
                break
            if evt.get("type") == "tag_clear":
                seen_clear = True
                break
        assert seen_clear, "tag_clear not broadcast"

    arr = requests.get(f"{API}/rooms/mars/tags", timeout=30).json()
    assert arr == [] or not any(t.get("tag") == "CHAOS" for t in arr)


# ---------- WS stance ----------

@pytest.mark.asyncio
async def test_ws_stance_broadcasts_and_in_snapshot():
    a = requests.post(f"{API}/join", json={"nickname": "TEST_i5st_a"}, timeout=30).json()
    b = requests.post(f"{API}/join", json={"nickname": "TEST_i5st_b"}, timeout=30).json()
    url_a = f"{WS_BASE}/hello?user_id={a['user_id']}&nickname={a['nickname']}"
    url_b = f"{WS_BASE}/hello?user_id={b['user_id']}&nickname={b['nickname']}"
    async with websockets.connect(url_a) as ws_a, websockets.connect(url_b) as ws_b:
        await _recv_snapshot(ws_a); await _recv_snapshot(ws_b)
        await _drain(ws_a); await _drain(ws_b)
        await ws_a.send(json.dumps({"type": "stance", "stance": "walk"}))
        seen = None
        for _ in range(10):
            try:
                evt = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=4))
            except asyncio.TimeoutError:
                break
            if evt.get("type") == "stance" and evt.get("user_id") == a["user_id"]:
                seen = evt
                break
        assert seen is not None
        assert seen["stance"] == "walk"

        # New joiner snapshot reflects anim_stance
        c = requests.post(f"{API}/join", json={"nickname": "TEST_i5st_c"}, timeout=30).json()
        url_c = f"{WS_BASE}/hello?user_id={c['user_id']}&nickname={c['nickname']}"
        async with websockets.connect(url_c) as ws_c:
            snap = await _recv_snapshot(ws_c)
            users = {u["user_id"]: u for u in snap["users"]}
            assert a["user_id"] in users
            assert users[a["user_id"]].get("anim_stance") == "walk"


# ---------- WS anim ----------

@pytest.mark.asyncio
async def test_ws_anim_change_broadcasts_and_in_snapshot():
    a = requests.post(f"{API}/join", json={"nickname": "TEST_i5an_a"}, timeout=30).json()
    b = requests.post(f"{API}/join", json={"nickname": "TEST_i5an_b"}, timeout=30).json()
    url_a = f"{WS_BASE}/jello?user_id={a['user_id']}&nickname={a['nickname']}"
    url_b = f"{WS_BASE}/jello?user_id={b['user_id']}&nickname={b['nickname']}"
    async with websockets.connect(url_a) as ws_a, websockets.connect(url_b) as ws_b:
        await _recv_snapshot(ws_a); await _recv_snapshot(ws_b)
        await _drain(ws_a); await _drain(ws_b)
        await ws_a.send(json.dumps({"type": "anim", "anim_id": "fairy"}))
        seen = None
        for _ in range(10):
            try:
                evt = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=4))
            except asyncio.TimeoutError:
                break
            if evt.get("type") == "anim" and evt.get("user_id") == a["user_id"]:
                seen = evt
                break
        assert seen is not None
        assert seen.get("anim_id") == "fairy"

        # Invalid anim_id should be ignored (not broadcast)
        await ws_a.send(json.dumps({"type": "anim", "anim_id": "dragon_bogus"}))
        await asyncio.sleep(0.5)

        c = requests.post(f"{API}/join", json={"nickname": "TEST_i5an_c"}, timeout=30).json()
        url_c = f"{WS_BASE}/jello?user_id={c['user_id']}&nickname={c['nickname']}"
        async with websockets.connect(url_c) as ws_c:
            snap = await _recv_snapshot(ws_c)
            users = {u["user_id"]: u for u in snap["users"]}
            assert a["user_id"] in users
            assert users[a["user_id"]].get("anim_id") == "fairy"


# ---------- MAX_TAGS_PER_ROOM enforcement ----------

@pytest.mark.asyncio
async def test_ws_tag_spray_respects_max_cap():
    """Spam many tags then confirm REST returns <= MAX_TAGS_PER_ROOM (80)."""
    requests.delete(f"{API}/rooms/toxic-void/tags", timeout=30)
    a = requests.post(f"{API}/join", json={"nickname": "TEST_i5cap"}, timeout=30).json()
    url_a = f"{WS_BASE}/toxic-void?user_id={a['user_id']}&nickname={a['nickname']}"
    async with websockets.connect(url_a) as ws_a:
        await _recv_snapshot(ws_a)
        for i in range(90):
            await ws_a.send(json.dumps({"type": "tag_spray", "tag": "X",
                                        "x": 100 + i, "y": 100, "rot": 0, "scale": 1}))
        await asyncio.sleep(2.5)

    arr = requests.get(f"{API}/rooms/toxic-void/tags", timeout=30).json()
    assert len(arr) <= 80, f"tag count {len(arr)} exceeds cap 80"
    # Cleanup
    requests.delete(f"{API}/rooms/toxic-void/tags", timeout=30)
