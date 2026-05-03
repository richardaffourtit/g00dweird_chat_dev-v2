"""
Slice WeirdBot sprite sheet (1448x1086, RED bg, 6 rows × 5 frames).
Rotoscopes only red pixels (keeps pink, white, etc.).

Output: /app/frontend/public/anim/weirdbot/<state>_<n>.png
States: idle, talk, think, walk, glitch, react
"""
import os
import sys

import numpy as np
from PIL import Image

SRC = "/tmp/weirdbot.png"
OUT = "/app/frontend/public/anim/weirdbot"
STATES = ["idle", "talk", "think", "walk", "glitch", "react"]
N_FRAMES = 5

# Header strip skipped at top (title bar)
HEADER_PX = 0  # this sheet has no global header — only per-row titles

# Row label section width (left side has "IDLE" / "TALK" labels)
LABEL_PCT = 0.085


def is_red_bg(pix_rgb: np.ndarray) -> np.ndarray:
    """
    Mask of "background red" pixels: high red, low green, low blue.
    Keeps anything that's pink (high red AND high green/blue).
    """
    r = pix_rgb[..., 0]
    g = pix_rgb[..., 1]
    b = pix_rgb[..., 2]
    # red BG sample seems to be ~ #b32b2c-ish (red ~ 180, g ~40, b ~40)
    return (r > 130) & (g < 90) & (b < 90)


def floodfill_bg_alpha_red(im: Image.Image) -> Image.Image:
    """Make ONLY edge-connected red pixels transparent (preserves any pink/red details
    inside the sprite)."""
    rgba = im.convert("RGBA")
    pix = np.array(rgba)
    h_, w_ = pix.shape[:2]
    is_bg = is_red_bg(pix[..., :3])
    bg = np.zeros((h_, w_), dtype=bool)
    stack = []
    for x in range(w_):
        if is_bg[0, x]:
            stack.append((0, x))
        if is_bg[h_ - 1, x]:
            stack.append((h_ - 1, x))
    for y in range(h_):
        if is_bg[y, 0]:
            stack.append((y, 0))
        if is_bg[y, w_ - 1]:
            stack.append((y, w_ - 1))
    while stack:
        yy, xx = stack.pop()
        if yy < 0 or yy >= h_ or xx < 0 or xx >= w_:
            continue
        if bg[yy, xx] or not is_bg[yy, xx]:
            continue
        bg[yy, xx] = True
        stack.append((yy + 1, xx)); stack.append((yy - 1, xx))
        stack.append((yy, xx + 1)); stack.append((yy, xx - 1))
    pix[..., 3] = np.where(bg, 0, 255).astype(np.uint8)
    return Image.fromarray(pix, "RGBA")


def main():
    if not os.path.exists(SRC):
        print(f"!! source missing: {SRC}")
        return 1
    im = Image.open(SRC).convert("RGB")
    W, H = im.size
    arr = np.asarray(im, dtype=np.int16)
    is_bg = is_red_bg(arr)
    sprite_mask = ~is_bg  # True = keep
    label_x_skip = int(W * LABEL_PCT)

    body_h = H - HEADER_PX
    n_rows = len(STATES)
    row_h = body_h // n_rows
    print(f"sheet {W}x{H} row_h={row_h} label_x_skip={label_x_skip}")

    if os.path.isdir(OUT):
        for f in os.listdir(OUT):
            if f.endswith(".png"):
                try:
                    os.remove(os.path.join(OUT, f))
                except OSError:
                    pass
    os.makedirs(OUT, exist_ok=True)

    total = 0
    for ri, state in enumerate(STATES):
        y0 = HEADER_PX + ri * row_h
        y1 = HEADER_PX + (ri + 1) * row_h
        strip = sprite_mask[y0:y1, :]
        # column-projection
        col_counts = strip[:, label_x_skip:].sum(axis=0)
        col_thr = max(4, int(strip.shape[0] * 0.10))
        col_active = col_counts >= col_thr
        # find content runs separated by gaps >= 8
        runs = []
        in_run = False
        run_start = 0
        gap = 0
        for i, a in enumerate(col_active):
            if a:
                if not in_run:
                    in_run = True
                    run_start = i
                gap = 0
            else:
                if in_run:
                    gap += 1
                    if gap >= 8:
                        end = i - gap
                        if end - run_start + 1 >= 14:
                            runs.append((run_start, end))
                        in_run = False
                        gap = 0
        if in_run:
            end = len(col_active) - 1
            if end - run_start + 1 >= 14:
                runs.append((run_start, end))

        # Crop each run; compute Y-bbox by where strip has content within that run
        kept = 0
        for cx0, cx1 in runs:
            ax0 = cx0 + label_x_skip
            ax1 = cx1 + label_x_skip
            sub = strip[:, ax0:ax1 + 1]
            ys = np.where(sub.any(axis=1))[0]
            if ys.size == 0:
                continue
            sy0, sy1 = int(ys[0]), int(ys[-1])
            ay0 = sy0 + y0
            ay1 = sy1 + y0
            crop = im.crop((max(0, ax0 - 1), max(0, ay0 - 1), min(W, ax1 + 2), min(H, ay1 + 2)))
            rgba = floodfill_bg_alpha_red(crop)
            opaque = int((np.array(rgba)[..., 3] > 128).sum())
            if opaque < 320:
                continue
            rgba.save(os.path.join(OUT, f"{state}_{kept}.png"))
            kept += 1
        print(f"  {state}: {kept}")
        total += kept
    print(f"total {total} frames")

    # Update manifest
    import json
    mpath = "/app/frontend/public/anim/manifest.json"
    if os.path.exists(mpath):
        with open(mpath) as f:
            mani = json.load(f)
    else:
        mani = {}
    counts = {}
    for state in STATES:
        n = sum(1 for f in os.listdir(OUT) if f.startswith(state + "_"))
        if n:
            counts[state] = n
    mani["weirdbot"] = counts
    mani["__version"] = (mani.get("__version", 0) or 0) + 1
    with open(mpath, "w") as f:
        json.dump(mani, f, indent=2)
    print(f"manifest version: {mani['__version']}")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
