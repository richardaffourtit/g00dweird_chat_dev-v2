"""Iteration 17 tests:
- WS handlers via ws.handlers.dispatch — chat/thought/typing/move/stance/avatar/sprite/anim
- jukebox & youtube WS messages
- tag_spray (with cap), tag_clear
- PvP attack hurt/die/respawn cycle
- ping returns pong
- GET /api/profile/{nickname}?user_id=<id> disambiguation
- Regression: existing REST endpoints
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
    nick = nick or f"TEST_i17_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/join", json={"nickname": nick}, timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    return d["user_id"], d["nickname"]


async def _open_ws(room_id, uid, nick, sprite_id="frog"):
    qs = f"user_id={uid}&nickname={nick}&sprite_id={sprite_id}"
    return await websockets.connect(f"{WS_BASE}/{room_id}?{qs}", open_timeout=10)


async def _drain_until(ws, predicate, timeout=4.0):
    """Read messages until predicate(msg) returns True or timeout."""
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


# ---------- Existing endpoints regression ----------

class TestRESTRegression:
    def test_join_ok(self):
        r = requests.post(f"{API}/join", json={"nickname": "TEST_i17_join"}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["nickname"] == "TEST_i17_join"
        assert isinstance(d["user_id"], str) and len(d["user_id"]) > 0

    def test_join_short_nick_400(self):
        r = requests.post(f"{API}/join", json={"nickname": "x"}, timeout=10)
        assert r.status_code == 400

    def test_get_rooms(self):
        r = requests.get(f"{API}/rooms", timeout=10)
        assert r.status_code == 200
        rooms = r.json()
        ids = {rm["id"] for rm in rooms}
        for must in ("hello", "jello", "heaven", "mars", "regular-cafe"):
            assert must in ids, f"missing room id {must}"

    def test_bio_round_trip(self):
        uid, nick = _join()
        r = requests.put(f"{API}/users/{uid}/bio", json={"bio": "TEST_i17 bio"}, timeout=10)
        assert r.status_code == 200
        rg = requests.get(f"{API}/users/{uid}/bio", timeout=10)
        assert rg.status_code == 200
        assert rg.json()["bio"] == "TEST_i17 bio"

    def test_upload_avatar_then_get_file(self):
        uid, nick = _join()
        png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
               b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf"
               b"\xc0\xc0\xc0\xc0\xc0\x00\x00\x00\x06\x00\x03\x06\x05\xa7]\x00\x00\x00"
               b"\x00IEND\xaeB`\x82")
        files = {"file": ("a.png", png, "image/png")}
        data = {"user_id": uid, "nickname": nick, "kind": "avatar"}
        r = requests.post(f"{API}/upload", files=files, data=data, timeout=20)
        assert r.status_code == 200, r.text
        rec = r.json()
        # GET /api/files/{path}
        rg = requests.get(f"{API}/files/{rec['storage_path']}", timeout=20)
        assert rg.status_code == 200
        assert rg.headers.get("Content-Type", "").startswith("image/")


# ---------- Profile ?user_id= disambiguation ----------

class TestProfileDisambiguation:
    def test_disambiguation_two_users_same_handle(self):
        # Create 2 users with same nickname (collisions are explicitly allowed)
        nick = f"TEST_i17_dup_{uuid.uuid4().hex[:6]}"
        r1 = requests.post(f"{API}/join", json={"nickname": nick}, timeout=10)
        time.sleep(0.05)
        r2 = requests.post(f"{API}/join", json={"nickname": nick}, timeout=10)
        uid1 = r1.json()["user_id"]
        uid2 = r2.json()["user_id"]
        assert uid1 != uid2

        # Without ?user_id, returns most recent (uid2)
        r = requests.get(f"{API}/profile/{nick}", timeout=10)
        assert r.status_code == 200
        assert r.json()["user_id"] == uid2

        # With ?user_id=uid1, returns uid1
        r = requests.get(f"{API}/profile/{nick}", params={"user_id": uid1}, timeout=10)
        assert r.status_code == 200
        assert r.json()["user_id"] == uid1

        # With ?user_id=uid2, returns uid2
        r = requests.get(f"{API}/profile/{nick}", params={"user_id": uid2}, timeout=10)
        assert r.status_code == 200
        assert r.json()["user_id"] == uid2

        # With wrong (random) user_id, returns 404
        r = requests.get(f"{API}/profile/{nick}",
                         params={"user_id": "00000000-0000-0000-0000-000000000000"},
                         timeout=10)
        assert r.status_code == 404


# ---------- WS dispatch handlers ----------

class TestWSChatAndThought:
    def test_chat_broadcasts_to_other(self):
        """A sends chat -> B receives chat msg."""
        room = "hello"
        uidA, nickA = _join("TEST_i17_chatA")
        uidB, nickB = _join("TEST_i17_chatB")

        async def go():
            wsA = await _open_ws(room, uidA, nickA)
            wsB = await _open_ws(room, uidB, nickB)
            # consume snapshots
            await asyncio.sleep(0.5)
            try:
                while True:
                    await asyncio.wait_for(wsB.recv(), timeout=0.2)
            except asyncio.TimeoutError:
                pass
            await wsA.send(json.dumps({"type": "chat", "text": "hello world i17"}))
            msg, _ = await _drain_until(
                wsB,
                lambda m: m.get("type") == "chat" and m.get("text") == "hello world i17"
                          and m.get("user_id") == uidA,
                timeout=4.0,
            )
            await wsA.close(); await wsB.close()
            return msg
        msg = asyncio.run(go())
        assert msg is not None, "B did not receive chat"

    def test_think_prefix_emits_thought(self):
        room = "jello"
        uidA, nickA = _join("TEST_i17_thinkA")
        uidB, nickB = _join("TEST_i17_thinkB")

        async def go():
            wsA = await _open_ws(room, uidA, nickA)
            wsB = await _open_ws(room, uidB, nickB)
            await asyncio.sleep(0.4)
            await wsA.send(json.dumps({"type": "chat", "text": "*think hello brain"}))
            msg, _ = await _drain_until(
                wsB,
                lambda m: m.get("type") == "thought" and m.get("user_id") == uidA
                          and m.get("thought") == "hello brain",
                timeout=4.0,
            )
            await wsA.close(); await wsB.close()
            return msg
        msg = asyncio.run(go())
        assert msg is not None, "thought via *think prefix not received"

    def test_explicit_thought_message(self):
        room = "heaven"
        uidA, nickA = _join("TEST_i17_thA")
        uidB, nickB = _join("TEST_i17_thB")

        async def go():
            wsA = await _open_ws(room, uidA, nickA)
            wsB = await _open_ws(room, uidB, nickB)
            await asyncio.sleep(0.4)
            await wsA.send(json.dumps({"type": "thought", "text": "explicit thought 17"}))
            msg, _ = await _drain_until(
                wsB,
                lambda m: m.get("type") == "thought" and m.get("user_id") == uidA
                          and m.get("thought") == "explicit thought 17",
                timeout=4.0,
            )
            await wsA.close(); await wsB.close()
            return msg
        assert asyncio.run(go()) is not None

    def test_typing_excludes_sender(self):
        room = "mars"
        uidA, nickA = _join("TEST_i17_typeA")
        uidB, nickB = _join("TEST_i17_typeB")

        async def go():
            wsA = await _open_ws(room, uidA, nickA)
            wsB = await _open_ws(room, uidB, nickB)
            await asyncio.sleep(0.4)
            await wsA.send(json.dumps({"type": "typing", "typing": True}))
            msg, _ = await _drain_until(
                wsB,
                lambda m: m.get("type") == "typing" and m.get("user_id") == uidA
                          and m.get("typing") is True,
                timeout=3.0,
            )
            await wsA.close(); await wsB.close()
            return msg
        assert asyncio.run(go()) is not None


class TestWSStateMutators:
    def test_move_clamps_and_broadcasts(self):
        room = "hello"
        uidA, nickA = _join("TEST_i17_mvA")
        uidB, nickB = _join("TEST_i17_mvB")

        async def go():
            wsA = await _open_ws(room, uidA, nickA)
            wsB = await _open_ws(room, uidB, nickB)
            await asyncio.sleep(0.4)
            await wsA.send(json.dumps({"type": "move", "x": 5000, "y": -50}))
            msg, _ = await _drain_until(
                wsB,
                lambda m: m.get("type") == "move" and m.get("user_id") == uidA,
                timeout=3.0,
            )
            await wsA.close(); await wsB.close()
            return msg
        msg = asyncio.run(go())
        assert msg is not None
        assert msg["x"] == 1000  # clamped to max
        assert msg["y"] == 0     # clamped to min

    def test_sprite_anim_avatar_persist_to_db(self):
        room = "hello"
        uid, nick = _join("TEST_i17_sp")

        async def go():
            ws = await _open_ws(room, uid, nick, sprite_id="cat")
            await asyncio.sleep(0.4)
            await ws.send(json.dumps({"type": "sprite", "sprite_id": "frog"}))
            await asyncio.sleep(0.2)
            await ws.send(json.dumps({"type": "anim", "anim_id": "ghost"}))
            await asyncio.sleep(0.2)
            await ws.send(json.dumps({"type": "avatar",
                                      "avatar_url": f"{BASE}/api/files/g00dweird/avatar/x/y.png"}))
            await asyncio.sleep(0.4)
            await ws.close()
        asyncio.run(go())
        time.sleep(0.4)
        r = requests.get(f"{API}/profile/{nick}", params={"user_id": uid}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["sprite_id"] == "frog"
        assert d["anim_id"] == "ghost"
        assert d["avatar_path"] == "g00dweird/avatar/x/y.png"

    def test_anim_invalid_id_rejected(self):
        room = "hello"
        uidA, nickA = _join("TEST_i17_animA")
        uidB, nickB = _join("TEST_i17_animB")

        async def go():
            wsA = await _open_ws(room, uidA, nickA)
            wsB = await _open_ws(room, uidB, nickB)
            await asyncio.sleep(0.4)
            await wsA.send(json.dumps({"type": "anim", "anim_id": "BOGUS_SPRITE_xyz"}))
            msg, _ = await _drain_until(
                wsB,
                lambda m: m.get("type") == "anim" and m.get("user_id") == uidA,
                timeout=2.0,
            )
            await wsA.close(); await wsB.close()
            return msg
        assert asyncio.run(go()) is None  # rejected silently


class TestWSJukeboxAndYoutube:
    def test_jukebox_play_audio_then_stop(self):
        room = "jello"
        uid, nick = _join("TEST_i17_jukA")

        async def go():
            ws = await _open_ws(room, uid, nick)
            await asyncio.sleep(0.3)
            await ws.send(json.dumps({"type": "jukebox_play", "kind": "audio",
                                      "url": "http://x/a.mp3", "title": "tA"}))
            play, _ = await _drain_until(
                ws, lambda m: m.get("type") == "jukebox_play" and m.get("kind") == "audio",
                timeout=3.0)
            await ws.send(json.dumps({"type": "jukebox_stop", "kind": "audio"}))
            stop, _ = await _drain_until(
                ws, lambda m: m.get("type") == "jukebox_stop" and m.get("kind") == "audio",
                timeout=3.0)
            await ws.close()
            return play, stop
        play, stop = asyncio.run(go())
        assert play and play["track"]["title"] == "tA"
        assert stop is not None

    def test_youtube_play_enqueue_next(self):
        room = "inspiration-theatre"
        uid, nick = _join("TEST_i17_yt")

        async def go():
            ws = await _open_ws(room, uid, nick)
            await asyncio.sleep(0.3)
            await ws.send(json.dumps({"type": "youtube_play", "video_id": "vid1", "title": "v1"}))
            p1, _ = await _drain_until(
                ws, lambda m: m.get("type") == "youtube_play"
                              and m.get("track", {}).get("video_id") == "vid1",
                timeout=3.0)
            await ws.send(json.dumps({"type": "youtube_enqueue", "video_id": "vid2", "title": "v2"}))
            await asyncio.sleep(0.2)
            await ws.send(json.dumps({"type": "youtube_next"}))
            p2, _ = await _drain_until(
                ws, lambda m: m.get("type") == "youtube_play"
                              and m.get("track", {}).get("video_id") == "vid2",
                timeout=3.0)
            await ws.send(json.dumps({"type": "youtube_stop"}))
            stop, _ = await _drain_until(
                ws, lambda m: m.get("type") == "youtube_stop", timeout=3.0)
            await ws.close()
            return p1, p2, stop
        p1, p2, stop = asyncio.run(go())
        assert p1 and p2 and stop is not None


class TestWSTagsAndPvP:
    def test_tag_spray_and_clear(self):
        room = "mars"
        uid, nick = _join("TEST_i17_tg")

        async def go():
            ws = await _open_ws(room, uid, nick)
            await asyncio.sleep(0.3)
            await ws.send(json.dumps({"type": "tag_spray", "tag": "TEST_i17_tag",
                                      "x": 200, "y": 200, "rot": 0, "scale": 1.0}))
            spray, _ = await _drain_until(
                ws, lambda m: m.get("type") == "tag_spray"
                              and m.get("tag", {}).get("tag") == "TEST_i17_tag",
                timeout=3.0)
            await ws.send(json.dumps({"type": "tag_clear"}))
            clear, _ = await _drain_until(
                ws, lambda m: m.get("type") == "tag_clear", timeout=3.0)
            await ws.close()
            return spray, clear
        spray, clear = asyncio.run(go())
        assert spray and clear

    def test_attack_hurt_die_respawn_cycle(self):
        room = "regular-cafe"
        uidA, nickA = _join("TEST_i17_atkA")
        uidB, nickB = _join("TEST_i17_atkB")

        async def go():
            wsA = await _open_ws(room, uidA, nickA)
            wsB = await _open_ws(room, uidB, nickB)
            await asyncio.sleep(0.5)
            received = []
            # First hit -> hurt
            await wsA.send(json.dumps({"type": "attack", "target_id": uidB}))
            await asyncio.sleep(0.8)  # respect 0.6s cooldown
            await wsA.send(json.dumps({"type": "attack", "target_id": uidB}))
            await asyncio.sleep(0.8)
            await wsA.send(json.dumps({"type": "attack", "target_id": uidB}))
            # Drain B for ~6s to capture die + respawn
            deadline = time.time() + 6.0
            while time.time() < deadline:
                try:
                    raw = await asyncio.wait_for(wsB.recv(), timeout=0.5)
                except asyncio.TimeoutError:
                    continue
                try:
                    received.append(json.loads(raw))
                except Exception:
                    pass
            await wsA.close(); await wsB.close()
            return received
        events = asyncio.run(go())
        types_ = [e.get("type") for e in events]
        # Verify hurt stance for B
        assert any(e.get("type") == "stance" and e.get("user_id") == uidB
                   and e.get("stance") == "hurt" for e in events), f"no hurt for B in {types_}"
        # die for B
        assert any(e.get("type") == "die" and e.get("user_id") == uidB
                   for e in events), f"no die in {types_}"
        # respawn for B
        assert any(e.get("type") == "respawn" and e.get("user_id") == uidB
                   for e in events), f"no respawn in {types_}"


class TestWSPing:
    def test_ping_returns_pong(self):
        room = "hello"
        uid, nick = _join("TEST_i17_png")

        async def go():
            ws = await _open_ws(room, uid, nick)
            await asyncio.sleep(0.3)
            await ws.send(json.dumps({"type": "ping"}))
            pong, _ = await _drain_until(
                ws, lambda m: m.get("type") == "pong", timeout=3.0)
            await ws.close()
            return pong
        assert asyncio.run(go()) is not None

    def test_unknown_message_type_is_silently_dropped(self):
        """Dispatch returns silently for unknown types; connection stays alive."""
        room = "hello"
        uid, nick = _join("TEST_i17_unk")

        async def go():
            ws = await _open_ws(room, uid, nick)
            await asyncio.sleep(0.3)
            await ws.send(json.dumps({"type": "no_such_type_xyz", "blah": 1}))
            await asyncio.sleep(0.3)
            # Send a ping right after — must still work
            await ws.send(json.dumps({"type": "ping"}))
            pong, _ = await _drain_until(
                ws, lambda m: m.get("type") == "pong", timeout=3.0)
            await ws.close()
            return pong
        assert asyncio.run(go()) is not None
