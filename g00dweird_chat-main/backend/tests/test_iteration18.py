"""Iteration 18 tests:
- New WS message type 'kill_mode' — broadcasts and updates conn.kill_mode
- Snapshot users[] now includes kill_mode field
- attack still works regardless of attacker's kill_mode (no server-side gate)
- Quick regression: dispatch still works for ping/chat after kill_mode added
"""
import asyncio
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
    nick = nick or f"TEST_i18_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/join", json={"nickname": nick}, timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    return d["user_id"], d["nickname"]


async def _open_ws(room_id, uid, nick, sprite_id="frog"):
    qs = f"user_id={uid}&nickname={nick}&sprite_id={sprite_id}"
    return await websockets.connect(f"{WS_BASE}/{room_id}?{qs}", open_timeout=10)


async def _drain_until(ws, predicate, timeout=4.0):
    deadline = time.time() + timeout
    found = []
    while time.time() < deadline:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=max(0.1, deadline - time.time()))
        except asyncio.TimeoutError:
            return None, found
        try:
            msg = json.loads(raw)
        except Exception:
            continue
        found.append(msg)
        if predicate(msg):
            return msg, found
    return None, found


async def _drain_snapshot(ws, timeout=2.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=max(0.1, deadline - time.time()))
        except asyncio.TimeoutError:
            return None
        try:
            msg = json.loads(raw)
        except Exception:
            continue
        if msg.get("type") == "snapshot":
            return msg
    return None


class TestKillModeHandler:
    def test_kill_mode_broadcasts_to_others(self):
        room = "hello"
        uidA, nickA = _join("TEST_i18_kmA")
        uidB, nickB = _join("TEST_i18_kmB")

        async def go():
            wsA = await _open_ws(room, uidA, nickA)
            wsB = await _open_ws(room, uidB, nickB)
            await asyncio.sleep(0.5)
            # Drain initial messages on B
            try:
                while True:
                    await asyncio.wait_for(wsB.recv(), timeout=0.2)
            except asyncio.TimeoutError:
                pass

            await wsA.send(json.dumps({"type": "kill_mode", "on": True}))
            on_msg, _ = await _drain_until(
                wsB,
                lambda m: m.get("type") == "kill_mode" and m.get("user_id") == uidA
                          and m.get("on") is True,
                timeout=3.0,
            )
            await wsA.send(json.dumps({"type": "kill_mode", "on": False}))
            off_msg, _ = await _drain_until(
                wsB,
                lambda m: m.get("type") == "kill_mode" and m.get("user_id") == uidA
                          and m.get("on") is False,
                timeout=3.0,
            )
            await wsA.close(); await wsB.close()
            return on_msg, off_msg
        on_msg, off_msg = asyncio.run(go())
        assert on_msg is not None, "did not receive kill_mode=True broadcast"
        assert off_msg is not None, "did not receive kill_mode=False broadcast"

    def test_kill_mode_truthy_coercion(self):
        """payload 'on' is bool-coerced — string 'yes' -> True, 0 -> False."""
        room = "jello"
        uidA, nickA = _join("TEST_i18_kmcA")
        uidB, nickB = _join("TEST_i18_kmcB")

        async def go():
            wsA = await _open_ws(room, uidA, nickA)
            wsB = await _open_ws(room, uidB, nickB)
            await asyncio.sleep(0.4)
            await wsA.send(json.dumps({"type": "kill_mode", "on": "yes"}))
            on_msg, _ = await _drain_until(
                wsB,
                lambda m: m.get("type") == "kill_mode" and m.get("user_id") == uidA,
                timeout=3.0,
            )
            await wsA.close(); await wsB.close()
            return on_msg
        msg = asyncio.run(go())
        assert msg is not None
        assert msg["on"] is True

    def test_snapshot_includes_kill_mode_field(self):
        """When B joins after A has set kill_mode=True, B's snapshot lists A
        with kill_mode=True (plus others as False/missing-default)."""
        room = "heaven"
        uidA, nickA = _join("TEST_i18_snapA")
        uidB, nickB = _join("TEST_i18_snapB")

        async def go():
            wsA = await _open_ws(room, uidA, nickA)
            await asyncio.sleep(0.3)
            await wsA.send(json.dumps({"type": "kill_mode", "on": True}))
            await asyncio.sleep(0.5)  # let the server mutate conn.kill_mode
            wsB = await _open_ws(room, uidB, nickB)
            snap = await _drain_snapshot(wsB, timeout=3.0)
            await wsA.close(); await wsB.close()
            return snap
        snap = asyncio.run(go())
        assert snap is not None, "B never received snapshot"
        assert "users" in snap
        users_by_uid = {u["user_id"]: u for u in snap["users"]}
        assert uidA in users_by_uid, f"A not in snapshot users: {users_by_uid}"
        a_user = users_by_uid[uidA]
        assert "kill_mode" in a_user, f"kill_mode field missing from user: {a_user}"
        assert a_user["kill_mode"] is True, f"A.kill_mode != True (got {a_user['kill_mode']})"

    def test_snapshot_default_kill_mode_false(self):
        room = "mars"
        uidA, nickA = _join("TEST_i18_dfA")
        uidB, nickB = _join("TEST_i18_dfB")

        async def go():
            wsA = await _open_ws(room, uidA, nickA)
            await asyncio.sleep(0.4)
            wsB = await _open_ws(room, uidB, nickB)
            snap = await _drain_snapshot(wsB, timeout=3.0)
            await wsA.close(); await wsB.close()
            return snap
        snap = asyncio.run(go())
        assert snap is not None
        users_by_uid = {u["user_id"]: u for u in snap["users"]}
        assert uidA in users_by_uid
        # default must be False (not omitted)
        assert users_by_uid[uidA].get("kill_mode") is False


