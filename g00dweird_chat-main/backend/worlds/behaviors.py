from __future__ import annotations
from dataclasses import dataclass
from typing import Callable, Awaitable, Any

AsyncHook = Callable[[Any, Any, Any], Awaitable[None]]

@dataclass
class WorldBehavior:
    on_join: AsyncHook | None = None
    ambient_tick: AsyncHook | None = None
    interaction_rules: dict | None = None
    media_policy: dict | None = None

WORLD_BEHAVIORS = {
    "basketball-court": WorldBehavior(interaction_rules={"shots_enabled": True}),
    "inspiration-theatre": WorldBehavior(media_policy={"youtube_priority": True}),
}

def behavior_for(room_id: str) -> WorldBehavior:
    return WORLD_BEHAVIORS.get(room_id, WorldBehavior())
