"""
g00dweird.com - Win95 Retro Chatroom Backend (v2)
Adds: chat history replay, guestbook, sprite_id, jukebox queue,
upload mime/kind validation + per-user rate limit, typing WS event,
streaming file downloads.
"""
import os
import io
import uuid
import json
import time
import logging
import asyncio
import subprocess
import re
from pathlib import Path
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Dict, List, Optional

import boto3
import certifi
from botocore.exceptions import BotoCoreError, ClientError
from pymongo.errors import PyMongoError
from fastapi import (
    FastAPI, APIRouter, WebSocket, WebSocketDisconnect, UploadFile,
    File, Form, HTTPException, Query
)
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from worlds.registry import load_worlds, RoomInfo
from worlds.behaviors import behavior_for

from ws.handlers import WSContext, dispatch as ws_dispatch

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("g00dweird")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=3000,
    connectTimeoutMS=3000,
    socketTimeoutMS=5000,
    tlsCAFile=certifi.where(),
)
db = client[os.environ["DB_NAME"]]

# ---------- Object Storage ----------
APP_NAME = "g00dweird"
LOCAL_STORAGE_DIR = Path(os.environ.get("LOCAL_STORAGE_DIR", ROOT_DIR / "local_storage")).resolve()
OBJECT_STORAGE_PROVIDER = os.environ.get("OBJECT_STORAGE_PROVIDER", "local").strip().lower()
OBJECT_STORAGE_BUCKET = os.environ.get("OBJECT_STORAGE_BUCKET")
OBJECT_STORAGE_ENDPOINT_URL = os.environ.get("OBJECT_STORAGE_ENDPOINT_URL")
OBJECT_STORAGE_REGION = os.environ.get("OBJECT_STORAGE_REGION", "auto")
_s3_client = None


def _use_s3_storage() -> bool:
    return OBJECT_STORAGE_PROVIDER in {"s3", "r2"} and bool(OBJECT_STORAGE_BUCKET)


def _get_s3_client():
    global _s3_client
    if _s3_client:
        return _s3_client
    _s3_client = boto3.client(
        "s3",
        region_name=OBJECT_STORAGE_REGION,
        endpoint_url=OBJECT_STORAGE_ENDPOINT_URL or None,
    )
    return _s3_client


def _local_object_path(path: str) -> Path:
    rel = Path(path)
    if rel.is_absolute() or any(part in ("", ".", "..") for part in rel.parts):
        raise ValueError("invalid object path")
    dest = (LOCAL_STORAGE_DIR / rel).resolve()
    if LOCAL_STORAGE_DIR != dest and LOCAL_STORAGE_DIR not in dest.parents:
        raise ValueError("invalid object path")
    return dest


def init_storage() -> None:
    """Initialize backing object storage for uploads."""
    if _use_s3_storage():
        _get_s3_client()
        return
    LOCAL_STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def put_object(path: str, data: bytes, content_type: str) -> dict:
    if not _use_s3_storage():
        dest = _local_object_path(path)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return {"path": path, "size": len(data), "content_type": content_type, "local": True}
    try:
        _get_s3_client().put_object(
            Bucket=OBJECT_STORAGE_BUCKET,
            Key=path,
            Body=data,
            ContentType=content_type,
        )
    except (BotoCoreError, ClientError) as e:
        raise RuntimeError(f"object storage upload failed: {e}") from e
    return {"path": path, "size": len(data), "content_type": content_type, "provider": OBJECT_STORAGE_PROVIDER}


def get_object(path: str):
    if not _use_s3_storage():
        data = _local_object_path(path).read_bytes()
        return data, "application/octet-stream"
    try:
        resp = _get_s3_client().get_object(Bucket=OBJECT_STORAGE_BUCKET, Key=path)
        return resp["Body"].read(), resp.get("ContentType", "application/octet-stream")
    except (BotoCoreError, ClientError) as e:
        raise RuntimeError(f"object storage fetch failed: {e}") from e


# ---------- Models ----------
class JoinRequest(BaseModel):
    nickname: str


class JoinResponse(BaseModel):
    user_id: str
    nickname: str


class FileRecord(BaseModel):
    id: str
    user_id: str
    nickname: str
    kind: str
    storage_path: str
    original_filename: str
    content_type: str
    size: int
    created_at: str


class GuestbookPost(BaseModel):
    user_id: str
    nickname: str
    message: str


class GuestbookEntry(BaseModel):
    id: str
    user_id: str
    nickname: str
    message: str
    created_at: str


# ---------- Static Rooms ----------
ROOMS = load_worlds(ROOT_DIR / "worlds" / "manifests.json")
ROOM_BY_ID = {r.id: r for r in ROOMS}

MAX_HISTORY_PER_ROOM = 50
MAX_TAGS_PER_ROOM = 80


# ---------- Realtime state ----------
class RoomState:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.connections: Dict[str, "ClientConn"] = {}
        self.current_audio: Optional[dict] = None
        self.current_video: Optional[dict] = None
        self.audio_queue: List[dict] = []
        self.video_queue: List[dict] = []
        self.current_youtube: Optional[dict] = None  # {video_id, title, started_ts, by}
        self.youtube_queue: List[dict] = []           # [{video_id, title, by}]


