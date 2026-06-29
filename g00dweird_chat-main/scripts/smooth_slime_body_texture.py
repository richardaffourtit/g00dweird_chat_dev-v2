#!/usr/bin/env python3
"""Repaint slime body pixels without banding and close tiny alpha chips."""
from __future__ import annotations

from collections import deque
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


def is_sleep_symbol_color(color: tuple[int, int, int, int]) -> bool:
    r, g, b, a = color
    if a == 0:
        return False
    return b > 105 and g > 95 and r < 120


def body_bounds(body_points: set[tuple[int, int]]) -> tuple[int, int, int, int]:
    xs = [point[0] for point in body_points]
    ys = [point[1] for point in body_points]
    return min(xs), min(ys), max(xs), max(ys)


def dominant_body_color(image: Image.Image, body_points: set[tuple[int, int]]) -> tuple[float, float, float]:
    pixels = image.load()
    colors = [pixels[x, y][:3] for x, y in body_points]
    if not colors:
        return (85, 142, 22)
    return tuple(median(channel) for channel in zip(*colors))


def clamp_channel(value: float) -> int:
    return max(0, min(255, round(value)))


def target_body_color(
    base: tuple[float, float, float],
    x: int,
    y: int,
    bounds: tuple[int, int, int, int],
) -> tuple[int, int, int]:
    left, top, right, bottom = bounds
    center_x = (left + right) / 2
    half_width = max(1, (right - left) / 2)
    body_height = max(1, bottom - top)
    nx = (x - center_x) / half_width
    y_norm = (y - top) / body_height

    side_shadow = -24 * (abs(nx) ** 1.65)
    center_lift = 13 * max(0, 1 - abs(nx)) ** 1.2
    crown_lift = 9 * max(0, 1 - y_norm)
    belly_lift = 6 * max(0, 1 - ((nx * 1.3) ** 2 + ((y_norm - 0.52) * 2.0) ** 2))
    lower_shadow = -10 * max(0, y_norm - 0.68) / 0.32
    texture = (((x * 17 + y * 11) % 7) - 3) * 0.75
    shade = side_shadow + center_lift + crown_lift + belly_lift + lower_shadow + texture

    return (
        clamp_channel(base[0] + shade * 0.48),
        clamp_channel(base[1] + shade),
        clamp_channel(base[2] + shade * 0.28),
    )


def nearest_opaque_color(image: Image.Image, x: int, y: int) -> tuple[int, int, int, int]:
    pixels = image.load()
    width, height = image.size
    candidates = []
    for radius in range(1, 5):
        for ny in range(max(0, y - radius), min(height, y + radius + 1)):
            for nx in range(max(0, x - radius), min(width, x + radius + 1)):
                color = pixels[nx, ny]
                if color[3] == 0:
                    continue
                distance = (nx - x) * (nx - x) + (ny - y) * (ny - y)
                candidates.append((distance, color))
        if candidates:
            candidates.sort(key=lambda item: item[0])
            return candidates[0][1]
    return (52, 88, 13, 255)


def close_alpha_chips(image: Image.Image, min_neighbors: int = 7) -> int:
    pixels = image.load()
    width, height = image.size
    total = 0

    for _pass in range(3):
        chips = []
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                if pixels[x, y][3] != 0:
                    continue
                opaque_neighbors = 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if dx == 0 and dy == 0:
                            continue
                        if pixels[x + dx, y + dy][3] > 0:
                            opaque_neighbors += 1
                if opaque_neighbors >= min_neighbors:
                    chips.append((x, y))

        if not chips:
            break
        for x, y in chips:
            pixels[x, y] = nearest_opaque_color(image, x, y)
        total += len(chips)

    return total


def sleep_symbol_components(image: Image.Image) -> list[list[tuple[int, int]]]:
    pixels = image.load()
    width, height = image.size
    seen = set()
    components = []

    for y in range(height):
        for x in range(width):
            if (x, y) in seen or pixels[x, y][3] == 0:
                continue
            queue = deque([(x, y)])
            seen.add((x, y))
            points = []
            has_symbol = False

            while queue:
                px, py = queue.popleft()
                points.append((px, py))
                if is_sleep_symbol_color(pixels[px, py]):
                    has_symbol = True
                for nx in (px - 1, px, px + 1):
                    for ny in (py - 1, py, py + 1):
                        if nx == px and ny == py:
                            continue
                        if nx < 0 or ny < 0 or nx >= width or ny >= height:
                            continue
                        if (nx, ny) in seen or pixels[nx, ny][3] == 0:
                            continue
                        seen.add((nx, ny))
                        queue.append((nx, ny))

            if has_symbol:
                components.append(points)

    return components


def repair_sleep_pose() -> int:
    sleep_path = SLIME_DIR / "emote_d_0.png"
    donor_path = SLIME_DIR / "idle_1.png"
    sleep = Image.open(sleep_path).convert("RGBA")
    donor = Image.open(donor_path).convert("RGBA")
    repaired = donor.copy()
    sleep_pixels = sleep.load()
    repaired_pixels = repaired.load()
    changed = 0

    for component in sleep_symbol_components(sleep):
        for x, y in component:
            repaired_pixels[x, y] = sleep_pixels[x, y]
            changed += 1

    if changed:
        repaired.save(sleep_path, optimize=True)
    return changed


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

    changed = 0
    bounds = body_bounds(body_points)
    base = dominant_body_color(image, body_points)

    for x, y in body_points:
        _r, _g, _b, a = pixels[x, y]
        target_r, target_g, target_b = target_body_color(base, x, y, bounds)
        pixels[x, y] = (
            target_r,
            target_g,
            target_b,
            a,
        )
        changed += 1
    changed += close_alpha_chips(image)

    if changed:
        image.save(path, optimize=True)
        fix_frame(path)
    return changed


def smooth_all() -> int:
    total = 0
    for path in sorted(SLIME_DIR.glob("*.png")):
        if path.name == "emote_d_0.png":
            continue
        fixed = smooth_frame(path)
        total += fixed
        if fixed:
            print(f"{path.name}: smoothed {fixed} body pixels")
    sleep_symbols = repair_sleep_pose()
    if sleep_symbols:
        print(f"emote_d_0.png: rebuilt sleep pose with {sleep_symbols} symbol pixels")
    sleep_fixed = smooth_frame(SLIME_DIR / "emote_d_0.png")
    total += sleep_symbols + sleep_fixed
    if sleep_fixed:
        print(f"emote_d_0.png: smoothed {sleep_fixed} body pixels")
    print(f"smoothed {total} slime body pixels")
    return total


def main() -> None:
    smooth_all()


if __name__ == "__main__":
    main()
