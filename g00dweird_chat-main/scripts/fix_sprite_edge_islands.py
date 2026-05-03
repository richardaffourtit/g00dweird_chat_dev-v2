#!/usr/bin/env python3
"""Pillow-based cleanup for tiny extraction islands on sprite PNG exports.

This script is intended for red-chroma keyed assets where a few leftover red pixels
remain after runtime/background extraction. It removes small connected components of
background-like colors and writes cleaned PNGs in-place.
"""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clear tiny edge islands in PNG sprite assets.")
    parser.add_argument("path", help="Directory containing sprite PNG files.")
    parser.add_argument(
        "--max-component",
        type=int,
        default=8,
        help="Maximum connected-component size to remove (in pixels).",
    )
    parser.add_argument(
        "--prefix",
        default="",
        help="Only process files with this filename prefix.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report removals without writing files.",
    )
    return parser.parse_args()


def clear_small_islands(image_rgba: np.ndarray, max_component: int) -> int:
    rgb = image_rgba[..., :3]
    alpha = image_rgba[..., 3]
    # Red-like fragments that often remain after imperfect edge-keying:
    # high red, muted green/blue, and visibly red compared to the other channels.
    suspect = (
        (alpha > 0)
        & (rgb[..., 0] > 140)
        & (rgb[..., 1] < 120)
        & (rgb[..., 2] < 120)
        & ((rgb[..., 0] - rgb[..., 1]) > 80)
    )

    h, w = alpha.shape
    seen = np.zeros((h, w), dtype=bool)
    removed = 0

    for y in range(h):
        for x in range(w):
            if not suspect[y, x] or seen[y, x]:
                continue

            queue = deque([(y, x)])
            seen[y, x] = True
            component = [(y, x)]

            while queue:
                cy, cx = queue.popleft()
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and suspect[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
                        component.append((ny, nx))

            if len(component) <= max_component:
                for cy, cx in component:
                    image_rgba[cy, cx, 3] = 0
                    removed += 1

    return removed


def main() -> int:
    args = parse_args()
    path = Path(args.path)
    files = sorted(
        path.glob(f"{args.prefix}*.png")
        if args.prefix
        else path.glob("*.png")
    )
    if not files:
        raise SystemExit(f"No PNG files found in {path}")

    total_removed = 0
    changed = 0
    for p in files:
        arr = np.array(Image.open(p).convert("RGBA"))
        removed = clear_small_islands(arr, args.max_component)
        if removed:
            changed += 1
            total_removed += removed
            print(f"{p.name}: removed {removed} tiny pixels")
            if not args.dry_run:
                Image.fromarray(arr, "RGBA").save(p)
    print(f"Processed {len(files)} files, changed={changed}, total_removed={total_removed}, dry_run={args.dry_run}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