class ClientConn:
    def __init__(self, ws, user_id, nickname, avatar_url, sprite_id, anim_id=None, anim_stance="idle"):
        self.ws = ws
        self.user_id = user_id
        self.nickname = nickname
        self.avatar_url = avatar_url
        self.sprite_id = sprite_id
        self.anim_id = anim_id
        self.anim_stance = anim_stance
        self.facing: str = "right"
        self.thought: Optional[str] = None
        self.thought_fullfunk: bool = False
        self.last_message: Optional[dict] = None  # {text, ts, fullfunk}
        self.x: float = 50 + (hash(user_id) % 400)
        self.y: float = 200 + (hash(user_id[::-1]) % 100)
        # PvP — hit count, last hit timestamp, dead-state freeze
        self.hits_taken: int = 0
        self.last_hit_ts: float = 0.0
        self.dead_until: float = 0.0  # epoch seconds; while > now() the user is "dead"
        # Animation-priority guards (per spec: emotes can't interrupt attack/hurt/die)
        self.attack_until: float = 0.0
        self.hurt_until: float = 0.0
        # Kill-mode toggle — when on, this user's iso clicks attack instead of
        # opening the target's profile. Broadcast as a "hostile" indicator.
        self.kill_mode: bool = False


# ---------- WeirdBot ----------
import random as _rand_bot

WEIRDBOT_SAYINGS = [
    "PSA: the chairs are gossiping about the ceiling.",
    "breaking news: a tiny wizard was spotted in the vending machine.",
    "attention citizens: the soup has become self aware.",
    "reminder: never trust a doorway that blinks first.",
    "status update: the moon just left me on read.",
    "important: somebody fed static to the pigeons again.",
]
WEIRDBOT_REACTS = [
    "!!", "<3", "??", ">:3", "✦",
    "noted", "weird", "ok ok", "based",
    "feels", "no way", "lol",
    "hmm", "...", "huh",
]
WEIRDBOT_THINKS = [
    "i just heard a lamp apologize to the moon",
    "the carpet is remembering your footsteps",
    "someone microwaved a prophecy",
    "i found a staircase hiding inside a soup",
    "the hallway is chewing bubblegum again",
    "a moth just won an argument with gravity",
    "the void is wearing eyeliner tonight",
]

WEIRDBOT_SPEECH_INTERVAL_SECONDS = 180.0
WEIRDBOT_REACT_PROBABILITY = 0.08
WEIRDBOT_FIRST_THOUGHT_INTERVAL_SECONDS = 16.0
WEIRDBOT_THOUGHT_INTERVAL_SECONDS = 45.0
WEIRDBOT_THOUGHT_HOLD_SECONDS = 11.0
WEIRDBOT_SAFE_X_MIN = 150.0
WEIRDBOT_SAFE_X_MAX = 850.0
WEIRDBOT_SAFE_Y_MIN = 220.0
WEIRDBOT_SAFE_Y_MAX = 430.0
WEIRDBOT_MOVE_MIN_DISTANCE = 85.0
WEIRDBOT_MOVE_X_RANGE = 260.0
WEIRDBOT_MOVE_Y_RANGE = 125.0


async def _clear_weirdbot_thought(room_state, bot_uid: str, thought: str, delay: float = WEIRDBOT_THOUGHT_HOLD_SECONDS):
    await asyncio.sleep(delay)
    bot = room_state.connections.get(bot_uid)
    if bot is None or bot.thought != thought:
        return
    bot.thought = None
    await broadcast(room_state, {
        "type": "thought",
        "user_id": bot_uid,
        "thought": "",
        "fullfunk": False,
    })


class WeirdBotConn:
    """A lightweight pseudo-connection that joins every room as 'weirdbot'.
    Has no real WebSocket — broadcast() skips it because there's no .ws."""
    def __init__(self, room_id: str):
        self.ws = None
        self.user_id = f"weirdbot-{room_id}"
        self.nickname = "weirdbot"
        self.avatar_url = None
        self.sprite_id = None
        self.anim_id = "weirdbot"
        self.anim_stance = "idle"
        self.facing: str = "right"
        self.thought: Optional[str] = None
        self.thought_fullfunk: bool = False
        self.last_message: Optional[dict] = None
        self.x: float = WEIRDBOT_SAFE_X_MIN + _rand_bot.random() * (WEIRDBOT_SAFE_X_MAX - WEIRDBOT_SAFE_X_MIN)
        self.y: float = WEIRDBOT_SAFE_Y_MIN + _rand_bot.random() * (WEIRDBOT_SAFE_Y_MAX - WEIRDBOT_SAFE_Y_MIN)
        self._target_x = self.x
        self._target_y = self.y
        self.next_speech_ts: float = time.time() + WEIRDBOT_SPEECH_INTERVAL_SECONDS
        self.next_thought_ts: float = time.time() + WEIRDBOT_THOUGHT_INTERVAL_SECONDS
        # PvP — same shape as ClientConn so attack handler doesn't AttributeError
        self.hits_taken: int = 0
        self.last_hit_ts: float = 0.0
        self.dead_until: float = 0.0
        self.attack_until: float = 0.0
        self.hurt_until: float = 0.0
        # Bots stay PEACEful by default; field present for symmetry with
        # ClientConn so kill_mode handler / room_user_list don't have to guard.
        self.kill_mode: bool = False


