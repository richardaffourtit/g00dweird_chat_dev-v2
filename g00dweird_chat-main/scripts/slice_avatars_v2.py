"""
Robust avatar sprite-sheet slicer (v2).

Difference vs v1:
  - No connected-component blob detection (which split skeleton frames into head/leg).
  - Uses column-projection: per row strip, count sprite pixels per column, then find
    horizontal runs of "content columns" separated by empty (BG) columns of >= MIN_GAP.
    Each run is one frame. Y-bbox is the union of content rows in that run.
  - Removes label-glyph noise by ignoring the leftmost LABEL_PCT of the row.
  - Black outlines preserved via flood-fill from frame edge (only edge-connected
    black pixels are made transparent).
"""
import json
import os
import sys
from typing import List, Tuple

import numpy as np
from PIL import Image

SHEETS = [
    {
        "src": "/tmp/more_avatars.png",
        "header_px": 80,
        "rows": [
            ("alien",    ["idle", "walk", "run",   "jump",  "attack", "hurt", "die"]),
            ("skeleton", ["idle", "walk", "run",   "jump",  "attack", "hurt", "die"]),
            ("slime",    ["idle", "wiggle","hop",  "split", "attack", "hurt", "die"]),
            ("tvhead",   ["idle", "walk", "run",   "jump",  "attack", "hurt", "die"]),
            ("plant",    ["idle", "sway", "bite",  "spitseed", "hurt", "die"]),
            ("bat",      ["idlehang", "fly", "dive", "attack", "hurt", "die"]),
            ("boo",      ["idle", "float", "fade", "scare", "hurt", "die"]),
        ],
        "label_pct": 0.085,
        "min_gap_px": 8,
        "min_run_px": 14,
    },
]

OUT_BASE = "/app/frontend/public/anim"


def to_mask(im: Image.Image, dark_thr: int = 30) -> np.ndarray:
    arr = np.asarray(im.convert("RGB"), dtype=np.int16)
    return (arr.max(axis=2) > dark_thr)


def find_frames_in_strip(
    mask: np.ndarray,
    label_x_skip: int,
    min_gap_px: int,
    min_run_px: int,
    min_density: float = 0.02,
    col_thr_pct: float = 0.10,
) -> List[Tuple[int, int, int, int]]:
    """
    mask : 2D bool array (H,W). True = sprite content.
    Treats a column as 'active' only if at least col_thr_pct of its rows
    contain sprite content (filters thin dividers/labels).
    Returns list of (x0,y0,x1,y1) bboxes (inclusive) sorted by x0.
    """
    H, W = mask.shape
    col_counts = mask[:, label_x_skip:].sum(axis=0)
    col_thr = max(4, int(H * col_thr_pct))
    col_active = col_counts >= col_thr

    runs = []
    in_run = False
    run_start = 0
    gap_count = 0
    for i, a in enumerate(col_active):
        if a:
            if not in_run:
                in_run = True
                run_start = i
            gap_count = 0
        else:
            if in_run:
                gap_count += 1
                if gap_count >= min_gap_px:
                    end = i - gap_count
                    if end - run_start + 1 >= min_run_px:
                        runs.append((run_start, end))
                    in_run = False
                    gap_count = 0
    if in_run:
        end = len(col_active) - 1
        if end - run_start + 1 >= min_run_px:
            runs.append((run_start, end))

    # Split overly-wide runs at internal valleys (handles two-sprites-touching).
    # Re-base col_counts to the same axis as `runs` (label-skipped).
    col_counts_skipped = mask[:, label_x_skip:].sum(axis=0)
    runs = split_wide_runs_by_valley(runs, col_counts_skipped)

    boxes = []
    for cx0, cx1 in runs:
        ax0 = cx0 + label_x_skip
        ax1 = cx1 + label_x_skip
        sub = mask[:, ax0:ax1 + 1]
        ys = np.where(sub.any(axis=1))[0]
        if ys.size == 0:
            continue
        density = sub.sum() / max(1, sub.shape[0] * sub.shape[1])
        if density < min_density:
            continue
        y0, y1 = int(ys[0]), int(ys[-1])
        boxes.append((ax0, y0, ax1, y1))
    return boxes


