"""
iter9 backend tests:
  - attack flow: attacker -> stance=attack, target -> stance=hurt
  - 3 attacks -> target dies, gets 'die' broadcast then 'respawn' after ~4s
  - moves/stances ignored while target is dead
  - attack on bot (no ws) is rejected
  - attack on self is rejected
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
    r = requests.post(f"{API}/join", json={"nickname": f"TEST_atk_{int(time.time())}"}, timeout=30)
    return r.json()


@pytest.fixture
def target():
    r = requests.post(f"{API}/join", json={"nickname": f"TEST_tgt_{int(time.time())}"}, timeout=30)
    return r.json()


async def _drain(ws, ms=400):
    deadline = time.time() + ms / 1000.0
    while time.time() < deadline:
        try:
            await asyncio.wait_for(ws.recv(), timeout=0.1)
        except asyncio.TimeoutError:
            break


async def _collect(ws, types, total_timeout=6.0):
    out = {t: None for t in types}
    deadline = time.time() + total_timeout
    while time.time() < deadline and any(v is None for v in out.values()):
        try:
            m = json.loads(await asyncio.wait_for(ws.recv(), timeout=0.5))
        except asyncio.TimeoutError:
            continue
        if m.get("type") in out and out[m["type"]] is None:
            out[m["type"]] = m
    return out


@pytest.mark.asyncio
async def test_attack_sets_attacker_attack_and_target_hurt(attacker, target):
    url_a = f"{WS_BASE}/{ROOM}?user_id={attacker['user_id']}&nickname={attacker['nickname']}"
    url_t = f"{WS_BASE}/{ROOM}?user_id={target['user_id']}&nickname={target['nickname']}"
    async with websockets.connect(url_a) as wa, websockets.connect(url_t) as wt:
        await wa.recv(); await wt.recv()  # snapshots
        await _drain(wa); await _drain(wt)
        await wa.send(json.dumps({"type": "attack", "target_id": target["user_id"]}))
        # attacker should see attack stance (for self) + attack event
        # target should see attacker's attack stance + own hurt stance
        seen = await _collect(wt, ["stance", "attack"], total_timeout=4.0)
        # Must have at least the 'attack' event with proper attacker_id
        assert seen["attack"], "no attack event arrived at target"
        assert seen["attack"]["attacker_id"] == attacker["user_id"]
        assert seen["attack"]["target_id"] == target["user_id"]
        assert seen["attack"]["hits"] == 1


@pytest.mark.asyncio
async def test_three_hits_triggers_die_and_respawn(attacker, target):
    url_a = f"{WS_BASE}/{ROOM}?user_id={attacker['user_id']}&nickname={attacker['nickname']}"
    url_t = f"{WS_BASE}/{ROOM}?user_id={target['user_id']}&nickname={target['nickname']}"
    async with websockets.connect(url_a) as wa, websockets.connect(url_t) as wt:
        await wa.recv(); await wt.recv()
        await _drain(wa); await _drain(wt)
        # 3 attacks with cooldown
        for _i in range(3):
            await wa.send(json.dumps({"type": "attack", "target_id": target["user_id"]}))
            await asyncio.sleep(0.7)  # respect 600ms cooldown
        # collect die + respawn on target
        die_seen = False
        respawn_seen = False
        deadline = time.time() + 7.0
        while time.time() < deadline and not (die_seen and respawn_seen):
            try:
                m = json.loads(await asyncio.wait_for(wt.recv(), timeout=0.5))
            except asyncio.TimeoutError:
                continue
            if m.get("type") == "die" and m.get("user_id") == target["user_id"]:
                die_seen = True
            if m.get("type") == "respawn" and m.get("user_id") == target["user_id"]:
                respawn_seen = True
        assert die_seen, "target never received die event"
        assert respawn_seen, "target never received respawn event"


@pytest.mark.asyncio
async def test_attack_self_ignored(attacker):
    url = f"{WS_BASE}/{ROOM}?user_id={attacker['user_id']}&nickname={attacker['nickname']}"
    async with websockets.connect(url) as ws:
        await ws.recv()
        await _drain(ws)
        await ws.send(json.dumps({"type": "attack", "target_id": attacker["user_id"]}))
        # No 'attack' event should arrive
        try:
            m = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
            assert m.get("type") != "attack", f"self-attack should be silenced, got {m}"
        except asyncio.TimeoutError:
            pass  # expected


@pytest.mark.asyncio
async def test_attack_on_bot_now_allowed(attacker):
    """iter13: bots ARE attackable. The attack event should reach the attacker's own WS."""
    url = f"{WS_BASE}/{ROOM}?user_id={attacker['user_id']}&nickname={attacker['nickname']}"
    bot_uid = f"weirdbot-{ROOM}"
    async with websockets.connect(url) as ws:
        await ws.recv()  # snapshot
        # Wait for bot to join (loop is 6-10s) — we listen for the user_joined event.
        bot_joined = False
        deadline = time.time() + 16
        while time.time() < deadline and not bot_joined:
            try:
                m = json.loads(await asyncio.wait_for(ws.recv(), timeout=1.0))
            except asyncio.TimeoutError:
                continue
            if m.get("type") == "user_joined" and m.get("user", {}).get("user_id") == bot_uid:
                bot_joined = True
        assert bot_joined, "weirdbot never joined"
        await _drain(ws, 600)
        await ws.send(json.dumps({"type": "attack", "target_id": bot_uid}))
        seen = False
        deadline = time.time() + 3.0
        while time.time() < deadline and not seen:
            try:
                m = json.loads(await asyncio.wait_for(ws.recv(), timeout=0.4))
            except asyncio.TimeoutError:
                continue
            if m.get("type") == "attack" and m.get("target_id") == bot_uid:
                seen = True
        assert seen, "attack on bot should now broadcast"


@pytest.mark.asyncio
async def test_move_blocked_while_dead(attacker, target):
    """After target dies, target's move events shouldn't broadcast."""
    url_a = f"{WS_BASE}/{ROOM}?user_id={attacker['user_id']}&nickname={attacker['nickname']}"
    url_t = f"{WS_BASE}/{ROOM}?user_id={target['user_id']}&nickname={target['nickname']}"
    async with websockets.connect(url_a) as wa, websockets.connect(url_t) as wt:
        await wa.recv(); await wt.recv()
        await _drain(wa); await _drain(wt)
        for _i in range(3):
            await wa.send(json.dumps({"type": "attack", "target_id": target["user_id"]}))
            await asyncio.sleep(0.7)
        # Wait for the die event
        die_seen = False
        deadline = time.time() + 4.0
        while time.time() < deadline and not die_seen:
            try:
                m = json.loads(await asyncio.wait_for(wt.recv(), timeout=0.5))
            except asyncio.TimeoutError:
                continue
            if m.get("type") == "die" and m.get("user_id") == target["user_id"]:
                die_seen = True
        assert die_seen
        # Now try to move while dead — attacker should NOT receive a move broadcast for target
        await _drain(wa, 200)
        await wt.send(json.dumps({"type": "move", "x": 999, "y": 599}))
        moved = False
        deadline = time.time() + 1.5
        while time.time() < deadline:
            try:
                m = json.loads(await asyncio.wait_for(wa.recv(), timeout=0.3))
            except asyncio.TimeoutError:
                continue
            if m.get("type") == "move" and m.get("user_id") == target["user_id"]:
                moved = True
                break
        assert not moved, "move during death should be rejected"
