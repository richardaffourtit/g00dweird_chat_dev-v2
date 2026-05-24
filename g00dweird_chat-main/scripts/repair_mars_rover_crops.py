#!/usr/bin/env python3
"""Repair internally cropped Mars rover animation frames.

These frames already have transparent padding around their canvases, so an
edge-alpha audit can pass even when generated art inside the frame is missing.
This script composites intact neighboring-frame regions into the damaged spots.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, Tuple

from PIL import Image


MARS_ROVER_DIR = Path("frontend/public/assets/mars-rover")
Region = Tuple[int, int, int, int]
Patch = Tuple[str, str, Region]

PATCHES: tuple[Patch, ...] = (
    ("back_2.png", "back_1.png", (58, 128, 184, 248)),
    ("back_3.png", "back_1.png", (58, 128, 184, 248)),
    ("front_2.png", "front_0.png", (104, 180, 207, 315)),
    ("front_3.png", "front_0.png", (104, 180, 207, 315)),
    ("left_1.png", "left_0.png", (54, 162, 176, 286)),
    ("left_2.png", "left_0.png", (54, 162, 176, 286)),
    ("left_3.png", "left_0.png", (54, 162, 176, 286)),
    ("right_3.png", "right_2.png", (70, 220, 185, 315)),
)


def alpha_pixels(image: Image.Image) -> int:
    alpha = image.getchannel("A")
    data = alpha.get_flattened_data() if hasattr(alpha, "get_flattened_data") else alpha.getdata()
    return sum(1 for value in data if value > 0)


def repair_frames(image_dir: Path, patches: Iterable[Patch] = PATCHES, dry_run: bool = False) -> int:
    if not image_dir.exists():
        raise FileNotFoundError(f"Missing Mars rover directory: {image_dir}")

    changed = 0
    for target_name, source_name, box in patches:
        target_path = image_dir / target_name
        source_path = image_dir / source_name
        if not target_path.exists():
            raise FileNotFoundError(f"Missing target frame: {target_path}")
        if not source_path.exists():
            raise FileNotFoundError(f"Missing source frame: {source_path}")

        with Image.open(target_path).convert("RGBA") as target, Image.open(source_path).convert("RGBA") as source:
            before = alpha_pixels(target.crop(box))
            crop = source.crop(box)
            repaired = target.copy()
            repaired.alpha_composite(crop, dest=box[:2])
            after = alpha_pixels(repaired.crop(box))

        print(f"{target_name}: repaired region {box}, alpha {before} -> {after}")
        if not dry_run:
            repaired.save(target_path)
        changed += 1

    return changed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Repair internally cropped Mars rover sprite frames.")
    parser.add_argument("--dir", default=str(MARS_ROVER_DIR), help="Directory containing Mars rover PNG frames.")
    parser.add_argument("--dry-run", action="store_true", help="Report patches without writing images.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    count = repair_frames(Path(args.dir), dry_run=args.dry_run)
    print(f"{'would repair' if args.dry_run else 'repaired'} {count} Mars rover frames")