def split_wide_runs_by_valley(runs, col_counts):
    """
    For runs much wider than the median, look for a column-density valley
    and split there. This handles two-sprites-touching-within-a-state-cell.
    """
    if not runs:
        return runs
    widths = sorted([b - a + 1 for a, b in runs])
    median = widths[len(widths) // 2]
    out = []
    for a, b in runs:
        w = b - a + 1
        if w <= median * 1.4 or w < 60:
            out.append((a, b))
            continue
        n_parts = max(2, round(w / max(median, 1)))
        sub = col_counts[a:b + 1]
        candidates = []
        for i in range(8, len(sub) - 8):
            if sub[i] <= sub[i - 1] and sub[i] <= sub[i + 1]:
                candidates.append((int(sub[i]), i))
        candidates.sort()
        cuts = sorted(c[1] for c in candidates[: n_parts - 1])
        if not cuts:
            step = w // n_parts
            cuts = [i * step for i in range(1, n_parts)]
        prev = 0
        for c in cuts + [w]:
            s = a + prev
            e = a + c - 1
            if e > s + 8:
                out.append((s, e))
            prev = c
    return out


def assign_to_states(boxes, state_names, row_w, label_pct):
    """Assign each frame bbox to a state cell by its center X."""
    n = len(state_names)
    label_w = int(row_w * label_pct)
    cell_w = (row_w - label_w) / n
    buckets = {st: [] for st in state_names}
    for b in boxes:
        cx = (b[0] + b[2]) / 2
        if cx < label_w + 2:
            continue
        idx = int((cx - label_w) // cell_w)
        if idx < 0:
            idx = 0
        if idx >= n:
            idx = n - 1
        buckets[state_names[idx]].append(b)
    for st in buckets:
        buckets[st].sort(key=lambda b: b[0])
    return buckets


def floodfill_bg_alpha(im: Image.Image, dark_thr: int = 28) -> Image.Image:
    """Make ONLY edge-connected dark pixels transparent (preserves outlines)."""
    rgba = im.convert("RGBA")
    pix = np.array(rgba)
    h_, w_ = pix.shape[:2]
    rgb_sum = pix[..., :3].sum(axis=2)
    is_dark = rgb_sum < dark_thr
    bg = np.zeros((h_, w_), dtype=bool)
    stack = []
    for x in range(w_):
        if is_dark[0, x]:
            stack.append((0, x))
        if is_dark[h_ - 1, x]:
            stack.append((h_ - 1, x))
    for y in range(h_):
        if is_dark[y, 0]:
            stack.append((y, 0))
        if is_dark[y, w_ - 1]:
            stack.append((y, w_ - 1))
    while stack:
        yy, xx = stack.pop()
        if yy < 0 or yy >= h_ or xx < 0 or xx >= w_:
            continue
        if bg[yy, xx] or not is_dark[yy, xx]:
            continue
        bg[yy, xx] = True
        stack.append((yy + 1, xx)); stack.append((yy - 1, xx))
        stack.append((yy, xx + 1)); stack.append((yy, xx - 1))
    pix[..., 3] = np.where(bg, 0, 255).astype(np.uint8)
    return Image.fromarray(pix, "RGBA")


def slice_sheet(cfg) -> dict:
    if not os.path.exists(cfg["src"]):
        print(f"!! source not found: {cfg['src']}")
        return {}
    im = Image.open(cfg["src"]).convert("RGB")
    W, H = im.size
    mask = to_mask(im)
    body_h = H - cfg["header_px"]
    n_rows = len(cfg["rows"])
    row_h = body_h // n_rows
    label_x_skip = int(W * cfg["label_pct"])
    print(f"sheet {W}x{H} body_h={body_h} row_h={row_h} label_x_skip={label_x_skip}")

    manifest = {}
    total = 0
    for ri, (creature, states) in enumerate(cfg["rows"]):
        y0 = cfg["header_px"] + ri * row_h
        y1 = cfg["header_px"] + (ri + 1) * row_h
        strip_mask = mask[y0:y1, :]
        boxes = find_frames_in_strip(
            strip_mask,
            label_x_skip=label_x_skip,
            min_gap_px=cfg["min_gap_px"],
            min_run_px=cfg["min_run_px"],
        )
        buckets = assign_to_states(boxes, states, W, cfg["label_pct"])
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
            if not blist:
                continue
            kept = 0
            for i, (bx0, by0, bx1, by1) in enumerate(blist):
                w = bx1 - bx0 + 1
                h = by1 - by0 + 1
                if w * h < 600:  # drop tiny noise blobs
                    continue
                ax0 = max(0, bx0 - 1)
                ay0 = max(0, by0 - 1) + y0
                ax1 = min(W, bx1 + 2)
                ay1 = min(H, by1 + 2) + y0
                frame = im.crop((ax0, ay0, ax1, ay1))
                # Sanity: drop if the frame is mostly transparent / too few opaque px
                frame_rgba = floodfill_bg_alpha(frame)
                opaque = int((np.array(frame_rgba)[..., 3] > 128).sum())
                if opaque < 320:
                    continue
                frame_rgba.save(os.path.join(out_dir, f"{state}_{kept}.png"))
                kept += 1
            if kept:
                cm[state] = kept
                total += kept
        manifest[creature] = cm
        print(f"  {creature}: {cm}")
    print(f"total {total} frames")
    return manifest


def main():
    out_manifest = {}
    for cfg in SHEETS:
        m = slice_sheet(cfg)
        out_manifest.update(m)
    if not out_manifest:
        return 1

    # merge with existing creatures (fairy/ape/ghost/robot/frog/cat)
    mpath = os.path.join(OUT_BASE, "manifest.json")
    if os.path.exists(mpath):
        with open(mpath, "r") as f:
            existing = json.load(f)
    else:
        existing = {}
    existing.update(out_manifest)
    # Always bump a version to bust browser cache
    existing["__version"] = (existing.get("__version", 0) or 0) + 1
    with open(mpath, "w") as f:
        json.dump(existing, f, indent=2)
    print("manifest version:", existing["__version"])
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
