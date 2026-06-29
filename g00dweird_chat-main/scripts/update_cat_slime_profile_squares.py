#!/usr/bin/env python3
"""Refresh cat and slime profile-square card assets from current sprite frames."""
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ANIM_DIR = ROOT / "frontend" / "public" / "anim"
SQUARE_DIR = ROOT / "frontend" / "public" / "assets" / "avatar-cards" / "square"
SIZE = 512

SPECS = {
    "cat": {
        "frame": ANIM_DIR / "cat" / "idle_0.png",
        "output": SQUARE_DIR / "cat.png",
        "top": (99, 78, 255),
        "bottom": (27, 24, 62),
        "border": (128, 96, 255),
        "accent": (255, 68, 150),
        "subject_height": 288,
        "baseline": 394,
    },
    "slime": {
        "frame": ANIM_DIR / "slime" / "idle_0.png",
        "output": SQUARE_DIR / "slime.png",
        "top": (143, 255, 78),
        "bottom": (21, 57, 26),
        "border": (148, 255, 92),
        "accent": (255, 84, 40),
        "subject_height": 336,
        "baseline": 405,
    },
}


def gradient_background(top, bottom):
    image = Image.new("RGB", (SIZE, SIZE), top)
    pixels = image.load()
    for y in range(SIZE):
        t = y / (SIZE - 1)
        row = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
        for x in range(SIZE):
            pixels[x, y] = row
    return image.convert("RGBA")


def crop_sprite(path):
    sprite = Image.open(path).convert("RGBA")
    bbox = sprite.getchannel("A").getbbox()
    if not bbox:
        raise ValueError(f"{path} has no opaque pixels")
    x0, y0, x1, y1 = bbox
    pad = 6
    return sprite.crop((
        max(0, x0 - pad),
        max(0, y0 - pad),
        min(sprite.width, x1 + pad),
        min(sprite.height, y1 + pad),
    ))


def scaled_nearest(sprite, target_height):
    scale = target_height / sprite.height
    target_size = (round(sprite.width * scale), target_height)
    return sprite.resize(target_size, Image.Resampling.NEAREST)


def tinted_shadow(sprite, color, offset):
    shadow = Image.new("RGBA", sprite.size, color)
    shadow.putalpha(sprite.getchannel("A"))
    canvas = Image.new("RGBA", (sprite.width + abs(offset[0]) * 2, sprite.height + abs(offset[1]) * 2), (0, 0, 0, 0))
    canvas.alpha_composite(shadow, (abs(offset[0]) + offset[0], abs(offset[1]) + offset[1]))
    return canvas


def draw_frame(draw, border, accent):
    draw.rectangle((8, 8, SIZE - 9, SIZE - 9), outline=(10, 10, 16), width=8)
    draw.rectangle((18, 18, SIZE - 19, SIZE - 19), outline=border, width=4)
    draw.rectangle((25, 25, SIZE - 26, SIZE - 26), outline=tuple(max(0, c - 54) for c in border), width=2)
    draw.point((36, 36), fill=accent)
    draw.point((SIZE - 37, 36), fill=accent)


def render_square(name, spec):
    image = gradient_background(spec["top"], spec["bottom"])
    draw = ImageDraw.Draw(image)
    draw_frame(draw, spec["border"], spec["accent"])

    sprite = scaled_nearest(crop_sprite(spec["frame"]), spec["subject_height"])
    x = (SIZE - sprite.width) // 2
    y = spec["baseline"] - sprite.height

    image.alpha_composite(tinted_shadow(sprite, (0, 0, 0, 210), (10, 12)), (x - 10, y - 10))
    image.alpha_composite(tinted_shadow(sprite, (*spec["accent"], 180), (5, 5)), (x - 5, y - 5))
    image.alpha_composite(sprite, (x, y))
    image.convert("RGB").save(spec["output"])
    print(f"updated {name}: {spec['output']}")


def main():
    for name, spec in SPECS.items():
        render_square(name, spec)


if __name__ == "__main__":
    main()
