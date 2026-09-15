import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from ws.handlers import ALLOWED_ANIM, handle_anim


def test_tee_kae_is_an_allowed_animated_sprite():
    assert "teekae" in ALLOWED_ANIM


def test_present_animation_is_accepted_broadcast_and_saved():
    broadcast = AsyncMock()
    update_user = AsyncMock()
    ctx = SimpleNamespace(
        broadcast=broadcast,
        db=SimpleNamespace(users=SimpleNamespace(update_one=update_user)),
    )
    conn = SimpleNamespace(user_id="user-1", anim_id="teekae")
    room = SimpleNamespace(room_id="neoclassick")

    asyncio.run(handle_anim(ctx, conn, room, {"anim_id": "present"}))

    assert "present" in ALLOWED_ANIM
    assert conn.anim_id == "present"
    broadcast.assert_awaited_once_with(
        room, {"type": "anim", "user_id": "user-1", "anim_id": "present"}
    )
    update_user.assert_awaited_once_with(
        {"id": "user-1"}, {"$set": {"anim_id": "present"}}
    )
