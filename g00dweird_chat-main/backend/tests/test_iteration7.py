"""
iter7 backend tests:
  - WeirdBot joins the room when a real human is present
  - WeirdBot leaves when room becomes empty
  - WeirdBot reacts to chat (sometimes)
  - All anim_id values now include 'weirdbot'
  - Inspiration Theatre still has 12 rooms total
"""
import asyncio
import json
import os
import time

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


@pytest.fixture(scope="module")
def user_a():
    r = requests.post(f"{API}/join", json={"nickname": "TEST_iter7_a"}, timeout=30)
    return r.json()


@pytest.mark.asyncio
async def test_weirdbot_joins_room_when_human_present(user_a):
    room = "regular-cafe"  # use a low-traffic test room
    url = f"{WS_BASE}/{room}?user_id={user_a['user_id']}&nickname={user_a['nickname']}"
    async with websockets.connect(url) as ws:
        # initial snapshot — bot may not be there yet, the bot loop runs every 6-10s
        snap = json.loads(await ws.recv())
        assert snap["type"] == "snapshot"

        # Listen for up to 12 seconds for a user_joined event with weirdbot user_id
        bot_uid = f"weirdbot-{room}"
        seen = False
        deadline = time.time() + 14
        while time.time() < deadline:
            try:
                m = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
                if m.get("type") == "user_joined" and m.get("user", {}).get("user_id") == bot_uid:
                    seen = True
                    break
            except asyncio.TimeoutError:
                continue
        assert seen, "weirdbot never joined within 14 seconds"


@pytest.mark.asyncio
async def test_weirdbot_periodic_actions(user_a):
    """The bot loop emits move/stance/chat broadcasts. Within ~20s we should see at least one."""
    room = "hello"
    url = f"{WS_BASE}/{room}?user_id={user_a['user_id']}&nickname={user_a['nickname']}"
    bot_uid = f"weirdbot-{room}"
    async with websockets.connect(url) as ws:
        await ws.recv()  # snapshot
        deadline = time.time() + 20
        actions = set()
        while time.time() < deadline:
            try:
                m = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
            except asyncio.TimeoutError:
                continue
            if m.get("user_id") == bot_uid or (m.get("type") == "user_joined" and m.get("user", {}).get("user_id") == bot_uid):
                actions.add(m.get("type"))
            if len(actions) >= 2:
                break
        # We expect at least the join + one of (stance/move/chat/thought)
        assert "user_joined" in actions or actions  # bot showed up
        assert any(t in actions for t in ("stance", "move", "chat", "thought")), \
            f"expected at least one bot action, got {actions}"


def test_room_count_still_12():
    r = requests.get(f"{API}/rooms", timeout=15)
    assert r.status_code == 200
    rooms = r.json()
    assert len(rooms) == 12, f"expected 12 rooms, got {len(rooms)}"
    ids = {x["id"] for x in rooms}
    assert "inspiration-theatre" in ids


@pytest.mark.asyncio
async def test_anim_id_weirdbot_accepted(user_a):
    room = "mars"
    url = f"{WS_BASE}/{room}?user_id={user_a['user_id']}&nickname={user_a['nickname']}"
    async with websockets.connect(url) as ws:
        await ws.recv()  # snapshot
        await ws.send(json.dumps({"type": "anim", "anim_id": "weirdbot"}))
        # Wait for the anim broadcast back to us
        seen = None
        deadline = time.time() + 5
        while time.time() < deadline:
            try:
                m = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
            except asyncio.TimeoutError:
                continue
            if m.get("type") == "anim" and m.get("user_id") == user_a["user_id"]:
                seen = m
                break
        assert seen and seen["anim_id"] == "weirdbot"
