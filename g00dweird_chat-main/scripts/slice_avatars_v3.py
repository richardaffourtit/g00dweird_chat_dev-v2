"""
Unified red-bg slicer for both avatar sheets (avatars 1 / avatars 2).

Strategy (fixes the per-frame Y-clipping bug):
  - For each row, compute the row's full vertical bbox of sprite content.
  - Use that SAME y0/y1 for every frame in the row → consistent height across all frames.
  - Frame X-bounds come from column-projection (≥10% of row height threshold),
    runs separated by ≥8px gaps, then valley-split for tightly touching frames.
  - Rotoscope: only edge-connected red pixels become transparent. Pink details are kept.

Sheets (both red BG, 1448×1086):
  avatars 1:  fairy / ape / ghost / robot / frog / cat  (+ idle extras row, ignored)
  avatars 2:  alien / skeleton / slime / tvhead / plant / bat / boo
"""
from __future__ import annotations

import json
import os
import sys
from typing import List, Tuple

import numpy as np
from PIL import Image

OUT_BASE = "/app/frontend/public/anim"
MANIFEST = os.path.join(OUT_BASE, "manifest.json")


def is_red_bg(rgb: np.ndarray) -> np.ndarray:
    """Mask of background-red pixels (high R, low G, low B). Pink stays."""
    r = rgb[..., 0]; g = rgb[..., 1]; b = rgb[..., 2]
    return (r > 130) & (g < 90) & (b < 90)


def floodfill_red_bg(im: Image.Image) -> Image.Image:
    """Make ONLY edge-connected red pixels transparent."""
    rgba = im.convert("RGBA")
    pix = np.array(rgba)
    h_, w_ = pix.shape[:2]
    is_bg = is_red_bg(pix[..., :3])
    bg = np.zeros((h_, w_), dtype=bool)
    stack: List[Tuple[int, int]] = []
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


def find_runs(col_active: np.ndarray, min_gap: int, min_run: int) -> List[Tuple[int, int]]:
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
                if gap >= min_gap:
                    end = i - gap
                    if end - run_start + 1 >= min_run:
                        runs.append((run_start, end))
                    in_run = False
                    gap = 0
    if in_run:
        end = len(col_active) - 1
        if end - run_start + 1 >= min_run:
            runs.append((run_start, end))
    return runs


