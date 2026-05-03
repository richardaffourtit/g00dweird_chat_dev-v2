from __future__ import annotations
import json
from pathlib import Path
from pydantic import BaseModel
from typing import List

class RoomInfo(BaseModel):
    id: str
    name: str
    theme: str
    tagline: str
    bg_url: str


def load_worlds(manifest_path: Path) -> List[RoomInfo]:
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    rooms = [RoomInfo(**item) for item in data]
    ids = {r.id for r in rooms}
    if len(ids) != len(rooms):
        raise ValueError("duplicate world id in manifests")
    return rooms
