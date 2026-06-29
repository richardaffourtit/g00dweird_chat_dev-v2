#!/usr/bin/env python3
"""Extract wall.exe dingbats as transparent mask sprites."""

from __future__ import annotations

import json
from collections import deque
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHEETS_DIR = ROOT / "frontend" / "public" / "wall" / "glyph-sheets"
OUT_DIR = ROOT / "frontend" / "public" / "wall" / "glyphs"
MANIFEST_PATH = OUT_DIR / "manifest.json"

SHEETS = [
    {"id": "sheet1", "file": "wall-exe-glyphs1.png"},
    {"id": "sheet2", "file": "wall-exe-glyphs2.png"},
    {"id": "sheet3", "file": "wall-exe-glyphs3.png"},
]

COLS = 5
ROWS = 8
MAX_SPRITE_SIZE = 256
INK_THRESHOLD = 218
MIN_COMPONENT_AREA = 4
ANCHOR_COMPONENT_AREA = 120
PADDING = 12


@dataclass
class Component:
    area: int
    min_x: int
    min_y: int
    max_x: int
    max_y: int

    @property
    def cx(self) -> float:
        return (self.min_x + self.max_x) / 2

    @property
    def cy(self) -> float:
        return (self.min_y + self.max_y) / 2


def is_ink(rgb: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    return (r + g + b) / 3 < INK_THRESHOLD


def connected_components(image: Image.Image) -> list[Component]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    seen = bytearray(width * height)
    components: list[Component] = []

    for y in range(height):
        for x in range(width):
            pos = y * width + x
            if seen[pos] or not is_ink(pixels[x, y]):
                continue

            queue = deque([(x, y)])
            seen[pos] = 1
            area = 0
            min_x = max_x = x
            min_y = max_y = y

            while queue:
                qx, qy = queue.popleft()
                area += 1
                min_x = min(min_x, qx)
                max_x = max(max_x, qx)
                min_y = min(min_y, qy)
                max_y = max(max_y, qy)

                for nx in (qx - 1, qx, qx + 1):
                    for ny in (qy - 1, qy, qy + 1):
                        if nx == qx and ny == qy:
                            continue
                        if nx < 0 or ny < 0 or nx >= width or ny >= height:
                            continue
                        npos = ny * width + nx
                        if seen[npos] or not is_ink(pixels[nx, ny]):
                            continue
                        seen[npos] = 1
                        queue.append((nx, ny))

            if area >= MIN_COMPONENT_AREA:
                components.append(Component(area, min_x, min_y, max_x + 1, max_y + 1))

    return components


def slot_centers(width: int, height: int) -> list[tuple[int, int, float, float]]:
    centers = []
    for row in range(ROWS):
        for col in range(COLS):
            centers.append((
                row,
                col,
                (col + 0.5) * width / COLS,
                (row + 0.5) * height / ROWS,
            ))
    return centers


def assign_components(image: Image.Image) -> dict[tuple[int, int], list[Component]]:
    width, height = image.size
    centers = slot_centers(width, height)
    groups: dict[tuple[int, int], list[Component]] = {(row, col): [] for row in range(ROWS) for col in range(COLS)}
    cell_w = width / COLS
    cell_h = height / ROWS
    components = connected_components(image)

    def nearest_slot(component: Component) -> tuple[int, int]:
        row, col, _, _ = min(
            centers,
            key=lambda center: ((component.cx - center[2]) / cell_w) ** 2 + ((component.cy - center[3]) / cell_h) ** 2,
        )
        return row, col

    def bbox_distance(component: Component, anchor: Component) -> float:
        dx = max(anchor.min_x - component.cx, 0, component.cx - anchor.max_x)
        dy = max(anchor.min_y - component.cy, 0, component.cy - anchor.max_y)
        return (dx * dx + dy * dy) ** 0.5

    anchors = []
    for component in components:
        if component.area >= ANCHOR_COMPONENT_AREA:
            slot = nearest_slot(component)
            anchors.append((component, slot))
            groups[slot].append(component)

    for component in components:
        if component.area >= ANCHOR_COMPONENT_AREA:
            continue
        if anchors:
            anchor, slot = min(anchors, key=lambda item: bbox_distance(component, item[0]))
            if bbox_distance(component, anchor) <= max(cell_w, cell_h) * 0.42:
                groups[slot].append(component)
                continue
        groups[nearest_slot(component)].append(component)

    return groups


def alpha_from_luma(value: int) -> int:
    if value >= 248:
        return 0
    if value > INK_THRESHOLD:
        return max(0, min(80, round((248 - value) * 2.6)))
    return max(0, min(255, round((246 - value) * 1.45)))


def render_mask(source: Image.Image, components: list[Component]) -> Image.Image | None:
    if not components:
        return None

    width, height = source.size
    left = max(0, min(component.min_x for component in components) - PADDING)
    top = max(0, min(component.min_y for component in components) - PADDING)
    right = min(width, max(component.max_x for component in components) + PADDING)
    bottom = min(height, max(component.max_y for component in components) + PADDING)

    crop = source.convert("RGB").crop((left, top, right, bottom))
    gray = crop.convert("L")
    mask = Image.new("L", crop.size, 0)
    mask_pixels = mask.load()
    gray_pixels = gray.load()

    for y in range(crop.height):
        for x in range(crop.width):
            mask_pixels[x, y] = alpha_from_luma(gray_pixels[x, y])

    bbox = mask.getbbox()
    if not bbox:
        return None

    crop = crop.crop(bbox)
    mask = mask.crop(bbox)

    if crop.width > MAX_SPRITE_SIZE or crop.height > MAX_SPRITE_SIZE:
        scale = min(MAX_SPRITE_SIZE / crop.width, MAX_SPRITE_SIZE / crop.height)
        next_size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
        mask = mask.resize(next_size, Image.Resampling.LANCZOS)
        crop = crop.resize(next_size, Image.Resampling.LANCZOS)

    out = Image.new("RGBA", crop.size, (0, 0, 0, 0))
    out.putalpha(mask)
    return out


def extract() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for file in OUT_DIR.glob("wall-glyph-*.png"):
        file.unlink()

    glyphs = []
    slot_index = 1
    skipped = 0
    for sheet in SHEETS:
        source_path = SHEETS_DIR / sheet["file"]
        if not source_path.exists():
            raise FileNotFoundError(source_path)

        source = Image.open(source_path).convert("RGB")
        groups = assign_components(source)
        for row in range(ROWS):
            for col in range(COLS):
                sprite = render_mask(source, groups[(row, col)])
                glyph_id = f"wall-glyph-{slot_index:03d}"
                if sprite is None:
                    skipped += 1
                    slot_index += 1
                    continue

                file_name = f"{glyph_id}.png"
                sprite.save(OUT_DIR / file_name, optimize=True)
                glyphs.append({
                    "id": glyph_id,
                    "label": f"Dingbat {slot_index}",
                    "url": f"/wall/glyphs/{file_name}",
                    "source": f"/wall/glyph-sheets/{sheet['file']}",
                    "sheet": sheet["id"],
                    "row": row,
                    "col": col,
                    "w": sprite.width,
                    "h": sprite.height,
                    "kind": "dingbat-mask",
                })
                slot_index += 1

    manifest = {
        "schema": "g00dweird.wallGlyphs.v2",
        "generatedAt": "manual-asset-cleanup",
        "extraction": {
            "method": "nearest-slot-components-transparent-mask",
            "cols": COLS,
            "rows": ROWS,
            "maxSpriteSize": MAX_SPRITE_SIZE,
            "inkThreshold": INK_THRESHOLD,
            "skippedFragments": skipped,
        },
        "sheets": [{**sheet, "url": f"/wall/glyph-sheets/{sheet['file']}"} for sheet in SHEETS],
        "glyphs": glyphs,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"extracted {len(glyphs)} dingbat masks, skipped {skipped} fragments -> {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    extract()
