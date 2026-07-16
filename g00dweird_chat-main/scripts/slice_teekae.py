#!/usr/bin/env python3
"""Slice the Tee Kae character sheets into transparent runtime frames.

The full source sheet has a baked light checkerboard and supplies every state
except walk.  The dedicated walk sheet has a noisy magenta key and is authored
at twice the runtime scale.  Manual crops and actor pivots keep Tee Kae's feet
grounded while detached emotes/audio effects survive.
"""

from __future__ import annotations

import json
from collections import deque
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BASE_SOURCE = (
    ROOT
    / "frontend"
    / "public"
    / "source-assets"
    / "avatar"
    / "g00dwierd_avatar_teekae.png"
)
WALK_SOURCE = BASE_SOURCE.with_name("g00dwierd_avatar_teekae_walk.png")
OUT_DIR = ROOT / "frontend" / "public" / "anim" / "teekae"
MANIFEST = ROOT / "frontend" / "public" / "anim" / "manifest.json"

BASE_EXPECTED_SIZE = (1448, 1086)
WALK_EXPECTED_SIZE = (1774, 887)
CANVAS_HEIGHT = 224
BASELINE_Y = 220


@dataclass(frozen=True)
class FrameSpec:
    name: str
    crop: tuple[int, int, int, int]
    pivot_x: int
    canvas_width: int
    scale: float = 1.0


BASE_FRAME_SPECS = [
    FrameSpec("idle_0", (202, 7, 334, 224), 266, 180),
    FrameSpec("idle_1", (414, 7, 547, 225), 478, 180),
    FrameSpec("idle_2", (632, 7, 765, 225), 696, 180),
    FrameSpec("emote_a_0", (184, 427, 342, 657), 271, 180),
    FrameSpec("emote_b_0", (406, 427, 574, 657), 481, 180),
    FrameSpec("emote_c_0", (620, 427, 766, 657), 693, 180),
    FrameSpec("emote_d_0", (816, 427, 974, 657), 892, 180),
    FrameSpec("attack_0", (189, 649, 339, 846), 256, 520),
    FrameSpec("attack_1", (420, 649, 676, 846), 495, 520),
    FrameSpec("attack_2", (736, 649, 1066, 846), 813, 520),
    FrameSpec("attack_3", (1092, 649, 1379, 846), 1179, 520),
    FrameSpec("die_0", (177, 840, 349, 1061), 263, 280),
    FrameSpec("die_1", (392, 840, 597, 1061), 495, 280),
    FrameSpec("die_2", (684, 840, 921, 1061), 803, 280),
    FrameSpec("die_3", (953, 840, 1212, 1061), 1083, 280),
]

# The walk sheet uses six equal horizontal cells. Waist pivots are deliberately
# offset from cell centers so contact and passing poses do not slide sideways.
WALK_FRAME_SPECS = [
    FrameSpec("walk_0", (0, 156, 296, 604), 184, 180, 0.55),
    FrameSpec("walk_1", (296, 156, 591, 604), 472, 180, 0.55),
    FrameSpec("walk_2", (591, 156, 887, 604), 747, 180, 0.55),
    FrameSpec("walk_3", (887, 156, 1183, 604), 1031, 180, 0.55),
    FrameSpec("walk_4", (1183, 156, 1478, 604), 1325, 180, 0.55),
    FrameSpec("walk_5", (1478, 156, 1774, 604), 1602, 180, 0.55),
]

FRAME_COUNTS = {
    "idle": 3,
    "walk": 6,
    "attack": 4,
    "hurt": 1,
    "die": 4,
    "emote_a": 1,
    "emote_b": 1,
    "emote_c": 1,
    "emote_d": 1,
}


