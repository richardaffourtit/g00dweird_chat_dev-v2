#!/usr/bin/env python3
"""Fill tiny enclosed transparent pinholes in the animated cat sprite frames."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CAT_DIR = ROOT / "frontend" / "public" / "anim" / "cat"
MAX_PINHOLE_AREA = 80


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


def nearest_opaque_color(image: Image.Image, x: int, y: int) -> tuple[int, int, int, int]:
    width, height = image.size
    pixels = image.load()

    for radius in range(1, 12):
        candidates: list[tuple[int, int, int, int]] = []
        for ny in range(max(0, y - radius), min(height, y + radius + 1)):
            for nx in range(max(0, x - radius), min(width, x + radius + 1)):
                if abs(nx - x) != radius and abs(ny - y) != radius:
                    continue
                color = pixels[nx, ny]
                if color[3] > 0:
                    candidates.append(color)
        if candidates:
            candidates.sort(key=lambda color: color[3], reverse=True)
            return candidates[0]

    return (0, 0, 0, 255)


def fix_frame(path: Path) -> int:
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    pixels = image.load()
    fixed = 0

    for touches_border, points in transparent_components(alpha):
        if touches_border or len(points) > MAX_PINHOLE_AREA:
            continue
        for x, y in points:
            pixels[x, y] = nearest_opaque_color(image, x, y)
            fixed += 1

    if fixed:
        image.save(path, optimize=True)
    return fixed


def main() -> None:
    total = 0
    for path in sorted(CAT_DIR.glob("*.png")):
        fixed = fix_frame(path)
        total += fixed
        if fixed:
            print(f"{path.name}: filled {fixed} transparent pinhole pixels")
    print(f"filled {total} cat sprite pinhole pixels")


if __name__ == "__main__":
    main()
