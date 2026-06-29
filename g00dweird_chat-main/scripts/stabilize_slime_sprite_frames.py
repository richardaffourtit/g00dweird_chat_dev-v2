#!/usr/bin/env python3
"""Composite stable slime frames behind under-rotoscoped frames.

The source sheet has a few frames where the body was mostly removed by the
background cutout. Keeping the pose details in front but adding a neighboring
full body behind it prevents transparent flashing in animation loops.
"""
from pathlib import Path

from PIL import Image

from fix_slime_sprite_transparency import fix_frame
from smooth_slime_body_texture import smooth_all


ROOT = Path(__file__).resolve().parents[1]
SLIME_DIR = ROOT / "frontend" / "public" / "anim" / "slime"

REPAIRS = {
    "attack_2.png": "attack_1.png",
    "attack_3.png": "attack_1.png",
    "hop_1.png": "hop_0.png",
    "idle_2.png": "idle_1.png",
    "split_3.png": "split_2.png",
    "wiggle_2.png": "wiggle_1.png",
}


def composite_repair(target_name: str, donor_name: str) -> None:
    target_path = SLIME_DIR / target_name
    donor_path = SLIME_DIR / donor_name
    base = Image.open(donor_path).convert("RGBA")
    detail = Image.open(target_path).convert("RGBA")
    base.alpha_composite(detail)
    base.save(target_path)


def main() -> None:
    for target_name, donor_name in REPAIRS.items():
        composite_repair(target_name, donor_name)
        filled = fix_frame(SLIME_DIR / target_name)
        suffix = f"; filled {filled} interior pixels" if filled else ""
        print(f"repaired {target_name} with {donor_name}{suffix}")
    smooth_all()


if __name__ == "__main__":
    main()
