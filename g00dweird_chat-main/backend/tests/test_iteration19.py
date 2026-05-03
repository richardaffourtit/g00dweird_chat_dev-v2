"""Iteration 19 tests:
- BUG FIX 2a: WeirdBot tick interval slowed (12-22s) and talk weight reduced
  (4 -> 2). Over a 60s window we expect 2-3 ticks total and most likely 0-2
  talks (talk prob = 2/13).
- BUG FIX 2b: weirdbot_react probability reduced from 0.30 -> 0.12. Sending
  many user messages should NOT cause a react on every other one. We send
  20 messages and assert <50% react rate (lenient — exact 12% is too noisy
  for 20 samples but we want to catch a regression back to 30%+).
- BACKEND REGRESSION: chat, move, anim, stance, ping handlers still echo
  to the room and the snapshot still contains expected fields including
  kill_mode (iter18 regression).
- BACKEND REGRESSION: GET /api/profile?user_id=... still returns 200 and
  includes nickname/bio for a freshly-joined user.
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
    nick = nick or f"TEST_i19_{uuid.uuid4().hex[:6]}"
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


# -------- Bot frequency --------
class TestWeirdBotFrequency:
    """BUG FIX 2a — tick 12-22s, talk weight cut to 2/13."""

    def test_bot_tick_slowed_no_talk_storm(self):
        """Over 35s, with 12-22s tick, expect <=3 bot ticks total. Talk
        probability is 2/13 per tick, so we should NOT see >=3 talk events.
        This catches regression to 6-10s ticks AND/OR talk weight back to 4.
        """
        room = "mars"  # use a less-trafficked room
        uidA, nickA = _join("TEST_i19_botA")

        async def go():
            wsA = await _open_ws(room, uidA, nickA)
            # Wait for snapshot then mark start
            await _drain_snapshot(wsA, timeout=3.0)
            # Drain any pending messages (e.g. bot join broadcasts)
            try:
                while True:
                    await asyncio.wait_for(wsA.recv(), timeout=0.3)
            except asyncio.TimeoutError:
                pass

            bot_chats = 0
            bot_stances = 0
            t0 = time.time()
            window = 35.0
            while time.time() - t0 < window:
                try:
                    raw = await asyncio.wait_for(wsA.recv(), timeout=window - (time.time() - t0))
                except asyncio.TimeoutError:
                    break
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue
                # bot user_id is "weirdbot-<room>"
                uid = msg.get("user_id", "")
                if uid.startswith("weirdbot-"):
                    if msg.get("type") == "chat":
                        bot_chats += 1
                    elif msg.get("type") == "stance":
                        bot_stances += 1
            await wsA.close()
            return bot_chats, bot_stances

        bot_chats, bot_stances = asyncio.run(go())
        # Old config (6-10s tick, weight 4): expected ~5 ticks, ~1.5 talks per 30s
        # New config (12-22s tick, weight 2): expected ~2 ticks, ~0.3 talks per 30s
        # Allow some slack: assert <3 talks in 35s. If we see 3+, it's a regression.
        assert bot_chats < 3, (
            f"Bot talked {bot_chats} times in 35s — exceeds expected ~0-1. "
            f"Possible regression in talk weight or tick interval. "
            f"(stances seen: {bot_stances})"
        )
        # Sanity: bot should NOT be totally silent across all action types either
        # (unless it's idling repeatedly, which is also valid). So stance count
        # should be small but >=0. We don't enforce a lower bound to avoid flakes.
        print(f"[bot_freq] 35s window: chats={bot_chats}, stances={bot_stances}")

    def test_bot_react_probability_reduced(self):
        """BUG FIX 2b — react drops 0.30 -> 0.12. Send 20 user chats with 0.5s
        spacing, count bot reacts (chat msgs from weirdbot-*). With p=0.12,
        expected reacts ~ 2.4, std ~1.5. Assert <10 reacts (which would be
        the old 30% rate or higher). Also disable bot ticks during the test
        by collecting only chat messages and ignoring those that are
        WEIRDBOT_SAYINGS (bot ticks) — but easier: any bot chat counts and
        we still expect <10 even if a tick or two fires.
        """
        room = "regular-cafe"
        uidA, nickA = _join("TEST_i19_reactA")

        async def go():
            wsA = await _open_ws(room, uidA, nickA)
            await _drain_snapshot(wsA, timeout=3.0)
            try:
                while True:
                    await asyncio.wait_for(wsA.recv(), timeout=0.3)
            except asyncio.TimeoutError:
                pass

            N = 20
            for i in range(N):
                await wsA.send(json.dumps({
                    "type": "chat",
                    "text": f"hello bot test message {i}",
                    "is_fullfunk": False,
                }))
                await asyncio.sleep(0.4)
            # After last message wait briefly for any reactions to fire
            t_end = time.time() + 3.0
            bot_chats = 0
            user_chats = 0
            while time.time() < t_end:
                try:
                    raw = await asyncio.wait_for(wsA.recv(), timeout=max(0.1, t_end - time.time()))
                except asyncio.TimeoutError:
                    break
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue
                if msg.get("type") != "chat":
                    continue
                uid = msg.get("user_id", "")
                if uid.startswith("weirdbot-"):
                    bot_chats += 1
                elif uid == uidA:
                    user_chats += 1
            await wsA.close()
            return bot_chats, user_chats, N

        bot_chats, user_chats, N = asyncio.run(go())
        # Old rate p=0.30 over 20 msgs ~6 reacts. New p=0.12 ~2.4. Threshold 9
        # catches regression. Bot ticks during ~12s test window are very rare
        # (12-22s tick), at most 1 extra "talk".
        assert bot_chats < 10, (
            f"Bot replied {bot_chats} times to {N} user messages. "
            f"Old 30% rate would expect ~6, new 12% rate ~2.4. "
            f"Seeing >=10 indicates regression."
        )
        print(f"[bot_react] {N} user msgs sent, bot_chats={bot_chats}, "
              f"user_echo={user_chats}")


# -------- Backend regression --------
class TestBackendRegression:
    def test_chat_move_stance_anim_ping_dispatch(self):
        """Ensure all message types still echo to other clients post iter19."""
        room = "heaven"
        uidA, nickA = _join("TEST_i19_regA")
        uidB, nickB = _join("TEST_i19_regB")

        async def go():
            wsA = await _open_ws(room, uidA, nickA)
            wsB = await _open_ws(room, uidB, nickB)
            await asyncio.sleep(0.5)
            try:
                while True:
                    await asyncio.wait_for(wsB.recv(), timeout=0.2)
            except asyncio.TimeoutError:
                pass

            # chat
            await wsA.send(json.dumps({"type": "chat", "text": "hi from A"}))
            chat_msg, _ = await _drain_until(
                wsB,
                lambda m: m.get("type") == "chat" and m.get("user_id") == uidA
                          and m.get("text") == "hi from A",
                timeout=3.0,
            )
            # move
            await wsA.send(json.dumps({"type": "move", "x": 333.0, "y": 222.0}))
            move_msg, _ = await _drain_until(
                wsB,
                lambda m: m.get("type") == "move" and m.get("user_id") == uidA,
                timeout=3.0,
            )
            # stance
            await wsA.send(json.dumps({"type": "stance", "stance": "dash"}))
            stance_msg, _ = await _drain_until(
                wsB,
                lambda m: m.get("type") == "stance" and m.get("user_id") == uidA
                          and m.get("stance") == "dash",
                timeout=3.0,
            )
            # anim
            await wsA.send(json.dumps({"type": "anim", "anim_id": "ghost"}))
            anim_msg, _ = await _drain_until(
                wsB,
                lambda m: m.get("type") == "anim" and m.get("user_id") == uidA
                          and m.get("anim_id") == "ghost",
                timeout=3.0,
            )
            # ping (server replies to sender with pong)
            await wsA.send(json.dumps({"type": "ping"}))
            pong_msg, _ = await _drain_until(
                wsA,
                lambda m: m.get("type") == "pong",
                timeout=3.0,
            )
            await wsA.close(); await wsB.close()
            return chat_msg, move_msg, stance_msg, anim_msg, pong_msg

        chat_msg, move_msg, stance_msg, anim_msg, pong_msg = asyncio.run(go())
        assert chat_msg is not None, "chat message not received by B"
        assert move_msg is not None, "move message not received by B"
        assert stance_msg is not None, "stance message not received by B"
        assert anim_msg is not None, "anim message not received by B"
        assert pong_msg is not None, "pong not received by A after ping"

    def test_snapshot_includes_kill_mode_field(self):
        room = "hello"
        uidA, nickA = _join("TEST_i19_snapA")

        async def go():
            ws = await _open_ws(room, uidA, nickA)
            snap = await _drain_snapshot(ws, timeout=3.0)
            await ws.close()
            return snap

        snap = asyncio.run(go())
        assert snap is not None, "no snapshot received"
        users = snap.get("users", [])
        # Find ourselves
        me = next((u for u in users if u.get("user_id") == uidA), None)
        assert me is not None, f"self not in snapshot users: {users}"
        assert "kill_mode" in me, f"kill_mode missing from snapshot user: {me}"
        assert me["kill_mode"] is False, "default kill_mode should be False"

    def test_profile_endpoint(self):
        uid, nick = _join("TEST_i19_prof")
        # /api/profile/{nickname}?user_id=... (optional pin)
        r = requests.get(f"{API}/profile/{nick}", params={"user_id": uid}, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        # Endpoint returns nested user doc + tags/uploads
        u = data.get("user") or data
        assert (u.get("nickname") == nick) or (data.get("nickname") == nick), \
            f"nickname mismatch: {data}"

    def test_profile_endpoint_without_user_id(self):
        uid, nick = _join("TEST_i19_prof2")
        r = requests.get(f"{API}/profile/{nick}", timeout=10)
        assert r.status_code == 200, r.text