def split_wide_runs(runs, col_counts, max_aspect=1.4):
    if not runs:
        return runs
    widths = sorted(b - a + 1 for a, b in runs)
    median = widths[len(widths) // 2]
    out = []
    for a, b in runs:
        w = b - a + 1
        if w <= median * max_aspect or w < 60:
            out.append((a, b))
            continue
        n_parts = max(2, round(w / max(median, 1)))
        sub = col_counts[a:b + 1]
        cands = []
        for i in range(8, len(sub) - 8):
            if sub[i] <= sub[i - 1] and sub[i] <= sub[i + 1]:
                cands.append((int(sub[i]), i))
        cands.sort()
        cuts = sorted(c[1] for c in cands[: n_parts - 1])
        if not cuts:
            step = w // n_parts
            cuts = [k * step for k in range(1, n_parts)]
        prev = 0
        for c in cuts + [w]:
            s = a + prev
            e = a + c - 1
            if e > s + 8:
                out.append((s, e))
            prev = c
    return out


def assign_to_states(boxes, state_names, row_w, label_pct):
    n = len(state_names)
    label_w = int(row_w * label_pct)
    cell_w = (row_w - label_w) / n
    buckets = {st: [] for st in state_names}
    for b in boxes:
        cx = (b[0] + b[2]) / 2
        if cx < label_w + 2:
            continue
        idx = int((cx - label_w) // cell_w)
        if idx < 0: idx = 0
        if idx >= n: idx = n - 1
        buckets[state_names[idx]].append(b)
    for st in buckets:
        buckets[st].sort(key=lambda b: b[0])
    return buckets


def slice_sheet(src: str, rows, *, header_px: int, body_height: int,
                label_pct: float = 0.085) -> dict:
    if not os.path.exists(src):
        print(f"!! missing: {src}")
        return {}
    im = Image.open(src).convert("RGB")
    W, H = im.size
    arr = np.asarray(im)
    bg_mask = is_red_bg(arr)
    sprite_mask = ~bg_mask

    n_rows = len(rows)
    row_h = body_height // n_rows
    label_x_skip = int(W * label_pct)
    print(f"sheet={src.split('/')[-1]} {W}x{H} body_h={body_height} row_h={row_h} label_skip={label_x_skip}")

    manifest = {}
    total = 0
    for ri, (creature, states) in enumerate(rows):
        y0 = header_px + ri * row_h
        y1 = header_px + (ri + 1) * row_h
        strip = sprite_mask[y0:y1, :]
        col_counts = strip[:, label_x_skip:].sum(axis=0)
        col_thr = max(4, int(strip.shape[0] * 0.10))
        col_active = col_counts >= col_thr
        runs = find_runs(col_active, min_gap=8, min_run=14)
        runs = split_wide_runs(runs, col_counts)

        # Convert to absolute X (add label_x_skip), compute Y bounds per frame
        boxes_per_frame = []
        for cx0, cx1 in runs:
            ax0 = cx0 + label_x_skip
            ax1 = cx1 + label_x_skip
            sub = strip[:, ax0:ax1 + 1]
            ys = np.where(sub.any(axis=1))[0]
            if ys.size == 0:
                continue
            density = sub.sum() / max(1, sub.shape[0] * sub.shape[1])
            if density < 0.02:
                continue
            sy0 = int(ys[0])
            sy1 = int(ys[-1])
            boxes_per_frame.append((ax0, sy0, ax1, sy1))

        if not boxes_per_frame:
            continue

        # *** KEY FIX: use the row's COMMON Y-bounds for every frame ***
        common_y0 = max(0, min(b[1] for b in boxes_per_frame) - 2)
        common_y1 = min(strip.shape[0] - 1, max(b[3] for b in boxes_per_frame) + 2)

        buckets = assign_to_states(boxes_per_frame, states, W, label_pct)

        out_dir = os.path.join(OUT_BASE, creature)
        if os.path.isdir(out_dir):
            for f in os.listdir(out_dir):
                if f.endswith(".png"):
                    try:
                        os.remove(os.path.join(out_dir, f))
                    except OSError:
                        pass
        os.makedirs(out_dir, exist_ok=True)

        cm = {}
        for state, blist in buckets.items():
            kept = 0
            for i, (bx0, _bsy0, bx1, _bsy1) in enumerate(blist):
                ax0 = max(0, bx0 - 1)
                ax1 = min(W, bx1 + 2)
                ay0 = common_y0 + y0
                ay1 = common_y1 + y0
                w = ax1 - ax0
                h = ay1 - ay0
                if w * h < 600:
                    continue
                frame = im.crop((ax0, ay0, ax1, ay1))
                rgba = floodfill_red_bg(frame)
                opaque = int((np.array(rgba)[..., 3] > 128).sum())
                if opaque < 320:
                    continue
                rgba.save(os.path.join(out_dir, f"{state}_{kept}.png"))
                kept += 1
            if kept:
                cm[state] = kept
                total += kept
        manifest[creature] = cm
        print(f"  {creature}: {cm}  (uniform h={common_y1 - common_y0}px)")
    print(f"-> {total} frames")
    return manifest


def main():
    sheets = [
        # avatars 1: 1448x1086, header strip ~0px, 6 main rows + 1 emote row at the bottom we ignore
        # The emote row takes ~12% of height; main 6 rows take the rest.
        # Let's compute: total H 1086, top 6 rows occupy ~85% (≈923 px), emote row ~163 px.
        ("avatars1", "/tmp/avatars1.png", [
            ("fairy",  ["idle", "walk", "jump", "action"]),
            ("ape",    ["idle", "walk", "jump", "action"]),
            ("ghost",  ["idle", "float", "dash", "action"]),
            ("robot",  ["idle", "walk", "jump", "action"]),
            ("frog",   ["idle", "hop", "jump", "action"]),
            ("cat",    ["idle", "walk", "jump", "action"]),
        ], 0, 923),
        # avatars 2: 1448x1086, 7 rows top-to-bottom
        ("avatars2", "/tmp/avatars2.png", [
            ("alien",    ["idle", "walk", "run",   "jump",  "attack", "hurt", "die"]),
            ("skeleton", ["idle", "walk", "run",   "jump",  "attack", "hurt", "die"]),
            ("slime",    ["idle", "wiggle","hop",  "split", "attack", "hurt", "die"]),
            ("tvhead",   ["idle", "walk", "run",   "jump",  "attack", "hurt", "die"]),
            ("plant",    ["idle", "sway", "bite",  "spitseed", "hurt", "die"]),
            ("bat",      ["idlehang", "fly", "dive", "attack", "hurt", "die"]),
            ("boo",      ["idle", "float", "fade", "scare", "hurt", "die"]),
        ], 80, 1006),  # 80px header for the title strip; remaining body height
    ]

    full_manifest = {}
    for name, src, rows, header, body_h in sheets:
        m = slice_sheet(src, rows, header_px=header, body_height=body_h)
        full_manifest.update(m)

    # Preserve weirdbot if present, bump version
    if os.path.exists(MANIFEST):
        with open(MANIFEST) as f:
            existing = json.load(f)
    else:
        existing = {}
    if "weirdbot" in existing:
        full_manifest["weirdbot"] = existing["weirdbot"]
    full_manifest["__version"] = (existing.get("__version", 0) or 0) + 1
    with open(MANIFEST, "w") as f:
        json.dump(full_manifest, f, indent=2)
    print(f"manifest version: {full_manifest['__version']}")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
