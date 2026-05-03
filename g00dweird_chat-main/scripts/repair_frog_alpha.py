#!/usr/bin/env python3
"""Patch small accidental transparent holes in the frog animation frames.

The unified slicer already removes the red sheet background correctly, but some
frog frames end up with small interior alpha gaps in green body regions. This
post-pass fills only transparent components that are enclosed by mostly green
opaque pixels, leaving open silhouette gaps and black/white face details alone.
"""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


def greenish(rgb: np.ndarray) -> np.ndarray:
    r = rgb[..., 0].astype(np.int16)
    g = rgb[..., 1].astype(np.int16)
    b = rgb[..., 2].astype(np.int16)
    return (g > 70) & (g >= r + 8) & (g >= b + 4)


def enclosed_transparent_components(alpha: np.ndarray) -> list[list[tuple[int, int]]]:
    visible = alpha > 0
    ys, xs = np.where(visible)
    if len(xs) == 0:
        return []

    x0, x1 = xs.min(), xs.max()
    y0, y1 = ys.min(), ys.max()
    hole_area = ~visible
    hole_area[:y0, :] = False
    hole_area[y1 + 1 :, :] = False
    hole_area[:, :x0] = False
    hole_area[:, x1 + 1 :] = False

    visited = np.zeros_like(visible, dtype=bool)
    components: list[list[tuple[int, int]]] = []

    for start_y in range(y0, y1 + 1):
        for start_x in range(x0, x1 + 1):
            if visited[start_y, start_x] or not hole_area[start_y, start_x]:
                continue

            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            visited[start_y, start_x] = True
            pixels: list[tuple[int, int]] = []
            touches_bbox_edge = False

            while queue:
                x, y = queue.popleft()
                pixels.append((x, y))
                if x in (x0, x1) or y in (y0, y1):
                    touches_bbox_edge = True

                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if nx < x0 or nx > x1 or ny < y0 or ny > y1:
                        continue
                    if visited[ny, nx] or not hole_area[ny, nx]:
                        continue
                    visited[ny, nx] = True
                    queue.append((nx, ny))

            if not touches_bbox_edge:
                components.append(pixels)

    return components


def fill_from_boundary(
    data: np.ndarray,
    alpha: np.ndarray,
    pixels: list[tuple[int, int]],
) -> int:
    pixel_set = set(pixels)
    queue: deque[tuple[int, int]] = deque()
    colors: dict[tuple[int, int], np.ndarray] = {}
    height, width = alpha.shape

    for x, y in pixels:
        neighbors: list[np.ndarray] = []
        for nx in (x - 1, x, x + 1):
            for ny in (y - 1, y, y + 1):
                if nx == x and ny == y:
                    continue
                if nx < 0 or ny < 0 or nx >= width or ny >= height:
                    continue
                if (nx, ny) in pixel_set or alpha[ny, nx] == 0:
                    continue
                neighbors.append(data[ny, nx, :3])
        if neighbors:
            colors[(x, y)] = np.mean(np.array(neighbors), axis=0).astype(np.uint8)
            queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if (nx, ny) not in pixel_set or (nx, ny) in colors:
                continue
            colors[(nx, ny)] = colors[(x, y)]
            queue.append((nx, ny))

    for x, y in pixels:
        if (x, y) not in colors:
            continue
        data[y, x, :3] = colors[(x, y)]
        data[y, x, 3] = 255
    return len(colors)


def repair_image(
    path: Path,
    dry_run: bool = False,
    mode: str = "green",
    max_component_pixels: int = 460,
) -> int:
    image = Image.open(path).convert("RGBA")
    data = np.array(image)
    alpha = data[..., 3]
    components = enclosed_transparent_components(alpha)
    repaired_pixels = 0

    for pixels in components:
        if len(pixels) > max_component_pixels:
            continue

        boundary_rgb: list[np.ndarray] = []
        green_boundary_rgb: list[np.ndarray] = []
        pixel_set = set(pixels)
        height, width = alpha.shape

        for x, y in pixels:
            for nx in (x - 1, x, x + 1):
                for ny in (y - 1, y, y + 1):
                    if nx == x and ny == y:
                        continue
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    if (nx, ny) in pixel_set or alpha[ny, nx] == 0:
                        continue
                    rgb = data[ny, nx, :3]
                    boundary_rgb.append(rgb)
                    if greenish(rgb):
                        green_boundary_rgb.append(rgb)

        if not boundary_rgb:
            continue

        if mode == "neighbor":
            repaired_pixels += fill_from_boundary(data, alpha, pixels)
            continue

        green_ratio = len(green_boundary_rgb) / len(boundary_rgb)
        if green_ratio < 0.38:
            continue

        source = np.array(green_boundary_rgb or boundary_rgb)
        fill_rgb = np.median(source, axis=0).astype(np.uint8)
        for x, y in pixels:
            data[y, x, :3] = fill_rgb
            data[y, x, 3] = 255
        repaired_pixels += len(pixels)

    if repaired_pixels and not dry_run:
        Image.fromarray(data, "RGBA").save(path)

    return repaired_pixels


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("frog_dir", type=Path, nargs="?", default=Path("frontend/public/anim/frog"))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--mode", choices=("green", "neighbor"), default="green")
    parser.add_argument("--max-component-pixels", type=int, default=460)
    args = parser.parse_args()

    total = 0
    for path in sorted(args.frog_dir.glob("*.png")):
        repaired = repair_image(
            path,
            dry_run=args.dry_run,
            mode=args.mode,
            max_component_pixels=args.max_component_pixels,
        )
        total += repaired
        if repaired:
            print(f"{path.name}: {repaired} pixels")
    print(f"total repaired pixels: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
