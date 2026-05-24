#!/usr/bin/env python3
"""Pad walk-cycle sprite frames with transparent margins (no clipping) using Pillow."""

from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image


def pad_walk_frames(directory: Path, creature: str, pad_x: int = 0, pad_y: int = 0, dry_run: bool = False) -> int:
    walk_dir = directory / creature
    if not walk_dir.exists():
        raise FileNotFoundError(f"Missing sprite directory: {walk_dir}")

    files = sorted(walk_dir.glob("walk_*.png"))
    if not files:
        print(f"No walk_*.png files found in {walk_dir}");
        return 0

    for path in files:
        with Image.open(path).convert("RGBA") as img:
            if pad_x == 0 and pad_y == 0:
                continue
            out = Image.new("RGBA", (img.width + pad_x * 2, img.height + pad_y * 2), (0, 0, 0, 0))
            out.paste(img, (pad_x, pad_y))
        if not dry_run:
            out.save(path)
        print(f"{path.name} -> {out.size[0]}x{out.size[1] if not dry_run else img.height + pad_y * 2}")

    if dry_run:
        print(f"dry-run: would pad {len(files)} walk frames for {creature} in {walk_dir}")
    else:
        print(f"Padded {len(files)} walk frames for {creature} in {walk_dir}")
    return len(files)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Pad walk_*.png sprite frames with transparent border.")
    parser.add_argument("--dir", default="frontend/public/anim", help="Root animation directory")
    parser.add_argument("--creature", default="weirdbot", help="Creature folder name")
    parser.add_argument("--pad-x", type=int, default=0, help="Pixels to pad on both left/right sides")
    parser.add_argument("--pad-y", type=int, default=0, help="Pixels to pad on both top/bottom sides")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing files")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    return pad_walk_frames(Path(args.dir), args.creature, pad_x=args.pad_x, pad_y=args.pad_y, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())

