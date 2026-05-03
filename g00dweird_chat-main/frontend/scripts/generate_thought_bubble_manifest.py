#!/usr/bin/env python3
"""Generate JSON frame metadata for the thought bubble sprite sheet.

The sheet has a red matte background and labeled rows. We keep the source art
intact, detect the actual bubble pixels inside coarse slots, then store padded
frame rectangles plus text boxes so React can pick the right cloud at runtime.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import NamedTuple

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SHEET = ROOT / "public" / "scenery" / "thoughtbubbles.png"
OUT = ROOT / "src" / "data" / "thoughtBubbles.json"
OUT_ASSET_DIR = ROOT / "public" / "scenery" / "thought_bubbles"

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

PADDING = 8


class Component(NamedTuple):
    label: int
    area: int
    bbox: tuple[int, int, int, int]
    cx: float
    cy: float


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


def build_component_index(img: Image.Image) -> tuple[np.ndarray, dict[int, Component]]:
    data = np.array(img)
    r = data[..., 0]
    g = data[..., 1]
    b = data[..., 2]
    a = data[..., 3]
    red = (r > 95) & (g < 92) & (b < 92) & (r > g * 1.45) & (r > b * 1.45)
    yellow = (r > 145) & (g > 110) & (b < 95)
    mask = (a >= 8) & ~red & ~yellow
    height, width = mask.shape
    labels = np.zeros((height, width), dtype=np.int32)
    components: dict[int, Component] = {}
    label = 0

    for start_y in range(height):
        active_xs = np.where(mask[start_y] & (labels[start_y] == 0))[0]
        for start_x in active_xs:
            if labels[start_y, start_x] or not mask[start_y, start_x]:
                continue
            label += 1
            stack = [(int(start_x), int(start_y))]
            labels[start_y, start_x] = label
            xs: list[int] = []
            ys: list[int] = []

            while stack:
                x, y = stack.pop()
                xs.append(x)
                ys.append(y)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    if labels[ny, nx] or not mask[ny, nx]:
                        continue
                    labels[ny, nx] = label
                    stack.append((nx, ny))

            area = len(xs)
            components[label] = Component(
                label=label,
                area=area,
                bbox=(min(xs), min(ys), max(xs) + 1, max(ys) + 1),
                cx=sum(xs) / area,
                cy=sum(ys) / area,
            )

    return labels, components


def intersection_area(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> int:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    return max(0, min(ax2, bx2) - max(ax1, bx1)) * max(0, min(ay2, by2) - max(ay1, by1))


def select_bubble_labels(
    components: dict[int, Component],
    rough: tuple[int, int, int, int],
) -> set[int]:
    candidates = [
        component
        for component in components.values()
        if intersection_area(component.bbox, rough) > 0
    ]
    if not candidates:
        raise RuntimeError(f"no bubble pixels found in {rough}")

    main = max(candidates, key=lambda component: component.area)
    mx1, my1, mx2, my2 = main.bbox
    main_w = mx2 - mx1
    main_h = my2 - my1
    kept = {main.label}

    for component in components.values():
        if component.label == main.label:
            continue
        x1, y1, x2, _y2 = component.bbox
        if component.area < 8 or component.area > max(900, main.area * 0.22):
            continue
        # Thought dots sit below/left of the main cloud. Neighboring sprite
        # fragments touch rough-slot edges or sit too far to the side, so they
        # are intentionally rejected here.
        if component.cy < my1 + main_h * 0.45:
            continue
        if component.cy > my2 + max(48, main_h * 0.45):
            continue
        if component.cx < mx1 - 80 or component.cx > mx1 + main_w * 0.55:
            continue
        if y1 > my2 + 42:
            continue
        if x1 > mx2 + 4:
            continue
        kept.add(component.label)

    return kept


def render_clean_bubble(
    img: Image.Image,
    labels: np.ndarray,
    kept_labels: set[int],
) -> tuple[Image.Image, dict[str, int]]:
    keep_mask = np.isin(labels, list(kept_labels))
    ys, xs = np.where(keep_mask)
    if len(xs) == 0:
        raise RuntimeError("selected bubble contains no pixels")

    x1 = max(0, int(xs.min()) - PADDING)
    y1 = max(0, int(ys.min()) - PADDING)
    x2 = min(img.width, int(xs.max()) + 1 + PADDING)
    y2 = min(img.height, int(ys.max()) + 1 + PADDING)
    data = np.array(img.crop((x1, y1, x2, y2)).convert("RGBA"))
    data[..., 3] = np.where(keep_mask[y1:y2, x1:x2], 255, 0).astype(np.uint8)
    return Image.fromarray(data, "RGBA"), {"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1}


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
    labels, components = build_component_index(img)
    variants = []
    OUT_ASSET_DIR.mkdir(parents=True, exist_ok=True)
    for bubble_id, tier, rank, rough in SLOTS:
        kept_labels = select_bubble_labels(components, rough)
        clean_bubble, source = render_clean_bubble(img, labels, kept_labels)
        clean_bubble.save(OUT_ASSET_DIR / f"{bubble_id}.png")
        text = main_body_text_box(clean_bubble, {"x": 0, "y": 0, "w": clean_bubble.width, "h": clean_bubble.height}, tier)
        tail = tail_anchor(clean_bubble, {"x": 0, "y": 0, "w": clean_bubble.width, "h": clean_bubble.height})
        scale = render_scale(tier)
        variants.append({
            "id": bubble_id,
            "tier": tier,
            "rank": rank,
            "image": f"/scenery/thought_bubbles/{bubble_id}.png",
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
