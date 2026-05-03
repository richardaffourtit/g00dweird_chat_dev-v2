"""
ws.handlers
===========

WebSocket message-type handlers for the g00dweird chatroom.

Each handler is an `async def handle_<msgtype>(ctx, conn, room, msg)` function.
Handlers are registered in `HANDLERS`. The `dispatch` coroutine looks up the
right handler and runs it. The lifecycle (accept / snapshot / disconnect) and
all REST routes still live in `server.py`; this module is purely the per-event
inner loop.

`ctx` is a small dataclass with the shared dependencies — it lets us avoid
importing `server` here (which would create a circular import) and makes each
handler trivially unit-testable in isolation.
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, Optional


@dataclass
class WSContext:
    """Bag of dependencies wired up by `server.py` at import time. Holds
    everything a handler needs that lives outside the (conn, room, msg) trio.

    Fields are typed loosely as `Any` so handlers stay decoupled from the
    concrete RoomState/ClientConn classes (which still live in server.py)."""
    db: Any
    broadcast: Callable[..., Awaitable[None]]
    weirdbot_react: Callable[..., Awaitable[None]]
    advance_jukebox: Callable[..., Awaitable[None]]
    avatar_url_to_path: Callable[[Optional[str]], Optional[str]]
    max_tags_per_room: int
    room_state_cls: Any  # for type checks only
    persist_room_media_state: Callable[[Any], Awaitable[None]]
    record_metric: Callable[[str, dict], None]
    behavior_for_room: Callable[[str], Any]


ALLOWED_ANIM = {
    "fairy", "ape", "ghost", "robot", "frog", "cat",
    "alien", "skeleton", "slime", "tvhead", "plant", "bat", "boo",
    "weirdbot",
    "",
}


# ---------------------------------------------------------------- chat / text

async def handle_chat(ctx: WSContext, conn, room, msg: dict) -> None:
    text = (msg.get("text") or "").strip()
    if not text:
        return
    text = text[:500]
    fullfunk = bool(msg.get("fullfunk"))
    ts = datetime.now(timezone.utc).isoformat()
    # Intercept *think syntax as thought update
    if text.startswith("*think ") or text == "*think":
        thought = text[7:].strip()
        conn.thought = thought or None
        conn.thought_fullfunk = fullfunk if conn.thought else False
        await ctx.broadcast(room, {
            "type": "thought",
            "user_id": conn.user_id,
            "nickname": conn.nickname,
            "thought": conn.thought,
            "fullfunk": conn.thought_fullfunk,
        })
        return
    out = {
        "type": "chat",
        "id": str(uuid.uuid4()),
        "user_id": conn.user_id,
        "nickname": conn.nickname,
        "avatar_url": conn.avatar_url,
        "sprite_id": conn.sprite_id,
        "text": text,
        "fullfunk": fullfunk,
        "ts": ts,
    }
    conn.last_message = {"text": text, "ts": ts, "fullfunk": fullfunk}
    await ctx.broadcast(room, out)
    ctx.record_metric("chat_message", {"room_id": room.room_id})
    await ctx.db.messages.insert_one({**out, "room_id": room.room_id})
    # WeirdBot reacts (~30%) — pass recent context for a contextual reply
    try:
        cursor = ctx.db.messages.find(
            {"room_id": room.room_id}, {"_id": 0, "nickname": 1, "text": 1}
        ).sort("ts", -1).limit(5)
        recent = list(reversed([m async for m in cursor]))
    except Exception:
        recent = [{"nickname": conn.nickname, "text": text}]
    asyncio.create_task(ctx.weirdbot_react(room, text, recent))


async def handle_thought(ctx: WSContext, conn, room, msg: dict) -> None:
    t = (msg.get("text") or "").strip()
    conn.thought = t or None
    conn.thought_fullfunk = bool(msg.get("fullfunk")) if conn.thought else False
    await ctx.broadcast(room, {
        "type": "thought",
        "user_id": conn.user_id,
        "nickname": conn.nickname,
        "thought": conn.thought,
        "fullfunk": conn.thought_fullfunk,
    })


async def handle_typing(ctx: WSContext, conn, room, msg: dict) -> None:
    await ctx.broadcast(room, {
        "type": "typing",
        "user_id": conn.user_id,
        "nickname": conn.nickname,
        "typing": bool(msg.get("typing")),
    }, exclude=conn.user_id)


# ---------------------------------------------------------------- locomotion

async def handle_move(ctx: WSContext, conn, room, msg: dict) -> None:
    if time.time() < conn.dead_until:
        return
    try:
        x = float(msg.get("x", conn.x))
        y = float(msg.get("y", conn.y))
    except Exception:
        return
    next_x = max(0, min(1000, x))
    next_y = max(0, min(600, y))
    msg_facing = msg.get("facing")
    if msg_facing in ("left", "right"):
        conn.facing = msg_facing
    elif abs(next_x - conn.x) > 1:
        conn.facing = "left" if next_x < conn.x else "right"
    conn.x = next_x
    conn.y = next_y
    await ctx.broadcast(room, {
        "type": "move", "user_id": conn.user_id, "x": conn.x, "y": conn.y,
        "facing": conn.facing,
    })


async def handle_stance(ctx: WSContext, conn, room, msg: dict) -> None:
    now_ = time.time()
    if now_ < conn.dead_until or now_ < conn.hurt_until or now_ < conn.attack_until:
        return
    stance = (msg.get("stance") or "idle")[:16]
    conn.anim_stance = stance
    await ctx.broadcast(room, {
        "type": "stance", "user_id": conn.user_id, "stance": stance,
    })


# ---------------------------------------------------------------- avatar/sprite

async def handle_avatar(ctx: WSContext, conn, room, msg: dict) -> None:
    conn.avatar_url = msg.get("avatar_url")
    await ctx.broadcast(room, {
        "type": "avatar", "user_id": conn.user_id, "avatar_url": conn.avatar_url,
    })
    try:
        await ctx.db.users.update_one(
            {"id": conn.user_id},
            {"$set": {"avatar_path": ctx.avatar_url_to_path(conn.avatar_url)}},
        )
    except Exception:
        pass


async def handle_sprite(ctx: WSContext, conn, room, msg: dict) -> None:
    conn.sprite_id = msg.get("sprite_id")
    conn.anim_id = None
    await ctx.broadcast(room, {
        "type": "sprite", "user_id": conn.user_id, "sprite_id": conn.sprite_id,
    })
    await ctx.broadcast(room, {
        "type": "anim", "user_id": conn.user_id, "anim_id": None,
    })
    try:
        await ctx.db.users.update_one(
            {"id": conn.user_id},
            {"$set": {"sprite_id": conn.sprite_id, "anim_id": None}},
        )
    except Exception:
        pass


async def handle_anim(ctx: WSContext, conn, room, msg: dict) -> None:
    aid = msg.get("anim_id")
    if aid is not None and aid not in ALLOWED_ANIM:
        return
    conn.anim_id = aid or None
    await ctx.broadcast(room, {
        "type": "anim", "user_id": conn.user_id, "anim_id": conn.anim_id,
    })
    try:
        await ctx.db.users.update_one(
            {"id": conn.user_id},
            {"$set": {"anim_id": conn.anim_id}},
        )
    except Exception:
        pass


# ---------------------------------------------------------------- jukebox

def _make_track(msg: dict, conn, kind: str) -> dict:
    return {
        "file_id": msg.get("file_id"),
        "url": msg.get("url"),
        "title": msg.get("title") or "untitled",
        "uploader": msg.get("nickname") or conn.nickname,
        "kind": kind,
    }


async def handle_jukebox_play(ctx: WSContext, conn, room, msg: dict) -> None:
    kind = msg.get("kind")
    if kind not in ("audio", "video"):
        return
    track = {**_make_track(msg, conn, kind),
             "started_at": datetime.now(timezone.utc).isoformat()}
    if kind == "audio":
        room.current_audio = track
    else:
        room.current_video = track
    await ctx.broadcast(room, {"type": "jukebox_play", "track": track, "kind": kind})
    await ctx.persist_room_media_state(room)


async def handle_jukebox_stop(ctx: WSContext, conn, room, msg: dict) -> None:
    kind = msg.get("kind")
    if kind == "audio":
        room.current_audio = None
    elif kind == "video":
        room.current_video = None
    await ctx.broadcast(room, {"type": "jukebox_stop", "kind": kind})
    await ctx.persist_room_media_state(room)


async def handle_jukebox_enqueue(ctx: WSContext, conn, room, msg: dict) -> None:
    kind = msg.get("kind")
    if kind not in ("audio", "video"):
        return
    track = _make_track(msg, conn, kind)
    if kind == "audio":
        room.audio_queue.append(track)
        if not room.current_audio:
            await ctx.advance_jukebox(room, "audio")
        else:
            await ctx.broadcast(room, {
                "type": "jukebox_queue", "kind": "audio", "queue": room.audio_queue,
            })
    else:
        room.video_queue.append(track)
        if not room.current_video:
            await ctx.advance_jukebox(room, "video")
        else:
            await ctx.broadcast(room, {
                "type": "jukebox_queue", "kind": "video", "queue": room.video_queue,
            })
    await ctx.persist_room_media_state(room)


async def handle_jukebox_next(ctx: WSContext, conn, room, msg: dict) -> None:
    kind = msg.get("kind")
    if kind in ("audio", "video"):
        await ctx.advance_jukebox(room, kind)


async def handle_jukebox_clear(ctx: WSContext, conn, room, msg: dict) -> None:
    kind = msg.get("kind")
    if kind == "audio":
        room.audio_queue = []
        await ctx.broadcast(room, {"type": "jukebox_queue", "kind": "audio", "queue": []})
    elif kind == "video":
        room.video_queue = []
        await ctx.broadcast(room, {"type": "jukebox_queue", "kind": "video", "queue": []})


# ---------------------------------------------------------------- youtube theatre

async def handle_youtube_play(ctx: WSContext, conn, room, msg: dict) -> None:
    vid = (msg.get("video_id") or "").strip()[:24]
    title = (msg.get("title") or "")[:120]
    if not vid:
        return
    track = {
        "video_id": vid,
        "title": title or vid,
        "started_ts": time.time(),
        "by": conn.nickname,
    }
    room.current_youtube = track
    await ctx.broadcast(room, {"type": "youtube_play", "track": track})
    await ctx.persist_room_media_state(room)


async def handle_youtube_enqueue(ctx: WSContext, conn, room, msg: dict) -> None:
    vid = (msg.get("video_id") or "").strip()[:24]
    title = (msg.get("title") or "")[:120]
    if not vid:
        return
    item = {"video_id": vid, "title": title or vid, "by": conn.nickname}
    if not room.current_youtube:
        room.current_youtube = {**item, "started_ts": time.time()}
        await ctx.broadcast(room, {"type": "youtube_play", "track": room.current_youtube})
    else:
        if len(room.youtube_queue) < 30:
            room.youtube_queue.append(item)
        await ctx.broadcast(room, {"type": "youtube_queue", "queue": room.youtube_queue})
    await ctx.persist_room_media_state(room)


async def handle_youtube_next(ctx: WSContext, conn, room, msg: dict) -> None:
    if room.youtube_queue:
        nxt = room.youtube_queue.pop(0)
        room.current_youtube = {**nxt, "started_ts": time.time()}
        await ctx.broadcast(room, {"type": "youtube_play", "track": room.current_youtube})
        await ctx.broadcast(room, {"type": "youtube_queue", "queue": room.youtube_queue})
    else:
        room.current_youtube = None
        await ctx.broadcast(room, {"type": "youtube_stop"})
    await ctx.persist_room_media_state(room)


async def handle_youtube_stop(ctx: WSContext, conn, room, msg: dict) -> None:
    room.current_youtube = None
    await ctx.broadcast(room, {"type": "youtube_stop"})
    await ctx.persist_room_media_state(room)


async def handle_youtube_clear(ctx: WSContext, conn, room, msg: dict) -> None:
    room.youtube_queue = []
    await ctx.broadcast(room, {"type": "youtube_queue", "queue": []})


# ---------------------------------------------------------------- graffiti

async def handle_tag_spray(ctx: WSContext, conn, room, msg: dict) -> None:
    tag = (msg.get("tag") or "").strip()[:32]
    custom = bool(msg.get("custom"))
    if not tag:
        return
    try:
        tx = float(msg.get("x", 500))
        ty = float(msg.get("y", 250))
        rot = float(msg.get("rot", 0))
        scale = float(msg.get("scale", 1.0))
    except Exception:
        return
    rec = {
        "id": str(uuid.uuid4()),
        "room_id": room.room_id,
        "user_id": conn.user_id,
        "nickname": conn.nickname,
        "tag": tag,
        "custom": custom,
        "x": max(10, min(990, tx)),
        "y": max(10, min(490, ty)),
        "rot": max(-45, min(45, rot)),
        "scale": max(0.3, min(3.0, scale)),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await ctx.db.tags.insert_one(rec)
    count = await ctx.db.tags.count_documents({"room_id": room.room_id})
    if count > ctx.max_tags_per_room:
        extras = count - ctx.max_tags_per_room
        oldest = await ctx.db.tags.find(
            {"room_id": room.room_id}, {"_id": 1}
        ).sort("created_at", 1).limit(extras).to_list(extras)
        if oldest:
            await ctx.db.tags.delete_many({"_id": {"$in": [o["_id"] for o in oldest]}})
    await ctx.broadcast(room, {
        "type": "tag_spray",
        "tag": {k: v for k, v in rec.items() if k != "_id"},
    })


async def handle_tag_clear(ctx: WSContext, conn, room, msg: dict) -> None:
    await ctx.db.tags.delete_many({"room_id": room.room_id})
    await ctx.broadcast(room, {"type": "tag_clear"})


# ---------------------------------------------------------------- PvP attack

async def handle_attack(ctx: WSContext, conn, room, msg: dict) -> None:
    target_id = msg.get("target_id")
    if not target_id or target_id == conn.user_id:
        return
    target = room.connections.get(target_id)
    if not target:
        return
    now = time.time()
    if now - getattr(conn, "_last_attack_ts", 0) < 0.6:
        return
    conn._last_attack_ts = now
    if now - target.last_hit_ts > 30:
        target.hits_taken = 0
    if now < target.dead_until:
        return
    target.hits_taken += 1
    target.last_hit_ts = now
    conn.anim_stance = "attack"
    conn.attack_until = now + 0.7
    await ctx.broadcast(room, {
        "type": "stance", "user_id": conn.user_id, "stance": "attack",
    })
    await ctx.broadcast(room, {
        "type": "attack",
        "attacker_id": conn.user_id,
        "attacker_nickname": conn.nickname,
        "target_id": target.user_id,
        "target_nickname": target.nickname,
        "hits": target.hits_taken,
    })
    if target.hits_taken >= 3:
        target.anim_stance = "die"
        target.dead_until = now + 4.0
        target.hits_taken = 0
        await ctx.broadcast(room, {
            "type": "stance", "user_id": target.user_id, "stance": "die",
        })
        await ctx.broadcast(room, {
            "type": "die",
            "user_id": target.user_id,
            "nickname": target.nickname,
        })
        asyncio.create_task(_respawn(ctx, target.user_id, room))
    else:
        target.anim_stance = "hurt"
        target.hurt_until = now + 0.6
        await ctx.broadcast(room, {
            "type": "stance", "user_id": target.user_id, "stance": "hurt",
        })


async def _respawn(ctx: WSContext, target_uid: str, room) -> None:
    await asyncio.sleep(4.0)
    c = room.connections.get(target_uid)
    if c is None:
        return
    c.anim_stance = "idle"
    old_x = c.x
    c.x = 80 + (hash(target_uid + str(time.time())) % 800)
    c.y = 200 + (hash(target_uid[::-1]) % 120)
    if abs(c.x - old_x) > 1:
        c.facing = "left" if c.x < old_x else "right"
    c.dead_until = 0.0
    await ctx.broadcast(room, {
        "type": "respawn",
        "user_id": c.user_id,
        "x": c.x, "y": c.y,
        "facing": c.facing,
    })
    await ctx.broadcast(room, {
        "type": "stance", "user_id": c.user_id, "stance": "idle",
    })


# ---------------------------------------------------------------- ping

async def handle_ping(ctx: WSContext, conn, room, msg: dict) -> None:
    try:
        await conn.ws.send_text(json.dumps({"type": "pong"}))
    except Exception:
        pass


# ---------------------------------------------------------------- kill mode

async def handle_kill_mode(ctx: WSContext, conn, room, msg: dict) -> None:
    """Toggle the user's hostile/PvP intent. When `on=True`, this user's
    iso-world clicks attack other avatars; when False they open the target's
    profile. Broadcast so peers can render the ⚔ indicator next to the name.
    """
    on = bool(msg.get("on"))
    conn.kill_mode = on
    await ctx.broadcast(room, {
        "type": "kill_mode",
        "user_id": conn.user_id,
        "on": on,
    })


# ---------------------------------------------------------------- basketball court

def _bounded_float(msg: dict, key: str, default: float, low: float, high: float) -> float:
    try:
        value = float(msg.get(key, default))
    except Exception:
        return default
    return max(low, min(high, value))


async def handle_basketball_shot(ctx: WSContext, conn, room, msg: dict) -> None:
    """Broadcast a cosmetic basketball projectile for the Basketball Court.

    Physics stays client-side so this remains lightweight; the server only
    validates the initial vector and fans it out to everyone in the room.
    """
    behavior = ctx.behavior_for_room(room.room_id)
    if not ((behavior.interaction_rules or {}).get("shots_enabled") and room.room_id == "basketball-court"):
        return
    now = time.time()
    if now - getattr(conn, "_last_basketball_shot_ts", 0.0) < 0.35:
        return
    conn._last_basketball_shot_ts = now

    await ctx.broadcast(room, {
        "type": "basketball_shot",
        "id": str(msg.get("id") or uuid.uuid4())[:80],
        "user_id": conn.user_id,
        "nickname": conn.nickname,
        "x": _bounded_float(msg, "x", conn.x, 0, 1000),
        "y": _bounded_float(msg, "y", conn.y - 60, 0, 500),
        "vx": _bounded_float(msg, "vx", 220, -650, 650),
        "vy": _bounded_float(msg, "vy", -320, -760, 320),
        "ts": datetime.now(timezone.utc).isoformat(),
    })


# ---------------------------------------------------------------- registry

HANDLERS: Dict[str, Callable[..., Awaitable[None]]] = {
    "chat": handle_chat,
    "thought": handle_thought,
    "typing": handle_typing,
    "move": handle_move,
    "stance": handle_stance,
    "avatar": handle_avatar,
    "sprite": handle_sprite,
    "anim": handle_anim,
    "jukebox_play": handle_jukebox_play,
    "jukebox_stop": handle_jukebox_stop,
    "jukebox_enqueue": handle_jukebox_enqueue,
    "jukebox_next": handle_jukebox_next,
    "jukebox_clear": handle_jukebox_clear,
    "youtube_play": handle_youtube_play,
    "youtube_enqueue": handle_youtube_enqueue,
    "youtube_next": handle_youtube_next,
    "youtube_stop": handle_youtube_stop,
    "youtube_clear": handle_youtube_clear,
    "tag_spray": handle_tag_spray,
    "tag_clear": handle_tag_clear,
    "attack": handle_attack,
    "kill_mode": handle_kill_mode,
    "basketball_shot": handle_basketball_shot,
    "ping": handle_ping,
}


async def dispatch(ctx: WSContext, conn, room, msg: dict) -> None:
    """Look up the right handler for `msg["type"]` and run it. Unknown types
    are silently dropped (matches the previous if/elif behaviour)."""
    handler = HANDLERS.get(msg.get("type"))
    if handler is None:
        return
    await handler(ctx, conn, room, msg)