class TestAttackUngatedByKillMode:
    def test_attack_works_when_attacker_kill_mode_off(self):
        """server-side attack handler should NOT gate on attacker.kill_mode —
        gating is purely client-side UX. So even with kill_mode never sent,
        attack still hurts the target."""
        room = "regular-cafe"
        uidA, nickA = _join("TEST_i18_atkA")
        uidB, nickB = _join("TEST_i18_atkB")

        async def go():
            wsA = await _open_ws(room, uidA, nickA)
            wsB = await _open_ws(room, uidB, nickB)
            await asyncio.sleep(0.5)
            # explicitly set kill_mode=False on attacker
            await wsA.send(json.dumps({"type": "kill_mode", "on": False}))
            await asyncio.sleep(0.3)
            await wsA.send(json.dumps({"type": "attack", "target_id": uidB}))
            # B should still get an attack/hurt event
            hurt, _ = await _drain_until(
                wsB,
                lambda m: m.get("type") == "stance" and m.get("user_id") == uidB
                          and m.get("stance") == "hurt",
                timeout=3.0,
            )
            await wsA.close(); await wsB.close()
            return hurt
        assert asyncio.run(go()) is not None, "attack was gated by kill_mode=False (should not be)"


class TestRegressionAfterKillMode:
    def test_ping_still_works_after_kill_mode_added(self):
        room = "hello"
        uid, nick = _join("TEST_i18_png")

        async def go():
            ws = await _open_ws(room, uid, nick)
            await asyncio.sleep(0.3)
            await ws.send(json.dumps({"type": "kill_mode", "on": True}))
            await asyncio.sleep(0.2)
            await ws.send(json.dumps({"type": "ping"}))
            pong, _ = await _drain_until(
                ws, lambda m: m.get("type") == "pong", timeout=3.0)
            await ws.close()
            return pong
        assert asyncio.run(go()) is not None

    def test_chat_still_works_after_kill_mode(self):
        room = "hello"
        uidA, nickA = _join("TEST_i18_chA")
        uidB, nickB = _join("TEST_i18_chB")

        async def go():
            wsA = await _open_ws(room, uidA, nickA)
            wsB = await _open_ws(room, uidB, nickB)
            await asyncio.sleep(0.4)
            await wsA.send(json.dumps({"type": "kill_mode", "on": True}))
            await asyncio.sleep(0.2)
            await wsA.send(json.dumps({"type": "chat", "text": "hi after killmode"}))
            msg, _ = await _drain_until(
                wsB,
                lambda m: m.get("type") == "chat" and m.get("text") == "hi after killmode",
                timeout=4.0,
            )
            await wsA.close(); await wsB.close()
            return msg
        assert asyncio.run(go()) is not None
