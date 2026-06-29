#!/usr/bin/env python3
"""Remove hard vertical column bands from slime sprite body pixels."""
from __future__ import annotations

from pathlib import Path
from statistics import median

from PIL import Image

from fix_slime_sprite_transparency import fix_frame


ROOT = Path(__file__).resolve().parents[1]
SLIME_DIR = ROOT / "frontend" / "public" / "anim" / "slime"


def is_slime_body_color(color: tuple[int, int, int, int]) -> bool:
    r, g, b, a = color
    if a == 0:
        return False
    if r > 190 and g > 190 and b > 185:
        return False
    return g > 28 and g >= r + 2 and g >= b + 6


def is_near_transparency(alpha, x: int, y: int, radius: int = 2) -> bool:
    width, height = alpha.size
    for ny in range(max(0, y - radius), min(height, y + radius + 1)):
        for nx in range(max(0, x - radius), min(width, x + radius + 1)):
            if alpha.getpixel((nx, ny)) == 0:
                return True
    return False


def body_bounds(body_points: set[tuple[int, int]]) -> tuple[int, int, int, int]:
    xs = [point[0] for point in body_points]
    ys = [point[1] for point in body_points]
    return min(xs), min(ys), max(xs), max(ys)


def body_row_medians(image: Image.Image, body_points: set[tuple[int, int]]) -> dict[int, tuple[float, float, float]]:
    pixels = image.load()
    rows: dict[int, list[tuple[int, int, int]]] = {}
    for x, y in body_points:
        r, g, b, _a = pixels[x, y]
        rows.setdefault(y, []).append((r, g, b))

    medians = {}
    for y, colors in rows.items():
        if len(colors) < 4:
            continue
        medians[y] = tuple(median(channel) for channel in zip(*colors))
    return medians


def smooth_row_target(
    medians: dict[int, tuple[float, float, float]],
    y: int,
    radius: int = 4,
) -> tuple[float, float, float] | None:
    neighbors = [medians[ny] for ny in range(y - radius, y + radius + 1) if ny in medians]
    if len(neighbors) < 2:
        return None
    return tuple(median(channel) for channel in zip(*neighbors))


def clamp_channel(value: float) -> int:
    return max(0, min(255, round(value)))


def smooth_frame(path: Path) -> int:
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    pixels = image.load()
    width, height = image.size
    body_points = {
        (x, y)
        for y in range(height)
        for x in range(width)
        if is_slime_body_color(pixels[x, y]) and not is_near_transparency(alpha, x, y, radius=1)
    }
    if not body_points:
        return 0

    left, top, right, bottom = body_bounds(body_points)
    center_x = (left + right) / 2
    half_width = max(1, (right - left) / 2)
    body_height = max(1, bottom - top)
    changed = 0
    row_medians = body_row_medians(image, body_points)

    for x, y in body_points:
        target = smooth_row_target(row_medians, y)
        if not target:
            continue
        r, g, b, a = pixels[x, y]
        y_norm = (y - top) / body_height
        edge_norm = min(1, abs(x - center_x) / half_width)
        edge_shadow = -18 * (edge_norm ** 1.65)
        top_light = 9 * (1 - y_norm)
        bottom_weight = -7 * y_norm
        light = edge_shadow + top_light + bottom_weight
        target_r = target[0] + light * 0.55
        target_g = target[1] + light
        target_b = target[2] + light * 0.35
        pixels[x, y] = (
            clamp_channel((target_r * 0.98) + (r * 0.02)),
            clamp_channel((target_g * 0.98) + (g * 0.02)),
            clamp_channel((target_b * 0.98) + (b * 0.02)),
            a,
        )
        changed += 1

    if changed:
        image.save(path, optimize=True)
        fix_frame(path)
    return changed


def smooth_all() -> int:
    total = 0
    for path in sorted(SLIME_DIR.glob("*.png")):
        fixed = smooth_frame(path)
        total += fixed
        if fixed:
            print(f"{path.name}: smoothed {fixed} body pixels")
    print(f"smoothed {total} slime body pixels")
    return total


def main() -> None:
    smooth_all()


if __name__ == "__main__":
    main()
