"""
iter6 backend tests for:
  - new room "inspiration-theatre" present in /api/rooms
  - WS youtube_play, youtube_enqueue, youtube_next, youtube_stop, youtube_clear
  - REST /api/rooms/{id}/state includes current_youtube + youtube_queue
"""
import asyncio
import json
import os

import pytest
import requests
import websockets

BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
)
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("http://", "ws://").replace("https://", "wss://") + "/api/ws"

ROOM = "inspiration-theatre"
VID_A = "dQw4w9WgXcQ"  # rickroll
VID_B = "9bZkp7q19f0"  # gangnam style


@pytest.fixture(scope="module")
def user_a():
    r = requests.post(f"{API}/join", json={"nickname": "TEST_yt_a"}, timeout=30)
    return r.json()


@pytest.fixture(scope="module")
def user_b():
    r = requests.post(f"{API}/join", json={"nickname": "TEST_yt_b"}, timeout=30)
    return r.json()


def test_inspiration_theatre_room_exists():
    r = requests.get(f"{API}/rooms", timeout=30)
    assert r.status_code == 200
    rooms = r.json()
    ids = {x["id"] for x in rooms}
    assert ROOM in ids
    target = next(r for r in rooms if r["id"] == ROOM)
    assert target["theme"] == "inspiration-theatre"
    assert target["bg_url"]


def test_room_state_includes_youtube_fields():
    # Reset first via clear
    r = requests.get(f"{API}/rooms/{ROOM}/state", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "current_youtube" in body
    assert "youtube_queue" in body
    assert isinstance(body["youtube_queue"], list)


@pytest.mark.asyncio
async def test_ws_youtube_play_broadcasts_to_other(user_a, user_b):
    url_a = f"{WS_BASE}/{ROOM}?user_id={user_a['user_id']}&nickname={user_a['nickname']}"
    url_b = f"{WS_BASE}/{ROOM}?user_id={user_b['user_id']}&nickname={user_b['nickname']}"
    async with websockets.connect(url_a) as ws_a, websockets.connect(url_b) as ws_b:
        await ws_a.recv()  # snapshot
        await ws_b.recv()
        # ensure clean state
        await ws_a.send(json.dumps({"type": "youtube_clear"}))
        await ws_a.send(json.dumps({"type": "youtube_stop"}))
        await asyncio.sleep(0.3)
        # drain
        for _ in range(8):
            try:
                await asyncio.wait_for(ws_a.recv(), timeout=0.4)
            except asyncio.TimeoutError:
                break
        for _ in range(8):
            try:
                await asyncio.wait_for(ws_b.recv(), timeout=0.4)
            except asyncio.TimeoutError:
                break

        # A plays a video
        await ws_a.send(json.dumps({"type": "youtube_play", "video_id": VID_A, "title": "Rick"}))
        seen = None
        for _ in range(8):
            m = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=4))
            if m.get("type") == "youtube_play":
                seen = m
                break
        assert seen, "user_b never received youtube_play"
        assert seen["track"]["video_id"] == VID_A
        assert seen["track"]["by"] == user_a["nickname"]

        # REST state reflects it
        r = requests.get(f"{API}/rooms/{ROOM}/state", timeout=15)
        assert r.json()["current_youtube"]["video_id"] == VID_A


