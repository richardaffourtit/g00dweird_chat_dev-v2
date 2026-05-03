"""
iter12 backend tests:
  - stance updates blocked while attack_until / hurt_until / dead_until is in the future
  - non-melee creatures (alien/skeleton/slime/tvhead) still receive `attack` stance directly
  - melee creatures (fairy/ape/cat/ghost/robot/frog) — backend only knows the conn object,
    the FRAMES/alias mapping is purely client-side. So backend always broadcasts "attack",
    and the client renders `action` via STATE_ALIASES.
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

ROOM = "regular-cafe"


@pytest.fixture
def attacker():
    nick = f"i12a_{int(time.time()) % 1000000}"
    r = requests.post(f"{API}/join", json={"nickname": nick}, timeout=30)
    return r.json()


@pytest.fixture
def target():
    nick = f"i12t_{int(time.time()) % 1000000}"
    r = requests.post(f"{API}/join", json={"nickname": nick}, timeout=30)
    return r.json()


async def _drain(ws, ms=400):
    deadline = time.time() + ms / 1000.0
    while time.time() < deadline:
        try:
            await asyncio.wait_for(ws.recv(), timeout=0.1)
        except asyncio.TimeoutError:
            break


@pytest.mark.asyncio
async def test_emote_stance_blocked_during_hurt_window(attacker, target):
    """Per priority spec: HURT cannot be interrupted by emote stance updates."""
    url_a = f"{WS_BASE}/{ROOM}?user_id={attacker['user_id']}&nickname={attacker['nickname']}"
    url_t = f"{WS_BASE}/{ROOM}?user_id={target['user_id']}&nickname={target['nickname']}"
    async with websockets.connect(url_a) as wa, websockets.connect(url_t) as wt:
        await wa.recv(); await wt.recv()
        await _drain(wa); await _drain(wt)
        # Attack the target -> they enter `hurt` stance with hurt_until = now + 0.6
        await wa.send(json.dumps({"type": "attack", "target_id": target["user_id"]}))
        # Wait briefly for the hurt to register on backend
        await asyncio.sleep(0.15)
        # Target tries to send an emote — backend should silently drop it
        await wt.send(json.dumps({"type": "stance", "stance": "emote_a"}))
        # Listen on attacker's WS for any stance update from target = emote_a
        seen_emote = False
        deadline = time.time() + 0.5
        while time.time() < deadline:
            try:
                m = json.loads(await asyncio.wait_for(wa.recv(), timeout=0.2))
            except asyncio.TimeoutError:
                continue
            if m.get("type") == "stance" and m.get("user_id") == target["user_id"] and m.get("stance") == "emote_a":
                seen_emote = True
                break
        assert not seen_emote, "emote_a should be blocked while target is in hurt window"


@pytest.mark.asyncio
async def test_emote_stance_blocked_during_attack_window(attacker, target):
    """Attacker's `attack_until` blocks their own stance changes mid-attack."""
    url_a = f"{WS_BASE}/{ROOM}?user_id={attacker['user_id']}&nickname={attacker['nickname']}"
    url_t = f"{WS_BASE}/{ROOM}?user_id={target['user_id']}&nickname={target['nickname']}"
    async with websockets.connect(url_a) as wa, websockets.connect(url_t) as wt:
        await wa.recv(); await wt.recv()
        await _drain(wa); await _drain(wt)
        await wa.send(json.dumps({"type": "attack", "target_id": target["user_id"]}))
        await asyncio.sleep(0.15)
        # Attacker tries to send an emote — backend should silently drop it
        await wa.send(json.dumps({"type": "stance", "stance": "emote_b"}))
        seen = False
        deadline = time.time() + 0.5
        while time.time() < deadline:
            try:
                m = json.loads(await asyncio.wait_for(wt.recv(), timeout=0.2))
            except asyncio.TimeoutError:
                continue
            if m.get("type") == "stance" and m.get("user_id") == attacker["user_id"] and m.get("stance") == "emote_b":
                seen = True
                break
        assert not seen, "emote_b should be blocked while attacker is in attack window"


@pytest.mark.asyncio
async def test_emote_allowed_after_priority_window(attacker, target):
    """After hurt_until passes, target can emote freely again."""
    url_a = f"{WS_BASE}/{ROOM}?user_id={attacker['user_id']}&nickname={attacker['nickname']}"
    url_t = f"{WS_BASE}/{ROOM}?user_id={target['user_id']}&nickname={target['nickname']}"
    async with websockets.connect(url_a) as wa, websockets.connect(url_t) as wt:
        await wa.recv(); await wt.recv()
        await _drain(wa); await _drain(wt)
        await wa.send(json.dumps({"type": "attack", "target_id": target["user_id"]}))
        # Wait beyond the 0.6s hurt window
        await asyncio.sleep(0.9)
        await _drain(wt)
        await wt.send(json.dumps({"type": "stance", "stance": "emote_c"}))
        seen_emote = False
        deadline = time.time() + 1.5
        while time.time() < deadline:
            try:
                m = json.loads(await asyncio.wait_for(wa.recv(), timeout=0.3))
            except asyncio.TimeoutError:
                continue
            if m.get("type") == "stance" and m.get("user_id") == target["user_id"] and m.get("stance") == "emote_c":
                seen_emote = True
                break
        assert seen_emote, "emote_c should pass through after hurt window expires"