def edge_connected_checker(rgb: np.ndarray) -> np.ndarray:
    """Return the bright neutral checker pixels connected to a crop edge."""

    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    candidate = (minimum >= 205) & ((maximum - minimum) <= 30)
    height, width = candidate.shape
    background = np.zeros((height, width), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        if candidate[0, x]:
            queue.append((0, x))
        if candidate[height - 1, x]:
            queue.append((height - 1, x))
    for y in range(height):
        if candidate[y, 0]:
            queue.append((y, 0))
        if candidate[y, width - 1]:
            queue.append((y, width - 1))

    while queue:
        y, x = queue.popleft()
        if y < 0 or x < 0 or y >= height or x >= width:
            continue
        if background[y, x] or not candidate[y, x]:
            continue
        background[y, x] = True
        queue.extend(((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)))

    return background


def noisy_magenta_key(rgb: np.ndarray) -> np.ndarray:
    """Return noisy magenta chroma pixels, including dark edge spill."""

    colors = rgb.astype(np.int16)
    red = colors[:, :, 0]
    green = colors[:, :, 1]
    blue = colors[:, :, 2]
    magenta_strength = np.minimum(red, blue) - green
    red_blue_delta = np.abs(red - blue)
    return (magenta_strength > 15) & (red_blue_delta < 60)


def render_frame(
    source: Image.Image,
    spec: FrameSpec,
    background_masker,
) -> Image.Image:
    crop = source.crop(spec.crop).convert("RGB")
    rgb = np.asarray(crop)
    background = background_masker(rgb)
    alpha = np.where(background, 0, 255).astype(np.uint8)
    rgba = Image.fromarray(np.dstack((rgb, alpha)), "RGBA")

    bbox = rgba.getchannel("A").getbbox()
    if not bbox:
        raise ValueError(f"{spec.name} contains no visible pixels")

    trimmed = rgba.crop(bbox)
    source_pivot_in_crop = spec.pivot_x - spec.crop[0]
    trimmed_pivot_x = source_pivot_in_crop - bbox[0]
    if spec.scale != 1.0:
        scaled_size = (
            max(1, round(trimmed.width * spec.scale)),
            max(1, round(trimmed.height * spec.scale)),
        )
        trimmed = trimmed.resize(scaled_size, Image.Resampling.NEAREST)
        trimmed_pivot_x *= spec.scale
    paste_x = round(spec.canvas_width / 2 - trimmed_pivot_x)
    paste_y = BASELINE_Y - trimmed.height

    if paste_x < 0 or paste_x + trimmed.width > spec.canvas_width:
        raise ValueError(f"{spec.name} exceeds its {spec.canvas_width}px canvas")
    if paste_y < 0 or paste_y + trimmed.height > CANVAS_HEIGHT:
        raise ValueError(f"{spec.name} exceeds its {CANVAS_HEIGHT}px canvas")

    canvas = Image.new("RGBA", (spec.canvas_width, CANVAS_HEIGHT), (0, 0, 0, 0))
    canvas.alpha_composite(trimmed, (paste_x, paste_y))
    return canvas


def update_manifest() -> int:
    existing = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    previous_version = int(existing.pop("__version", 0) or 0)
    existing["teekae"] = FRAME_COUNTS
    existing["__version"] = previous_version + 1
    MANIFEST.write_text(json.dumps(existing, indent=2) + "\n")
    return existing["__version"]


def main() -> int:
    for source_path in (BASE_SOURCE, WALK_SOURCE):
        if not source_path.exists():
            raise FileNotFoundError(f"missing Tee Kae source sheet: {source_path}")

    base_source = Image.open(BASE_SOURCE).convert("RGB")
    walk_source = Image.open(WALK_SOURCE).convert("RGB")
    if base_source.size != BASE_EXPECTED_SIZE:
        raise ValueError(
            f"expected Tee Kae base sheet {BASE_EXPECTED_SIZE}, got {base_source.size}"
        )
    if walk_source.size != WALK_EXPECTED_SIZE:
        raise ValueError(
            f"expected Tee Kae walk sheet {WALK_EXPECTED_SIZE}, got {walk_source.size}"
        )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old_frame in OUT_DIR.glob("*.png"):
        old_frame.unlink()

    rendered: dict[str, Image.Image] = {}
    for spec in BASE_FRAME_SPECS:
        frame = render_frame(base_source, spec, edge_connected_checker)
        frame.save(OUT_DIR / f"{spec.name}.png", optimize=True)
        rendered[spec.name] = frame

    for spec in WALK_FRAME_SPECS:
        frame = render_frame(walk_source, spec, noisy_magenta_key)
        frame.save(OUT_DIR / f"{spec.name}.png", optimize=True)
        rendered[spec.name] = frame

    # The first die pose is an upright dizzy reaction and doubles as hurt.
    rendered["die_0"].save(OUT_DIR / "hurt_0.png", optimize=True)

    manifest_version = update_manifest()
    print(
        f"Tee Kae: wrote {len(rendered) + 1} RGBA frames to {OUT_DIR} "
        f"(manifest v{manifest_version})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