def _clamp_weirdbot_value(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _weirdbot_next_target(bot) -> tuple[float, float]:
    current_x = float(getattr(bot, "x", 250.0) or 250.0)
    current_y = float(getattr(bot, "y", 250.0) or 250.0)
    min_distance_sq = WEIRDBOT_MOVE_MIN_DISTANCE * WEIRDBOT_MOVE_MIN_DISTANCE
    for _ in range(4):
        target_x = _clamp_weirdbot_value(
            current_x + (_rand_bot.random() * WEIRDBOT_MOVE_X_RANGE * 2 - WEIRDBOT_MOVE_X_RANGE),
            WEIRDBOT_SAFE_X_MIN,
            WEIRDBOT_SAFE_X_MAX,
        )
        target_y = _clamp_weirdbot_value(
            current_y + (_rand_bot.random() * WEIRDBOT_MOVE_Y_RANGE * 2 - WEIRDBOT_MOVE_Y_RANGE),
            WEIRDBOT_SAFE_Y_MIN,
            WEIRDBOT_SAFE_Y_MAX,
        )
        dx = target_x - current_x
        dy = target_y - current_y
        if (dx * dx) + (dy * dy) >= min_distance_sq:
            return target_x, target_y

    room_mid_x = (WEIRDBOT_SAFE_X_MIN + WEIRDBOT_SAFE_X_MAX) / 2
    target_x = WEIRDBOT_SAFE_X_MAX if current_x < room_mid_x else WEIRDBOT_SAFE_X_MIN
    target_y = _clamp_weirdbot_value(
        current_y + (_rand_bot.random() * WEIRDBOT_MOVE_Y_RANGE * 2 - WEIRDBOT_MOVE_Y_RANGE),
        WEIRDBOT_SAFE_Y_MIN,
        WEIRDBOT_SAFE_Y_MAX,
    )
    return target_x, target_y


ROOM_STATES: Dict[str, RoomState] = {r.id: RoomState(r.id) for r in ROOMS}
STATE_LOCK = asyncio.Lock()


async def persist_room_media_state(room: RoomState):
    try:
        await db.room_media_state.update_one(
            {"room_id": room.room_id},
            {"$set": {
                "room_id": room.room_id,
                "current_audio": room.current_audio,
                "current_video": room.current_video,
                "audio_queue": room.audio_queue,
                "video_queue": room.video_queue,
                "current_youtube": room.current_youtube,
                "youtube_queue": room.youtube_queue,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
    except Exception:
        logger.exception("persist_room_media_state_failed", extra={"room_id": room.room_id})


async def restore_room_media_state(room: RoomState):
    try:
        rec = await db.room_media_state.find_one({"room_id": room.room_id}, {"_id": 0})
        if not rec:
            return
        room.current_audio = rec.get("current_audio")
        room.current_video = rec.get("current_video")
        room.audio_queue = rec.get("audio_queue") or []
        room.video_queue = rec.get("video_queue") or []
        room.current_youtube = rec.get("current_youtube")
        room.youtube_queue = rec.get("youtube_queue") or []
    except Exception:
        logger.exception("restore_room_media_state_failed", extra={"room_id": room.room_id})




def record_metric(event: str, fields: Optional[dict] = None):
    logger.info("metric", extra={"event": event, **(fields or {})})

async def broadcast(room: RoomState, message: dict, exclude: Optional[str] = None):
    dead: List[str] = []
    payload = json.dumps(message)
    for uid, conn in list(room.connections.items()):
        if exclude and uid == exclude:
            continue
        if conn.ws is None:  # bots have no real WS — skip outbound send
            continue
        try:
            await conn.ws.send_text(payload)
        except Exception:
            dead.append(uid)
    for uid in dead:
        room.connections.pop(uid, None)


def room_user_list(room: RoomState) -> list:
    now_ms = time.time() * 1000
    out = []
    for c in room.connections.values():
        lm = c.last_message
        # Strip stale last_message so new joiners don't see zombie bubbles.
        # WeirdBot speaks rarely, so its bubble is allowed to linger longer.
        if lm:
            try:
                lm_ts = datetime.fromisoformat(lm["ts"].replace("Z", "+00:00")).timestamp() * 1000
                stale_after_ms = 45000 if c.user_id.startswith("weirdbot-") else 12000
                if now_ms - lm_ts > stale_after_ms:
                    lm = None
            except Exception:
                lm = None
        out.append({
            "user_id": c.user_id, "nickname": c.nickname,
            "avatar_url": c.avatar_url, "sprite_id": c.sprite_id,
            "anim_id": c.anim_id, "anim_stance": c.anim_stance,
            "thought": c.thought, "thought_fullfunk": c.thought_fullfunk,
            "last_message": lm,
            "x": c.x, "y": c.y,
            "facing": getattr(c, "facing", "right"),
            "kill_mode": getattr(c, "kill_mode", False),
        })
    return out


# ---------- App ----------
app = FastAPI()
api_router = APIRouter(prefix="/api")


@app.on_event("startup")
async def on_startup():
    init_storage()
    # Ensure guestbook index
    try:
        await db.guestbook.create_index("created_at")
    except Exception:
        pass
    await db.room_media_state.create_index("room_id", unique=True)
    for room in ROOM_STATES.values():
        await restore_room_media_state(room)
    # spawn the WeirdBot tick task
    asyncio.create_task(_weirdbot_loop())
    logger.info("g00dweird backend ready")


async def _weirdbot_loop():
    """Drive WeirdBot presence in every room with at least one human."""
    while True:
        try:
            for room_id, room in ROOM_STATES.items():
                # Count real humans
                humans = [c for c in room.connections.values() if c.ws is not None]
                bot_uid = f"weirdbot-{room_id}"
                if not humans:
                    # nobody home -> remove bot if present
                    if bot_uid in room.connections:
                        room.connections.pop(bot_uid, None)
                        await broadcast(room, {"type": "user_left", "user_id": bot_uid})
                    continue
                # Ensure bot is connected
                if bot_uid not in room.connections:
                    bot = WeirdBotConn(room_id)
                    bot.thought = _rand_bot.choice(WEIRDBOT_THINKS)
                    bot.anim_stance = "think"
                    bot.next_thought_ts = time.time() + WEIRDBOT_FIRST_THOUGHT_INTERVAL_SECONDS
                    room.connections[bot_uid] = bot
                    await broadcast(room, {
                        "type": "user_joined",
                        "user": {
                            "user_id": bot.user_id, "nickname": bot.nickname,
                            "avatar_url": None, "sprite_id": None,
                            "anim_id": "weirdbot", "anim_stance": bot.anim_stance,
                            "thought": bot.thought, "thought_fullfunk": False,
                            "x": bot.x, "y": bot.y, "facing": bot.facing,
                        },
                    })
                    asyncio.create_task(_clear_weirdbot_thought(room, bot_uid, bot.thought))
                    continue  # let humans see the join first

                bot = room.connections[bot_uid]
                # Ambient motion stays fairly frequent, but speech/thought is
                # rate-limited so WeirdBot feels present without flooding chat.
                action = _rand_bot.choices(
                    ["walk", "glitch", "idle"],
                    weights=[7, 1, 2], k=1,
                )[0]
                now = time.time()
                speech_due = now >= getattr(bot, "next_speech_ts", 0.0)
                thought_due = now >= getattr(bot, "next_thought_ts", 0.0)
                if speech_due:
                    action = "talk"
                    bot.next_speech_ts = now + WEIRDBOT_SPEECH_INTERVAL_SECONDS
                elif thought_due:
                    action = "think"
                    bot.next_thought_ts = now + WEIRDBOT_THOUGHT_INTERVAL_SECONDS

                if action == "walk":
                    bot._target_x, bot._target_y = _weirdbot_next_target(bot)
                    if abs(bot._target_x - bot.x) > 1:
                        bot.facing = "left" if bot._target_x < bot.x else "right"
                    bot.x = bot._target_x
                    bot.y = bot._target_y
                    bot.anim_stance = "walk"
                    await broadcast(room, {"type": "move", "user_id": bot.user_id, "x": bot.x, "y": bot.y, "facing": bot.facing})
                    await broadcast(room, {"type": "stance", "user_id": bot.user_id, "stance": "walk"})
                elif action == "talk":
                    saying = _rand_bot.choice(WEIRDBOT_SAYINGS)
                    bot.anim_stance = "talk"
                    if bot.thought:
                        bot.thought = None
                        await broadcast(room, {"type": "thought", "user_id": bot.user_id, "thought": "", "fullfunk": False})
                    bot.last_message = {
                        "text": saying,
                        "ts": datetime.now(timezone.utc).isoformat(),
                        "fullfunk": False,
                    }
                    await broadcast(room, {"type": "stance", "user_id": bot.user_id, "stance": "talk"})
                    await broadcast(room, {
                        "type": "chat",
                        "user_id": bot.user_id,
                        "nickname": bot.nickname,
                        "text": saying,
                        "is_thought": False,
                        "is_fullfunk": False,
                        "is_system": False,
                        "ts": bot.last_message["ts"],
                    })
                elif action == "think":
                    th = _rand_bot.choice(WEIRDBOT_THINKS)
                    bot.thought = th
                    bot.thought_fullfunk = False
                    bot.anim_stance = "think"
                    await broadcast(room, {"type": "thought", "user_id": bot.user_id, "thought": th, "fullfunk": False})
                    await broadcast(room, {"type": "stance", "user_id": bot.user_id, "stance": "think"})
                    asyncio.create_task(_clear_weirdbot_thought(room, bot_uid, th))
                elif action == "glitch":
                    bot.anim_stance = "glitch"
                    await broadcast(room, {"type": "stance", "user_id": bot.user_id, "stance": "glitch"})
                else:
                    bot.anim_stance = "idle"
                    await broadcast(room, {"type": "stance", "user_id": bot.user_id, "stance": "idle"})
            # Sleep between ticks: enough room to breathe, quick enough that a
            # room with one person still feels like somebody else is present.
            await asyncio.sleep(_rand_bot.uniform(7.0, 13.0))
        except Exception:
            logger.exception("weirdbot loop error")
            await asyncio.sleep(5.0)


async def weirdbot_react(room: RoomState, trigger_text: str, recent_messages: Optional[List[dict]] = None):
    """Called when a real user sends chat — bot reacts ~30% of the time.
    Uses the local weirdbot brain for keyword/canned replies."""
    bot_uid = f"weirdbot-{room.room_id}"
    bot = room.connections.get(bot_uid)
    # React sometimes, not constantly. This keeps one-on-one rooms warm while
    # still leaving space in busier rooms.
    now = time.time()
    if (
        not bot
        or now < getattr(bot, "next_speech_ts", 0.0)
        or _rand_bot.random() > WEIRDBOT_REACT_PROBABILITY
    ):
        return
    bot.next_speech_ts = now + WEIRDBOT_SPEECH_INTERVAL_SECONDS
    # Compose reply through the lightweight bot brain with a canned fallback.
    try:
        from weirdbot_brain import weirdbot_reply
        react = await weirdbot_reply(recent_messages or [], trigger_text)
    except Exception:
        logger.exception("weirdbot_reply failed")
        react = _rand_bot.choice(WEIRDBOT_REACTS)
    if not react:
        react = _rand_bot.choice(WEIRDBOT_REACTS)
    bot.anim_stance = "react"
    if bot.thought:
        bot.thought = None
        await broadcast(room, {"type": "thought", "user_id": bot.user_id, "thought": "", "fullfunk": False})
    bot.last_message = {
        "text": react,
        "ts": datetime.now(timezone.utc).isoformat(),
        "fullfunk": False,
    }
    await broadcast(room, {"type": "stance", "user_id": bot.user_id, "stance": "react"})
    await broadcast(room, {
        "type": "chat",
        "user_id": bot.user_id,
        "nickname": bot.nickname,
        "text": react,
        "is_thought": False,
        "is_fullfunk": False,
        "is_system": False,
        "ts": bot.last_message["ts"],
    })


@api_router.get("/")
async def root():
    return {"message": "welcome to g00dweird", "rooms": [r.model_dump() for r in ROOMS]}


@api_router.get("/health")
async def health():
    return {
        "ok": True,
        "service": "g00dweird-backend",
        "rooms": len(ROOMS),
        "storage": OBJECT_STORAGE_PROVIDER,
    }


@api_router.get("/rooms", response_model=List[RoomInfo])
async def list_rooms():
    return ROOMS


# ---------- Sprite Lab dev endpoints ----------
PROJECT_ROOT = ROOT_DIR.parent
SPRITE_CLEAN_CONFIG = PROJECT_ROOT / "sprite-clean.config.json"


def _sprite_config() -> dict:
    if not SPRITE_CLEAN_CONFIG.exists():
        return {
            "outputDir": "frontend/public/assets/cleaned-sprites",
            "manualOverridesFile": "frontend/public/assets/cleaned-sprites/manual-overrides.json",
        }
    with SPRITE_CLEAN_CONFIG.open() as fh:
        return json.load(fh)


def _sprite_output_dir() -> Path:
    return (PROJECT_ROOT / _sprite_config().get("outputDir", "frontend/public/assets/cleaned-sprites")).resolve()


def _manual_overrides_path() -> Path:
    return (PROJECT_ROOT / _sprite_config().get(
        "manualOverridesFile",
        "frontend/public/assets/cleaned-sprites/manual-overrides.json",
    )).resolve()


def _public_asset_url(path_value: str) -> str:
    marker = "frontend/public/"
    if marker in path_value:
        return "/" + path_value.split(marker, 1)[1]
    return "/" + path_value.lstrip("/")


def _safe_sprite_id(sprite_id: str) -> str:
    if not re.match(r"^[A-Za-z0-9_.-]+$", sprite_id):
        raise HTTPException(400, "invalid sprite id")
    return sprite_id


def _load_descriptor(sprite_id: str) -> dict:
    safe_id = _safe_sprite_id(sprite_id)
    path = _sprite_output_dir() / "descriptors" / f"{safe_id}.json"
    if not path.exists():
        raise HTTPException(404, "sprite descriptor not found")
    with path.open() as fh:
        data = json.load(fh)
    data["cleanedImageUrl"] = _public_asset_url(data.get("outputSheet", ""))
    source = data.get("source", "")
    if source:
        data["originalImageUrl"] = _public_asset_url(f"frontend/public/{source}") if source.startswith(("anim/", "assets/", "scenery/", "tags/", "wall/")) else _public_asset_url(source)
    return data


@api_router.get("/sprites/list")
async def list_cleaned_sprites():
    descriptor_dir = _sprite_output_dir() / "descriptors"
    if not descriptor_dir.exists():
        return {"sprites": []}
    sprites = []
    for path in sorted(descriptor_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text())
        except Exception:
            continue
        sprites.append({
            "id": data.get("id", path.stem),
            "source": data.get("source", ""),
            "frameCount": data.get("frameCount", 0),
            "warnings": data.get("warnings", []),
            "cleanedImageUrl": _public_asset_url(data.get("outputSheet", "")),
        })
    return {"sprites": sprites}


@api_router.get("/sprites/{sprite_id}")
async def get_cleaned_sprite(sprite_id: str):
    return _load_descriptor(sprite_id)


@api_router.post("/sprites/{sprite_id}/overrides")
async def save_sprite_overrides(sprite_id: str, payload: dict):
    safe_id = _safe_sprite_id(sprite_id)
    descriptor = _load_descriptor(safe_id)
    overrides_path = _manual_overrides_path()
    overrides_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        overrides = json.loads(overrides_path.read_text()) if overrides_path.exists() else {}
    except Exception:
        overrides = {}
    frames = payload.get("frames") if isinstance(payload, dict) else None
    if not isinstance(frames, dict):
        raise HTTPException(400, "frames override map required")
    overrides[safe_id] = {
        "source": descriptor.get("source", payload.get("source", "")),
        "frames": frames,
    }
    overrides_path.write_text(json.dumps(overrides, indent=2) + "\n")
    return {"ok": True, "id": safe_id, "path": str(overrides_path.relative_to(PROJECT_ROOT))}


@api_router.post("/sprites/{sprite_id}/rebuild")
async def rebuild_cleaned_sprite(sprite_id: str):
    _safe_sprite_id(sprite_id)

    def _run():
        return subprocess.run(
            ["python3", "scripts/sprite_cleaner.py"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=360,
            check=False,
        )

    result = await asyncio.to_thread(_run)
    if result.returncode != 0:
        raise HTTPException(500, {"stdout": result.stdout, "stderr": result.stderr})
    return {"ok": True, "stdout": result.stdout}


@api_router.post("/join", response_model=JoinResponse)
async def join(req: JoinRequest):
    nick = req.nickname.strip()
    if len(nick) < 2 or len(nick) > 24:
        raise HTTPException(400, "nickname must be 2-24 chars")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "nickname": nick,
        "bio": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.users.insert_one(doc)
    except PyMongoError:
        logger.exception("join_failed_db_unavailable")
        raise HTTPException(503, "database unavailable; try again soon")
    return JoinResponse(user_id=user_id, nickname=nick)


# ---------- Bio ----------
class BioUpdate(BaseModel):
    bio: str


@api_router.get("/users/{user_id}/bio")
async def get_bio(user_id: str):
    doc = await db.users.find_one({"id": user_id}, {"_id": 0, "bio": 1, "nickname": 1})
    if not doc:
        raise HTTPException(404, "user not found")
    return {
        "user_id": user_id,
        "nickname": doc.get("nickname"),
        "bio": doc.get("bio", "") or "",
    }


@api_router.put("/users/{user_id}/bio")
async def put_bio(user_id: str, payload: BioUpdate):
    bio = (payload.bio or "").strip()
    if len(bio) > 500:
        raise HTTPException(400, "bio too long (max 500 chars)")
    res = await db.users.update_one({"id": user_id}, {"$set": {"bio": bio}})
    if res.matched_count == 0:
        raise HTTPException(404, "user not found")
    return {"user_id": user_id, "bio": bio}


# ---------- Public profile (shareable /u/<nickname>) ----------
@api_router.get("/profile/{nickname}")
async def get_public_profile(nickname: str, user_id: Optional[str] = Query(None)):
    """Public profile lookup by nickname. Returns the user doc + their recent
    tags + uploads + live-status snapshot.

    Nicknames aren't unique. If two or more users share a handle, pass
    `?user_id=<id>` to pin to a specific account; otherwise the most recently
    created user with that handle is returned.
    """
    nick = (nickname or "").strip()
    if not nick:
        raise HTTPException(400, "nickname required")
    query = {"nickname": nick}
    if user_id:
        query["id"] = user_id
    user_doc = await db.users.find_one(
        query,
        {"_id": 0, "id": 1, "nickname": 1, "bio": 1, "created_at": 1,
         "last_room_id": 1, "last_seen_at": 1,
         "sprite_id": 1, "anim_id": 1, "avatar_path": 1, "banner_path": 1},
        sort=[("created_at", -1)],
    )
    if not user_doc:
        raise HTTPException(404, "no profile by that handle")
    uid = user_doc["id"]

    tags = await db.tags.find(
        {"user_id": uid},
        {"_id": 0, "id": 1, "room_id": 1, "tag": 1, "custom": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(20)

    uploads = await db.files.find(
        {"user_id": uid, "kind": {"$in": ["avatar", "banner", "audio", "video"]},
         "is_deleted": {"$ne": True}},
        {"_id": 0, "id": 1, "kind": 1, "storage_path": 1,
         "original_filename": 1, "created_at": 1, "size": 1},
    ).sort("created_at", -1).to_list(15)
    latest_banner = next((u for u in uploads if u.get("kind") == "banner" and u.get("storage_path")), None)

    # Live presence snapshot — check in-memory rooms for this user
    live_room_id = None
    live_room_name = None
    for rid, rs in ROOM_STATES.items():
        if uid in rs.connections:
            live_room_id = rid
            info = ROOM_BY_ID.get(rid)
            live_room_name = info.name if info else rid
            break

    return {
        "user_id": uid,
        "nickname": user_doc.get("nickname"),
        "bio": user_doc.get("bio", "") or "",
        "created_at": user_doc.get("created_at"),
        "last_room_id": user_doc.get("last_room_id"),
        "last_seen_at": user_doc.get("last_seen_at"),
        "sprite_id": user_doc.get("sprite_id"),
        "anim_id": user_doc.get("anim_id"),
        "avatar_path": user_doc.get("avatar_path"),
        "banner_path": user_doc.get("banner_path") or (latest_banner or {}).get("storage_path"),
        "live_room_id": live_room_id,
        "live_room_name": live_room_name,
        "tags": tags,
        "uploads": uploads,
    }


# ---------- Upload hardening ----------
ALLOWED_KINDS = {"avatar", "banner", "audio", "video"}
KIND_PREFIX = {
    "avatar": ("image/",),
    "banner": ("image/",),
    "audio": ("audio/",),
    "video": ("video/",),
}
MIME_GUESS = {
    "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
    "gif": "image/gif", "webp": "image/webp", "bmp": "image/bmp",
    "mp3": "audio/mpeg", "wav": "audio/wav", "ogg": "audio/ogg",
    "m4a": "audio/mp4", "flac": "audio/flac", "aac": "audio/aac",
    "mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime",
    "ogv": "video/ogg",
}

# Simple in-memory per-user rate limit: max 10 uploads / 60s
_UPLOAD_WINDOW = 60.0
_UPLOAD_MAX = 10
_upload_times: Dict[str, deque] = defaultdict(deque)


def _rate_limit(user_id: str):
    now = time.time()
    dq = _upload_times[user_id]
    while dq and now - dq[0] > _UPLOAD_WINDOW:
        dq.popleft()
    if len(dq) >= _UPLOAD_MAX:
        raise HTTPException(429, "too many uploads, slow down")
    dq.append(now)


@api_router.post("/upload", response_model=FileRecord)
async def upload(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    nickname: str = Form(...),
    kind: str = Form(...),
):
    if kind not in ALLOWED_KINDS:
        raise HTTPException(400, "invalid kind")
    _rate_limit(user_id)

    filename = file.filename or "upload.bin"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    content_type = (file.content_type or MIME_GUESS.get(ext, "application/octet-stream")).lower()
    # Fallback: if client sent generic octet-stream, use extension-based guess
    if content_type in ("application/octet-stream", ""):
        content_type = MIME_GUESS.get(ext, content_type)

    # Validate content-type matches kind
    prefixes = KIND_PREFIX[kind]
    if not any(content_type.startswith(p) for p in prefixes):
        raise HTTPException(
            400,
            f"content-type '{content_type}' does not match kind '{kind}' (expected {prefixes})",
        )

    file_id = str(uuid.uuid4())
    storage_path = f"{APP_NAME}/{kind}/{user_id}/{file_id}.{ext}"
    data = await file.read()
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(413, "max file size 50MB")

    try:
        result = put_object(storage_path, data, content_type)
    except Exception as e:
        logger.error(f"upload failed: {e}")
        raise HTTPException(500, "upload failed")

    rec = {
        "id": file_id,
        "user_id": user_id,
        "nickname": nickname,
        "kind": kind,
        "storage_path": result["path"],
        "original_filename": filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.files.insert_one(rec)
    if kind == "banner":
        await db.users.update_one({"id": user_id}, {"$set": {"banner_path": result["path"]}})
    rec.pop("is_deleted", None)
    return FileRecord(**rec)


def _iter_chunks(data: bytes, chunk: int = 64 * 1024):
    view = memoryview(data)
    for i in range(0, len(view), chunk):
        yield bytes(view[i:i + chunk])


@api_router.get("/files/{path:path}")
async def download(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(404, "not found")
    try:
        data, content_type = get_object(path)
    except Exception as e:
        logger.error(f"fetch failed: {e}")
        raise HTTPException(500, "fetch failed")
    media_type = record.get("content_type", content_type)
    return StreamingResponse(
        _iter_chunks(data),
        media_type=media_type,
        headers={
            "Content-Length": str(len(data)),
            "Cache-Control": "public, max-age=3600",
            "Accept-Ranges": "bytes",
        },
    )


@api_router.get("/users/{user_id}/media", response_model=List[FileRecord])
async def user_media(user_id: str):
    cursor = db.files.find({"user_id": user_id, "is_deleted": False}, {"_id": 0}).sort("created_at", -1)
    docs = await cursor.to_list(500)
    return [FileRecord(**{k: v for k, v in d.items() if k != "is_deleted"}) for d in docs]


@api_router.get("/media/recent", response_model=List[FileRecord])
async def recent_media(kind: Optional[str] = None, limit: int = 30):
    q = {"is_deleted": False}
    if kind:
        q["kind"] = kind
    cursor = db.files.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(limit)
    return [FileRecord(**{k: v for k, v in d.items() if k != "is_deleted"}) for d in docs]


@api_router.get("/rooms/{room_id}/state")
async def room_state(room_id: str):
    if room_id not in ROOM_STATES:
        raise HTTPException(404, "room not found")
    r = ROOM_STATES[room_id]
    return {
        "room_id": room_id,
        "users": room_user_list(r),
        "current_audio": r.current_audio,
        "current_video": r.current_video,
        "audio_queue": r.audio_queue,
        "video_queue": r.video_queue,
        "current_youtube": r.current_youtube,
        "youtube_queue": r.youtube_queue,
    }


@api_router.get("/rooms/{room_id}/history")
async def room_history(room_id: str, limit: int = 50):
    if room_id not in ROOM_BY_ID:
        raise HTTPException(404, "room not found")
    limit = max(1, min(200, limit))
    cursor = db.messages.find(
        {"room_id": room_id, "system": {"$ne": True}},
        {"_id": 0},
    ).sort("ts", -1).limit(limit)
    docs = await cursor.to_list(limit)
    docs.reverse()
    return docs


# ---------- Tags (graffiti) ----------
class TagPost(BaseModel):
    room_id: str
    user_id: str
    nickname: str
    tag: str
    custom: bool = False
    x: float
    y: float
    rot: float = 0.0
    scale: float = 1.0


class TagRecord(BaseModel):
    id: str
    room_id: str
    user_id: str
    nickname: str
    tag: str
    custom: bool
    x: float
    y: float
    rot: float
    scale: float
    created_at: str


@api_router.get("/rooms/{room_id}/tags", response_model=List[TagRecord])
async def get_tags(room_id: str):
    if room_id not in ROOM_BY_ID:
        raise HTTPException(404, "room not found")
    cursor = db.tags.find({"room_id": room_id}, {"_id": 0}).sort("created_at", -1).limit(MAX_TAGS_PER_ROOM)
    docs = await cursor.to_list(MAX_TAGS_PER_ROOM)
    docs.reverse()
    return [TagRecord(**d) for d in docs]


@api_router.delete("/rooms/{room_id}/tags")
async def clear_tags(room_id: str):
    if room_id not in ROOM_BY_ID:
        raise HTTPException(404, "room not found")
    await db.tags.delete_many({"room_id": room_id})
    return {"cleared": True}


# ---------- Guestbook ----------
@api_router.get("/guestbook", response_model=List[GuestbookEntry])
async def get_guestbook(limit: int = 100):
    limit = max(1, min(500, limit))
    cursor = db.guestbook.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(limit)
    return [GuestbookEntry(**d) for d in docs]


@api_router.post("/guestbook", response_model=GuestbookEntry)
async def post_guestbook(post: GuestbookPost):
    msg = post.message.strip()
    if len(msg) < 1 or len(msg) > 400:
        raise HTTPException(400, "message must be 1-400 chars")
    if len(post.nickname.strip()) < 2:
        raise HTTPException(400, "nickname required")
    entry = {
        "id": str(uuid.uuid4()),
        "user_id": post.user_id,
        "nickname": post.nickname.strip(),
        "message": msg,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.guestbook.insert_one(entry)
    return GuestbookEntry(**entry)


# ---------- Jukebox helpers ----------
async def _advance(room: RoomState, kind: str):
    """Pop next from queue and broadcast as current."""
    q = room.audio_queue if kind == "audio" else room.video_queue
    if not q:
        if kind == "audio":
            room.current_audio = None
        else:
            room.current_video = None
        await broadcast(room, {"type": "jukebox_stop", "kind": kind, "auto": True})
        return
    track = q.pop(0)
    track["started_at"] = datetime.now(timezone.utc).isoformat()
    if kind == "audio":
        room.current_audio = track
    else:
        room.current_video = track
    await broadcast(room, {"type": "jukebox_play", "track": track, "kind": kind, "auto": True})
    await broadcast(room, {"type": "jukebox_queue", "kind": kind, "queue": q})


# ---------- WebSocket ----------
def _avatar_url_to_path(url):
    """Map an /api/files/<path> URL to its storage_path. Returns None for any
    other (or empty) URL so we don't store junk in the user doc."""
    if not url:
        return None
    marker = "/api/files/"
    idx = url.find(marker)
    if idx < 0:
        return None
    return url[idx + len(marker):]


# Single shared dispatch context — wires server-level dependencies into the
# extracted handler module (`ws.handlers`).
WS_CTX = WSContext(
    db=db,
    broadcast=broadcast,
    weirdbot_react=weirdbot_react,
    advance_jukebox=_advance,
    avatar_url_to_path=_avatar_url_to_path,
    max_tags_per_room=MAX_TAGS_PER_ROOM,
    room_state_cls=RoomState,
    persist_room_media_state=persist_room_media_state,
    record_metric=record_metric,
    behavior_for_room=behavior_for,
)


@app.websocket("/api/ws/{room_id}")
async def ws_endpoint(websocket: WebSocket, room_id: str,
                      user_id: str = Query(...), nickname: str = Query(...),
                      avatar_url: Optional[str] = Query(None),
                      sprite_id: Optional[str] = Query(None),
                      anim_id: Optional[str] = Query(None)):
    if room_id not in ROOM_STATES:
        await websocket.close(code=4404)
        return
    await websocket.accept()
    room = ROOM_STATES[room_id]
    conn = ClientConn(websocket, user_id, nickname, avatar_url, sprite_id, anim_id)
    async with STATE_LOCK:
        old = room.connections.get(user_id)
        if old:
            try:
                await old.ws.close()
            except Exception:
                pass
        room.connections[user_id] = conn

    behavior = behavior_for(room_id)
    if behavior.on_join:
        await behavior.on_join(WS_CTX, conn, room)

    # Persist presence to user doc for shareable profile pages.
    try:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "last_room_id": room_id,
                "last_seen_at": datetime.now(timezone.utc).isoformat(),
                "sprite_id": sprite_id,
                "anim_id": anim_id,
                "avatar_path": _avatar_url_to_path(avatar_url),
            }},
        )
    except Exception:
        pass

    # Load chat history
    try:
        cursor = db.messages.find(
            {"room_id": room_id, "system": {"$ne": True}}, {"_id": 0},
        ).sort("ts", -1).limit(MAX_HISTORY_PER_ROOM)
        hist = await cursor.to_list(MAX_HISTORY_PER_ROOM)
        hist.reverse()
    except Exception:
        hist = []

    # Load recent tags
    try:
        cursor = db.tags.find({"room_id": room_id}, {"_id": 0}).sort("created_at", -1).limit(MAX_TAGS_PER_ROOM)
        tags = await cursor.to_list(MAX_TAGS_PER_ROOM)
        tags.reverse()
    except Exception:
        tags = []

    await websocket.send_text(json.dumps({
        "type": "snapshot",
        "users": room_user_list(room),
        "current_audio": room.current_audio,
        "current_video": room.current_video,
        "audio_queue": room.audio_queue,
        "video_queue": room.video_queue,
        "current_youtube": room.current_youtube,
        "youtube_queue": room.youtube_queue,
        "history": hist,
        "tags": tags,
        "room_id": room_id,
    }))
    await broadcast(room, {
        "type": "user_joined",
        "user": {"user_id": conn.user_id, "nickname": conn.nickname,
                 "avatar_url": conn.avatar_url, "sprite_id": conn.sprite_id,
                 "anim_id": conn.anim_id, "anim_stance": conn.anim_stance,
                 "x": conn.x, "y": conn.y, "facing": conn.facing}
    }, exclude=user_id)
    join_msg = {
        "type": "chat",
        "id": str(uuid.uuid4()),
        "user_id": "system",
        "nickname": "SYSTEM",
        "text": f"*** {nickname} has logged on ***",
        "ts": datetime.now(timezone.utc).isoformat(),
        "system": True,
    }
    await broadcast(room, join_msg)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            await ws_dispatch(WS_CTX, conn, room, msg)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"ws error: {e}")
    finally:
        async with STATE_LOCK:
            if room.connections.get(user_id) is conn:
                room.connections.pop(user_id, None)
        try:
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"last_seen_at": datetime.now(timezone.utc).isoformat(),
                          "last_room_id": room_id}},
            )
        except Exception:
            pass
        await broadcast(room, {"type": "user_left", "user_id": user_id})
        await broadcast(room, {
            "type": "chat",
            "id": str(uuid.uuid4()),
            "user_id": "system",
            "nickname": "SYSTEM",
            "text": f"*** {nickname} has logged off ***",
            "ts": datetime.now(timezone.utc).isoformat(),
            "system": True,
        })


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
