#!/usr/bin/env python3
"""Pad sprite frames so non-transparent pixels never touch the image border."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Tuple

from PIL import Image


@dataclass
class EdgePadding:
    left: int
    right: int
    top: int
    bottom: int


def edge_alpha_counts(image: Image.Image) -> Tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    pix = alpha.load()
    w, h = image.size
    left = sum(1 for y in range(h) if pix[0, y] != 0)
    right = sum(1 for y in range(h) if pix[w - 1, y] != 0)
    top = sum(1 for x in range(w) if pix[x, 0] != 0)
    bottom = sum(1 for x in range(w) if pix[x, h - 1] != 0)
    return left, right, top, bottom


def scan_sprite(path: Path) -> Tuple[Tuple[int, int, int, int], bool]:
    image = Image.open(path).convert("RGBA")
    edges = edge_alpha_counts(image)
    return edges, any(v > 0 for v in edges)


def pad_sprite(path: Path, pad: int = 1, dry_run: bool = False) -> EdgePadding | None:
    image = Image.open(path).convert("RGBA")
    edges = edge_alpha_counts(image)
    needs_pad = EdgePadding(
        left=pad if edges[0] else 0,
        right=pad if edges[1] else 0,
        top=pad if edges[2] else 0,
        bottom=pad if edges[3] else 0,
    )
    if not any([needs_pad.left, needs_pad.right, needs_pad.top, needs_pad.bottom]):
        return None

    out = Image.new(
        "RGBA",
        (image.width + needs_pad.left + needs_pad.right, image.height + needs_pad.top + needs_pad.bottom),
        (0, 0, 0, 0),
    )
    out.paste(image, (needs_pad.left, needs_pad.top))
    if not dry_run:
        out.save(path)
    return needs_pad


def walk_pngs(root: Path, recursive: bool) -> Iterable[Path]:
    pattern = "**/*.png" if recursive else "*.png"
    for item in sorted(root.glob(pattern)):
        if item.is_file():
            yield item


def main() -> None:
    parser = argparse.ArgumentParser(description="Pad non-transparent sprite edges with transparent pixels.")
    parser.add_argument("--dir", required=True, help="Directory containing PNG sprites to scan/pad.")
    parser.add_argument("--recursive", action="store_true", help="Recursively scan PNG files under the directory.")
    parser.add_argument("--pad", type=int, default=1, help="Pixels to add to any side that currently touches content.")
    parser.add_argument("--dry-run", action="store_true", help="Report needed changes without writing files.")
    parser.add_argument(
        "--fail-on-crop",
        action="store_true",
        help="Exit non-zero if any frames currently touch image edges.",
    )
    args = parser.parse_args()

    root = Path(args.dir)
    if not root.exists():
        raise SystemExit(f"missing directory: {root}")

    bad: list[tuple[Path, Tuple[int, int, int, int]]] = []
    total = 0

    for path in walk_pngs(root, recursive=args.recursive):
        total += 1
        edges, bad_edges = scan_sprite(path)
        if bad_edges:
            bad.append((path, edges))
            pad_sprite(path, pad=args.pad, dry_run=args.dry_run)

    print(f"scanned {total} png files in {root}")
    if bad:
        print(f"candidates needing transparent edge expansion: {len(bad)}")
        for path, edges in bad:
            print(f"  {path.name}: edges-left-right-top-bottom={edges}")
    else:
        print("all files already have transparent pixel borders.")

    if args.fail_on_crop and bad:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
