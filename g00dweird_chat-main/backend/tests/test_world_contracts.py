import asyncio
from pathlib import Path
from types import SimpleNamespace

from worlds.behaviors import behavior_for
from worlds.registry import load_worlds
from ws.handlers import HANDLERS


def test_world_manifest_schema_and_uniqueness():
    rooms = load_worlds(Path(__file__).resolve().parents[1] / "worlds" / "manifests.json")
    assert rooms
    ids = [r.id for r in rooms]
    assert len(ids) == len(set(ids))
    for room in rooms:
        assert room.theme
        assert room.bg_url.startswith("/worlds/")


def test_halloween_arrivals_land_on_the_open_plaza():
    rooms = load_worlds(Path(__file__).resolve().parents[1] / "worlds" / "manifests.json")
    room = next(room for room in rooms if room.id == "halloween")
    on_join = behavior_for(room.id).on_join
    assert on_join is not None

    positions = set()
    for index in range(100):
        conn = SimpleNamespace(user_id=f"halloween-guest-{index}", x=50, y=200)
        asyncio.run(on_join(None, conn, room))
        assert 450 <= conn.x <= 550
        assert 300 <= conn.y <= 340
        position = (conn.x, conn.y)
        positions.add(position)
        asyncio.run(on_join(None, conn, room))
        assert (conn.x, conn.y) == position
    assert len(positions) > 90


def test_ws_handler_contract_core_events_present():
    required = {
        "chat", "move", "stance", "jukebox_enqueue", "youtube_enqueue",
        "tag_spray", "attack", "ping",
    }
    assert required.issubset(set(HANDLERS.keys()))
