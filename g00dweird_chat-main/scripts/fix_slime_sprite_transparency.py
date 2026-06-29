#!/usr/bin/env python3
"""Fill enclosed transparent interiors in the animated slime sprite frames."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SLIME_DIR = ROOT / "frontend" / "public" / "anim" / "slime"
BODY_FILL_AREA = 80


def is_slime_body_color(color: tuple[int, int, int, int]) -> bool:
    r, g, b, a = color
    if a == 0:
        return False
    if r > 190 and g > 190 and b > 185:
        return False
    return g > 45 and g >= r + 8 and g >= b + 12


def transparent_components(alpha: Image.Image) -> list[tuple[bool, list[tuple[int, int]]]]:
    width, height = alpha.size
    pixels = alpha.load()
    seen = bytearray(width * height)
    components: list[tuple[bool, list[tuple[int, int]]]] = []

    for y in range(height):
        for x in range(width):
            pos = y * width + x
            if seen[pos] or pixels[x, y] != 0:
                continue

            queue = deque([(x, y)])
            seen[pos] = 1
            touches_border = False
            points: list[tuple[int, int]] = []

            while queue:
                px, py = queue.popleft()
                points.append((px, py))
                if px == 0 or py == 0 or px == width - 1 or py == height - 1:
                    touches_border = True

                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    npos = ny * width + nx
                    if seen[npos] or pixels[nx, ny] != 0:
                        continue
                    seen[npos] = 1
                    queue.append((nx, ny))

            components.append((touches_border, points))

    return components


def nearest_color(
    image: Image.Image,
    x: int,
    y: int,
    predicate,
    fallback: tuple[int, int, int, int],
) -> tuple[int, int, int, int]:
    width, height = image.size
    pixels = image.load()

    for radius in range(1, 72):
        candidates: list[tuple[int, tuple[int, int, int, int]]] = []
        for ny in range(max(0, y - radius), min(height, y + radius + 1)):
            for nx in range(max(0, x - radius), min(width, x + radius + 1)):
                if abs(nx - x) != radius and abs(ny - y) != radius:
                    continue
                color = pixels[nx, ny]
                if predicate(color):
                    distance = (nx - x) * (nx - x) + (ny - y) * (ny - y)
                    candidates.append((distance, color))
        if candidates:
            candidates.sort(key=lambda item: item[0])
            return candidates[0][1]

    return fallback


def dominant_body_color(image: Image.Image) -> tuple[int, int, int, int]:
    body_pixels = [color for color in image.getdata() if is_slime_body_color(color)]
    if not body_pixels:
        return (70, 220, 22, 255)

    body_pixels.sort(key=lambda color: color[1], reverse=True)
    return body_pixels[len(body_pixels) // 3]


def fix_frame(path: Path) -> int:
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    pixels = image.load()
    fallback_body = dominant_body_color(image)
    fixed = 0

    for touches_border, points in transparent_components(alpha):
        if touches_border:
            continue
        fill_body = len(points) > BODY_FILL_AREA
        for x, y in points:
            if fill_body:
                color = nearest_color(image, x, y, is_slime_body_color, fallback_body)
            else:
                color = nearest_color(image, x, y, lambda candidate: candidate[3] > 0, fallback_body)
            pixels[x, y] = color
            fixed += 1

    if fixed:
        image.save(path, optimize=True)
    return fixed


def main() -> None:
    total = 0
    for path in sorted(SLIME_DIR.glob("*.png")):
        fixed = fix_frame(path)
        total += fixed
        if fixed:
            print(f"{path.name}: filled {fixed} transparent interior pixels")
    print(f"filled {total} slime sprite transparent interior pixels")


if __name__ == "__main__":
    main()