@pytest.mark.asyncio
async def test_ws_youtube_enqueue_and_next(user_a, user_b):
    url_a = f"{WS_BASE}/{ROOM}?user_id={user_a['user_id']}&nickname={user_a['nickname']}"
    url_b = f"{WS_BASE}/{ROOM}?user_id={user_b['user_id']}&nickname={user_b['nickname']}"
    async with websockets.connect(url_a) as ws_a, websockets.connect(url_b) as ws_b:
        await ws_a.recv()
        await ws_b.recv()
        # reset
        await ws_a.send(json.dumps({"type": "youtube_stop"}))
        await ws_a.send(json.dumps({"type": "youtube_clear"}))
        await asyncio.sleep(0.3)
        for _ in range(8):
            try:
                await asyncio.wait_for(ws_a.recv(), timeout=0.4)
            except asyncio.TimeoutError:
                break
        for _ in range(8):
            try:
                await asyncio.wait_for(ws_b.recv(), timeout=0.4)
            except asyncio.TimeoutError:
                break

        # First enqueue with no current track -> becomes current
        await ws_a.send(json.dumps({"type": "youtube_enqueue", "video_id": VID_A, "title": "first"}))
        # Second enqueue -> goes to queue
        await ws_a.send(json.dumps({"type": "youtube_enqueue", "video_id": VID_B, "title": "second"}))
        await asyncio.sleep(0.5)
        # drain inbound for B
        events = []
        for _ in range(10):
            try:
                events.append(json.loads(await asyncio.wait_for(ws_b.recv(), timeout=1)))
            except asyncio.TimeoutError:
                break
        plays = [e for e in events if e.get("type") == "youtube_play"]
        queues = [e for e in events if e.get("type") == "youtube_queue"]
        assert plays, "no youtube_play received after first enqueue"
        assert plays[0]["track"]["video_id"] == VID_A
        assert any(q.get("queue") and q["queue"][0]["video_id"] == VID_B for q in queues), \
            "queue update with second video not received"

        # Now skip — A asks next, B should see VID_B as current
        await ws_a.send(json.dumps({"type": "youtube_next"}))
        seen_next = None
        for _ in range(10):
            try:
                m = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=2))
                if m.get("type") == "youtube_play":
                    seen_next = m
                    break
            except asyncio.TimeoutError:
                break
        assert seen_next and seen_next["track"]["video_id"] == VID_B


@pytest.mark.asyncio
async def test_ws_youtube_invalid_id_ignored(user_a):
    url = f"{WS_BASE}/{ROOM}?user_id={user_a['user_id']}&nickname={user_a['nickname']}"
    async with websockets.connect(url) as ws:
        await ws.recv()  # snapshot
        # cleanup first
        await ws.send(json.dumps({"type": "youtube_stop"}))
        await ws.send(json.dumps({"type": "youtube_clear"}))
        await asyncio.sleep(0.3)
        for _ in range(8):
            try:
                await asyncio.wait_for(ws.recv(), timeout=0.4)
            except asyncio.TimeoutError:
                break
        # empty video_id -> should be ignored, no broadcast/no state change
        await ws.send(json.dumps({"type": "youtube_play", "video_id": ""}))
        await asyncio.sleep(0.5)
        try:
            m = json.loads(await asyncio.wait_for(ws.recv(), timeout=1))
            assert m.get("type") != "youtube_play", "empty id should not broadcast"
        except asyncio.TimeoutError:
            pass
        r = requests.get(f"{API}/rooms/{ROOM}/state", timeout=15)
        assert r.json()["current_youtube"] is None


@pytest.mark.asyncio
async def test_ws_anim_accepts_new_creature_ids(user_a, user_b):
    # iter6: alien/skeleton/slime/tvhead/plant/bat/boo are valid anim_id values
    url_a = f"{WS_BASE}/hello?user_id={user_a['user_id']}&nickname={user_a['nickname']}"
    url_b = f"{WS_BASE}/hello?user_id={user_b['user_id']}&nickname={user_b['nickname']}"
    async with websockets.connect(url_a) as ws_a, websockets.connect(url_b) as ws_b:
        await ws_a.recv()
        await ws_b.recv()
        await ws_a.send(json.dumps({"type": "anim", "anim_id": "tvhead"}))
        await asyncio.sleep(0.3)
        seen = None
        for _ in range(10):
            try:
                m = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=2))
                if m.get("type") == "anim" and m.get("user_id") == user_a["user_id"]:
                    seen = m
                    break
            except asyncio.TimeoutError:
                break
        assert seen and seen["anim_id"] == "tvhead"
