#!/usr/bin/env python3
"""Generate JSON frame metadata for the thought bubble sprite sheet.

The sheet has a red matte background and labeled rows. We keep the source art
intact, detect the actual bubble pixels inside coarse slots, then store padded
frame rectangles plus text boxes so React can pick the right cloud at runtime.
"""
from __future__ import annotations

import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SHEET = ROOT / "public" / "scenery" / "thoughtbubbles.png"
OUT = ROOT / "src" / "data" / "thoughtBubbles.json"

# Coarse windows keep generation deterministic while Pillow computes clean,
# padded bounds from the art. Coordinates are source-sheet pixels.
SLOTS = [
    ("s1", "short", 1, (40, 168, 115, 240)),
    ("s2", "short", 2, (154, 148, 242, 235)),
    ("s3", "short", 3, (288, 142, 382, 232)),
    ("s4a", "short", 4, (420, 132, 525, 232)),
    ("s4b", "short", 5, (555, 118, 678, 235)),
    ("s5", "short", 6, (704, 112, 840, 246)),
    ("s6", "short", 7, (864, 96, 1025, 235)),
    ("s7", "short", 8, (1040, 86, 1228, 235)),
    ("s8", "short", 9, (1240, 72, 1498, 230)),
    ("m1", "medium", 1, (140, 356, 290, 475)),
    ("m2", "medium", 2, (285, 340, 455, 468)),
    ("m3", "medium", 3, (445, 326, 626, 468)),
    ("m4", "medium", 4, (616, 316, 825, 476)),
    ("m5", "medium", 5, (808, 300, 1042, 470)),
    ("m7", "medium", 6, (1028, 292, 1308, 465)),
    ("m8", "medium", 7, (1280, 290, 1534, 462)),
    ("l1", "long", 1, (186, 550, 462, 662)),
    ("l2", "long", 2, (448, 540, 796, 670)),
    ("l3", "long", 3, (776, 536, 1126, 672)),
    ("l4", "long", 4, (1106, 528, 1534, 675)),
    ("l5", "long", 5, (0, 704, 404, 842)),
    ("l6", "long", 6, (382, 700, 766, 848)),
    ("l7", "long", 7, (748, 704, 1094, 844)),
    ("l8", "long", 8, (1070, 700, 1536, 842)),
]

PADDING = 24


def include_pixel(r: int, g: int, b: int, a: int) -> bool:
    if a < 8:
        return False
    # Red matte/background, including dark gradients.
    if r > 95 and g < 92 and b < 92 and r > g * 1.45 and r > b * 1.45:
        return False
    # Yellow labels and guide copy should not enlarge the cloud frames.
    if r > 145 and g > 110 and b < 95:
        return False
    return True


