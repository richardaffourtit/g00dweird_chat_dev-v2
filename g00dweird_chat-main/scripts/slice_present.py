#!/usr/bin/env python3
"""Package generated PRESENT. artwork at Tee Kae's runtime dimensions.

ImageGen authors the poses. This deterministic asset step slices, applies a
hard alpha cutoff, scales with nearest-neighbor, aligns actor pivots, and packs
the final atlas. The approved Idle head is assembled into Walk and Attack
at its original pixel scale. Source artwork remains unchanged.
"""
from __future__ import annotations
import json
import zipfile
from dataclasses import dataclass
from pathlib import Path
import numpy as np
from PIL import Image
from present_model import assemble_shared_head

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend/public"
SOURCE_DIR = PUBLIC / "source-assets/avatar"
OUT = PUBLIC / "anim/present"
ATLAS_DIR = PUBLIC / "assets/avatars/present"
HEIGHT, BASELINE = 224, 220
COUNTS = {"idle": 3, "walk": 6, "attack": 4, "hurt": 1, "die": 4,
          "emote_a": 1, "emote_b": 1, "emote_c": 1, "emote_d": 1}
WIDTHS = {"attack": 520, "hurt": 280, "die": 280}
BASE_NAME = "g00dweird_avatar_present_actions-source.png"
ATTACK_NAME = "g00dweird_avatar_present_attack-v5-source.png"
WALK_NAME = "g00dweird_avatar_present_walk-v4-source.png"

@dataclass(frozen=True)
class Spec:
    name: str
    crop: tuple[int, int, int, int]
    pivot: float
    source: str = "base"

SPECS = [
    Spec("idle_0", (65, 0, 220, 251), 138),
    Spec("idle_1", (290, 0, 450, 251), 368),
    Spec("idle_2", (525, 0, 680, 251), 600),
    Spec("walk_0", (0, 0, 361, 726), 172, "walk"),
    Spec("walk_1", (361, 0, 722, 726), 529, "walk"),
    Spec("walk_2", (722, 0, 1083, 726), 893, "walk"),
    Spec("walk_3", (1083, 0, 1444, 726), 1256, "walk"),
    Spec("walk_4", (1444, 0, 1805, 726), 1621, "walk"),
    Spec("walk_5", (1805, 0, 2167, 726), 1985, "walk"),
    Spec("emote_a_0", (20, 495, 225, 738), 136),
    Spec("emote_b_0", (255, 495, 470, 738), 368),
    Spec("emote_c_0", (485, 495, 695, 738), 597),
    Spec("emote_d_0", (705, 495, 925, 738), 817),
    Spec("attack_0", (0, 0, 450, 724), 214, "attack"),
    Spec("attack_1", (450, 0, 1035, 724), 689, "attack"),
    Spec("attack_2", (1035, 0, 1640, 724), 1252, "attack"),
    Spec("attack_3", (1640, 0, 2172, 724), 1851, "attack"),
    Spec("die_0", (25, 936, 235, 1145), 128),
    Spec("die_1", (240, 936, 475, 1145), 360),
    Spec("die_2", (480, 936, 740, 1145), 615),
    Spec("die_3", (740, 936, 995, 1145), 861),
]

def prepare(path):
    pixels = np.array(Image.open(path).convert("RGBA"))
    # Clean fringe from generated alpha; opaque sprite interiors at runtime.
    pixels[:, :, 3] = np.where(pixels[:, :, 3] >= 128, 255, 0)
    pixels[pixels[:, :, 3] == 0] = 0
    return Image.fromarray(pixels)

def update_animation_manifest():
    """Publish runtime counts, bumping the cache version only on changes."""
    path = PUBLIC / "anim/manifest.json"
    manifest = json.loads(path.read_text())
    if manifest.get("present") == COUNTS:
        return
    version = manifest.pop("__version", 0)
    manifest["present"] = COUNTS.copy()
    manifest["__version"] = version + 1
    path.write_text(json.dumps(manifest, indent=2) + "\n")

