#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image

MARS_ROVER_DIR = Path("frontend/public/assets/mars-rover")
MARS_ROVER_PADDING_PX = 12


def pad_pngs(image_dir: Path, pad_px: int = MARS_ROVER_PADDING_PX, dry_run: bool = False) -> int:
    if not image_dir.exists():
        raise FileNotFoundError(f"Missing Mars rover assets: {image_dir}")

    files = sorted(image_dir.glob("*.png"))
    if not files:
        raise RuntimeError(f"No PNGs found in {image_dir}")

    for path in files:
        if pad_px <= 0:
            continue
        with Image.open(path).convert("RGBA") as im:
            new_w = im.width + (pad_px * 2)
            new_h = im.height + (pad_px * 2)
            out = Image.new("RGBA", (new_w, new_h), (0, 0, 0, 0))
            out.paste(im, (pad_px, pad_px))
        if not dry_run:
            out.save(path)

    if dry_run:
        print(f"dry-run: would pad {len(files)} files by {pad_px}px")
    else:
        print(f"padded {len(files)} rover PNGs by {pad_px}px in {image_dir}")

    return len(files)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Pad Mars rover sprites with transparent border to prevent visual clipping.")
    parser.add_argument("--dir", default=str(MARS_ROVER_DIR), help="Directory containing rover PNG files")
    parser.add_argument("--pad", type=int, default=MARS_ROVER_PADDING_PX, help="Padding to add to each side")
    parser.add_argument("--dry-run", action="store_true", help="List files and target padding without saving")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    pad_pngs(Path(args.dir), pad_px=args.pad, dry_run=args.dry_run)