def tight_bbox(img: Image.Image, box: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = box
    pixels = img.load()
    xs: list[int] = []
    ys: list[int] = []
    for y in range(y1, y2):
        for x in range(x1, x2):
            r, g, b, a = pixels[x, y]
            if include_pixel(r, g, b, a):
                xs.append(x)
                ys.append(y)
    if not xs:
        raise RuntimeError(f"no bubble pixels found in {box}")
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def main_body_text_box(img: Image.Image, source: dict[str, int], tier: str) -> dict[str, int]:
    crop = img.crop((source["x"], source["y"], source["x"] + source["w"], source["y"] + source["h"]))
    px = crop.load()
    row_counts = []
    for y in range(crop.height):
        count = 0
        for x in range(crop.width):
            r, g, b, a = px[x, y]
            if include_pixel(r, g, b, a):
                count += 1
        row_counts.append(count)
    max_row = max(row_counts) or 1
    threshold = max(8, max_row * 0.28)

    top = next((i for i, c in enumerate(row_counts) if c >= threshold), 0)
    bottom = top
    gap = 0
    for i in range(top, crop.height):
        if row_counts[i] >= threshold:
            bottom = i
            gap = 0
        else:
            gap += 1
            if gap > 6 and i > top + 8:
                break

    col_counts = []
    for x in range(crop.width):
        count = 0
        for y in range(top, bottom + 1):
            r, g, b, a = px[x, y]
            if include_pixel(r, g, b, a):
                count += 1
        col_counts.append(count)
    max_col = max(col_counts) or 1
    col_threshold = max(4, max_col * 0.12)
    left = next((i for i, c in enumerate(col_counts) if c >= col_threshold), 0)
    right = crop.width - 1 - next((i for i, c in enumerate(reversed(col_counts)) if c >= col_threshold), 0)

    inset_x = 0.18 if tier == "short" else 0.13 if tier == "medium" else 0.10
    inset_top = 0.22 if tier == "short" else 0.20 if tier == "medium" else 0.18
    inset_bottom = 0.27 if tier == "short" else 0.25 if tier == "medium" else 0.23
    body_w = max(1, right - left + 1)
    body_h = max(1, bottom - top + 1)
    text_x = round(left + body_w * inset_x)
    text_y = round(top + body_h * inset_top)
    text_w = round(body_w * (1 - inset_x * 2))
    text_h = round(body_h * (1 - inset_top - inset_bottom))
    return {
        "x": max(0, text_x),
        "y": max(0, text_y),
        "w": max(14, min(crop.width - text_x, text_w)),
        "h": max(12, min(crop.height - text_y, text_h)),
    }


def tail_anchor(img: Image.Image, source: dict[str, int]) -> dict[str, int]:
    crop = img.crop((source["x"], source["y"], source["x"] + source["w"], source["y"] + source["h"]))
    px = crop.load()
    weighted_x = 0
    total = 0
    y_start = round(crop.height * 0.55)
    for y in range(y_start, crop.height):
        row_weight = 1 + (y - y_start) / max(1, crop.height - y_start)
        for x in range(crop.width):
            r, g, b, a = px[x, y]
            if include_pixel(r, g, b, a):
                weighted_x += x * row_weight
                total += row_weight
    return {
        "x": round(weighted_x / total) if total else round(crop.width * 0.2),
        "y": round(crop.height * 0.88),
    }


def render_scale(tier: str) -> float:
    return {"short": 0.92, "medium": 0.82, "long": 0.76}[tier]


def font_size(tier: str, rank: int) -> int:
    if tier == "long":
        return 12
    if tier == "medium":
        return 12 if rank >= 5 else 13
    return 12 if rank >= 6 else 13


def main() -> None:
    img = Image.open(SHEET).convert("RGBA")
    variants = []
    for bubble_id, tier, rank, rough in SLOTS:
        bx1, by1, bx2, by2 = tight_bbox(img, rough)
        sx1 = max(0, bx1 - PADDING)
        sy1 = max(0, by1 - PADDING)
        sx2 = min(img.width, bx2 + PADDING)
        sy2 = min(img.height, by2 + PADDING)
        source = {"x": sx1, "y": sy1, "w": sx2 - sx1, "h": sy2 - sy1}
        text = main_body_text_box(img, source, tier)
        tail = tail_anchor(img, source)
        scale = render_scale(tier)
        variants.append({
            "id": bubble_id,
            "tier": tier,
            "rank": rank,
            "source": source,
            "render": {"scale": scale},
            "tail": tail,
            "text": text,
            "fontSize": font_size(tier, rank),
        })

    data = {
        "schema": "g00dweird.thoughtBubbles.v1",
        "generatedBy": "frontend/scripts/generate_thought_bubble_manifest.py",
        "sourceImage": "/scenery/thoughtbubbles.png",
        "sourceSize": {"w": img.width, "h": img.height},
        "padding": PADDING,
        "variants": variants,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2) + "\n")
    print(f"wrote {OUT} with {len(variants)} variants")


if __name__ == "__main__":
    main()