def main():
    sources = {"base": prepare(SOURCE_DIR / BASE_NAME),
               "attack": prepare(SOURCE_DIR / ATTACK_NAME),
               "walk": prepare(SOURCE_DIR / WALK_NAME)}
    if (sources["base"].size != (1374, 1145) or sources["attack"].size != (2172, 724)
            or sources["walk"].size != (2167, 726)):
        raise ValueError("Source dimensions changed; update measured crop coordinates.")
    idle = sources["base"].crop(SPECS[0].crop)
    bounds = idle.getbbox()
    # Tee Kae idle_0 has 201 pixels of visible height.
    base_scale = 201 / (bounds[3] - bounds[1])
    scales = {"base": base_scale, "attack": 201 / 564, "walk": 201 / 624}
    OUT.mkdir(parents=True, exist_ok=True)
    ATLAS_DIR.mkdir(parents=True, exist_ok=True)
    frames = {}
    for spec in SPECS:
        state = spec.name.rsplit("_", 1)[0]
        width = WIDTHS.get(state, 180)
        crop = sources[spec.source].crop(spec.crop)
        box = crop.getbbox()
        if box is None:
            raise ValueError(f"Empty frame: {spec.name}")
        scale = scales[spec.source]
        if spec.name in ("die_0", "die_1"):
            scale *= 1.15  # Match head scale in the upright/falling reaction drawings.
        trimmed = crop.crop(box)
        trimmed = trimmed.resize((round(trimmed.width * scale), round(trimmed.height * scale)),
                                 Image.Resampling.NEAREST)
        local_pivot = (spec.pivot - spec.crop[0] - box[0]) * scale
        x = round(width / 2 - local_pivot)
        y = BASELINE - trimmed.height
        if x < 0 or y < 0 or x + trimmed.width > width:
            raise ValueError(f"Clipped frame: {spec.name}, placement {(x, y)}, size {trimmed.size}")
        canvas = Image.new("RGBA", (width, HEIGHT))
        canvas.alpha_composite(trimmed, (x, y))
        frames[spec.name] = canvas
    for state, facing in (("walk", "left"), ("attack", "right")):
        for i in range(COUNTS[state]):
            name = f"{state}_{i}"
            frames[name] = assemble_shared_head(frames[name], frames["idle_0"], facing)
    frames["hurt_0"] = frames["die_0"].copy()
    expected = {f"{s}_{i}" for s, n in COUNTS.items() for i in range(n)}
    assert set(frames) == expected
    for name, frame in frames.items():
        assert frame.getbbox()[3] == BASELINE, (name, frame.getbbox())
        assert all(frame.getpixel(c)[3] == 0 for c in
                   [(0, 0), (frame.width - 1, 0), (0, HEIGHT - 1), (frame.width - 1, HEIGHT - 1)])
        frame.save(OUT / f"{name}.png", optimize=True)

    rows = [
        ("idle", [f"idle_{i}" for i in range(3)]),
        ("walk", [f"walk_{i}" for i in range(6)]),
        ("emotes", [f"emote_{s}_0" for s in "abcd"]),
        ("attack", [f"attack_{i}" for i in range(4)]),
        ("hurt", ["hurt_0"]),
        ("die", [f"die_{i}" for i in range(4)]),
    ]
    atlas = Image.new("RGBA", (2080, HEIGHT * len(rows)))
    entries, animations = {}, {}
    for row_index, (group, names) in enumerate(rows):
        x, y = 0, row_index * HEIGHT
        for name in names:
            frame = frames[name]
            atlas.alpha_composite(frame, (x, y))
            state = name.rsplit("_", 1)[0]
            entries[name] = {
                "frame": {"x": x, "y": y, "w": frame.width, "h": HEIGHT},
                "pivot": {"x": frame.width // 2, "y": BASELINE},
                "source": f"/anim/present/{name}.png",
                "opaqueBounds": list(frame.getbbox()),
            }
            animations.setdefault(state, []).append(name)
            x += frame.width
    atlas.save(ATLAS_DIR / "present-actions.png", optimize=True)
    walk_strip = Image.new("RGBA", (180 * COUNTS["walk"], HEIGHT))
    for i in range(COUNTS["walk"]):
        walk_strip.alpha_composite(frames[f"walk_{i}"], (i * 180, 0))
    walk_strip.save(ATLAS_DIR / "present-walk.png", optimize=True)
    walk_sequence = [frames[f"walk_{i}"] for i in range(COUNTS["walk"])]
    walk_sequence[0].save(ATLAS_DIR / "present-walk.webp", save_all=True,
                          append_images=walk_sequence[1:], duration=125,
                          loop=0, lossless=True)
    manifest = {
        "id": "present", "displayName": "PRESENT.", "image": "present-actions.png",
        "size": {"width": atlas.width, "height": atlas.height}, "frameCounts": COUNTS,
        "defaultFps": 8, "baselineY": BASELINE, "standingHeight": 201,
        "walkRevision": 5, "attackRevision": 5,
        "sharedHead": {"reference": "idle_0", "scale": 1, "walk": "left", "attack": "mirrored-right"},
        "walkPhases": ["near-contact", "near-support", "far-reach",
                       "far-contact", "far-support", "near-reach"],
        "nativeFacing": {"idle": "left", "walk": "left",
                         "emote_a": "left", "emote_b": "left", "emote_c": "left",
                         "emote_d": "left", "hurt": "left", "die": "left",
                         "attack": "right"},
        "alphaCutoff": 128, "resampling": "nearest",
        "sourceScales": scales, "reactionScaleMultiplier": 1.15,
        "frames": entries, "animations": animations,
    }
    (ATLAS_DIR / "present-actions.json").write_text(json.dumps(manifest, indent=2) + "\n")
    update_animation_manifest()
    with zipfile.ZipFile(ATLAS_DIR / "present-sprite-pack.zip", "w", zipfile.ZIP_DEFLATED) as pack:
        for filename in ("present-actions.png", "present-actions.json",
                         "present-walk.png", "present-walk.webp", "README.md"):
            pack.write(ATLAS_DIR / filename, filename)
        for name in sorted(frames):
            pack.write(OUT / f"{name}.png", f"frames/{name}.png")
        pack.write(SOURCE_DIR / "g00dweird_avatar_present_actions.prompt.md",
                   "generation-prompts.md")
    report = {name: {"canvas": list(f.size), "bounds": list(f.getbbox())} for name, f in frames.items()}
    print(json.dumps({"frameCount": len(frames), "sourceScales": scales,
                      "atlas": str(ATLAS_DIR / "present-actions.png"), "frames": report}, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
