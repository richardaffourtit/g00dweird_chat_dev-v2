import asyncio
from types import SimpleNamespace

from worlds.behaviors import behavior_for
from ws.handlers import WSContext, handle_basketball_shot


async def noop_async(*args, **kwargs):
    return None


def make_context(sent):
    async def broadcast(room, message, *args, **kwargs):
        sent.append(message)

    return WSContext(
        db=None,
        broadcast=broadcast,
        weirdbot_react=noop_async,
        advance_jukebox=noop_async,
        avatar_url_to_path=lambda url: None,
        max_tags_per_room=80,
        room_state_cls=object,
        persist_room_media_state=noop_async,
        record_metric=lambda name, payload: None,
        behavior_for_room=behavior_for,
    )


def test_basketball_shot_broadcast_includes_target_coordinates():
    sent = []
    ctx = make_context(sent)
    conn = SimpleNamespace(user_id="user-1", nickname="Rich Ford", x=300, y=370)
    room = SimpleNamespace(room_id="basketball-court")

    asyncio.run(handle_basketball_shot(ctx, conn, room, {
        "id": "shot-1",
        "x": 386,
        "y": 217,
        "vx": 280,
        "vy": -360,
        "target_x": 668,
        "target_y": 89,
    }))

    assert len(sent) == 1
    assert sent[0]["type"] == "basketball_shot"
    assert sent[0]["target_x"] == 668
    assert sent[0]["target_y"] == 89
