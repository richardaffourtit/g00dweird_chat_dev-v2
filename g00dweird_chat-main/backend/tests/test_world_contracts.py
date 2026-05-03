from pathlib import Path

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


def test_ws_handler_contract_core_events_present():
    required = {
        "chat", "move", "stance", "jukebox_enqueue", "youtube_enqueue",
        "tag_spray", "attack", "ping",
    }
    assert required.issubset(set(HANDLERS.keys()))
