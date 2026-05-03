"""
Solo-sheet slicer (red BG) — handles per-sheet row layouts.

For each sheet we declare a list of "rows", where each row is a list of
(state_name, expected_frame_count) tuples. The slicer:

  1) Auto-detects horizontal content bands in the sheet (rows where >=5% of
     columns have sprite content), skipping the title strip (first band).
  2) For each detected band → matches it against the configured row entry.
  3) Within a row, finds sprite blobs by column projection, splits oversized
     blobs at internal density valleys, keeps a UNIFORM Y-bbox so all frames
     in that creature have the same height (no clipping when frames swap).
  4) Within a multi-state row (e.g. "idle 3 + walk 4 + jump 3"), distributes
     blobs by index (the labels themselves get filtered as too-thin).

Output: /app/frontend/public/anim/<creature>/<state>_<n>.png
"""
from __future__ import annotations

import json
import os
import sys
from typing import Dict, List, Tuple

import numpy as np
from PIL import Image

OUT_BASE = "/app/frontend/public/anim"
MANIFEST = os.path.join(OUT_BASE, "manifest.json")

SHEETS: Dict[str, dict] = {
    "fairy": {
        "src": "/tmp/g00dweird_avatar1.png",
        "rows": [
            [("idle", 3)],
            [("walk", 4)],
            [("jump", 3)],
            [("action", 4)],
            [("happy", 1), ("wonder", 1), ("excited", 1), ("cry", 1)],
        ],
    },
    "cat": {
        "src": "/tmp/g00dweird_avatar2.png",
        "rows": [
            [("idle", 3), ("walk", 4), ("jump", 3)],
            [("action", 4)],
            [("confused", 1), ("love", 1), ("sleep", 1), ("spook", 1)],
        ],
    },
    "ape": {
        "src": "/tmp/g00dweird_avatar3.png",
        "rows": [
            [("idle", 3), ("walk", 4), ("jump", 3)],
            [("action", 4)],
            [("confused", 1), ("love", 1), ("tongue", 1), ("mad", 1)],
        ],
    },
    "ghost": {
        "src": "/tmp/g00dweird_avatar4.png",
        "rows": [
            [("idle", 3)],
            [("float", 4)],
            [("dash", 3)],
            [("action", 4)],
            [("confused", 1), ("love", 1), ("excited", 1), ("sleep", 1)],
        ],
    },
    "robot": {
        "src": "/tmp/g00dweird_avatar5.png",
        "rows": [
            [("idle", 3), ("walk", 4), ("jump", 3)],
            [("action", 4)],
            [("peace", 1), ("confused", 1), ("love", 1), ("dead", 1)],
        ],
    },
    "frog": {
        "src": "/tmp/g00dweird_avatar6.png",
        "rows": [
            [("idle", 3)],
            [("hop", 4)],
            [("jump", 3)],
            [("action", 4)],
            [("happy", 1), ("sleep", 1), ("surprise", 1), ("mad", 1)],
        ],
    },
}


def is_red_bg(rgb: np.ndarray) -> np.ndarray:
    """Mask of background pixels: red BG OR yellow-green label glyphs."""
    r = rgb[..., 0]; g = rgb[..., 1]; b = rgb[..., 2]
    red = (r > 130) & (g < 90) & (b < 90)
    # Yellow-green label text (e.g. 149,214,71 / 189,248,82)
    label_green = (g > 160) & (g > r * 0.9) & (b < g * 0.6) & (r > 80)
    return red | label_green


def floodfill_red_bg(im: Image.Image) -> Image.Image:
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


def find_content_bands(sprite_mask: np.ndarray, min_band_height: int = 30,
                       min_gap_height: int = 14) -> List[Tuple[int, int]]:
    """Find horizontal bands where rows contain >= 1.5% of column-width sprite content."""
    H, W = sprite_mask.shape
    row_counts = sprite_mask.sum(axis=1)
    row_thr = max(8, int(W * 0.015))
    active = row_counts >= row_thr
    bands = []
    in_run = False
    start = 0
    gap = 0
    for i, a in enumerate(active):
        if a:
            if not in_run:
                in_run = True
                start = i
            gap = 0
        else:
            if in_run:
                gap += 1
                if gap >= min_gap_height:
                    end = i - gap
                    if end - start + 1 >= min_band_height:
                        bands.append((start, end))
                    in_run = False
                    gap = 0
    if in_run:
        end = H - 1
        if end - start + 1 >= min_band_height:
            bands.append((start, end))
    return bands


def find_blobs_in_row(strip: np.ndarray, min_gap: int = 12, min_run: int = 18,
                      col_thr_pct: float = 0.10) -> List[Tuple[int, int]]:
    """Column-projection. Returns list of (cx0, cx1) X-runs of sprite content."""
    H = strip.shape[0]
    col_counts = strip.sum(axis=0)
    col_thr = max(4, int(H * col_thr_pct))
    active = col_counts >= col_thr
    runs = []
    in_run = False
    s = 0
    gap = 0
    for i, a in enumerate(active):
        if a:
            if not in_run:
                in_run = True
                s = i
            gap = 0
        else:
            if in_run:
                gap += 1
                if gap >= min_gap:
                    e = i - gap
                    if e - s + 1 >= min_run:
                        runs.append((s, e))
                    in_run = False
                    gap = 0
    if in_run:
        e = len(active) - 1
        if e - s + 1 >= min_run:
            runs.append((s, e))
    return runs


def force_n_split(row_x0: int, row_x1: int, n: int, col_counts: np.ndarray) -> List[Tuple[int, int]]:
    """Divide [row_x0, row_x1] into exactly N cells using density valleys.

    For row_x0..row_x1 (inclusive) we look for n-1 lowest-density vertical cuts
    that split the range into N nearly-equal cells. Falls back to uniform split.
    """
    w = row_x1 - row_x0 + 1
    if n <= 1:
        return [(row_x0, row_x1)]
    if w < n * 14:
        return []
    # First, do a uniform initial guess for cell boundaries
    step = w / n
    target_cuts = [int(row_x0 + step * i) for i in range(1, n)]
    # For each target cut, search a +/- window for the local min density column
    win = max(8, int(step * 0.18))
    cuts = []
    for tc in target_cuts:
        lo = max(row_x0 + 6, tc - win)
        hi = min(row_x1 - 6, tc + win)
        if hi <= lo:
            cuts.append(tc)
            continue
        seg = col_counts[lo:hi + 1]
        offs = int(np.argmin(seg))
        cuts.append(lo + offs)
    cuts = sorted(set(cuts))
    runs = []
    prev = row_x0
    for c in cuts:
        if c > prev + 8:
            runs.append((prev, c - 1))
            prev = c
    if row_x1 > prev + 8:
        runs.append((prev, row_x1))
    return runs


def slice_creature(creature: str, cfg: dict) -> dict:
    src = cfg["src"]
    if not os.path.exists(src):
        print(f"!! missing: {src}")
        return {}
    im = Image.open(src).convert("RGB")
    W, H = im.size
    arr = np.asarray(im)
    bg_mask = is_red_bg(arr)
    sprite_mask = ~bg_mask

    # Detect bands; skip first (title), drop very-short bands (dashed separators)
    bands = find_content_bands(sprite_mask)
    if bands:
        # Skip the first band (sheet title strip)
        bands = bands[1:]
    # Drop bands that are < 50% of the median band height (filters dashed separators)
    if len(bands) >= 2:
        heights = sorted(b - a for a, b in bands)
        median_h = heights[len(heights) // 2]
        bands = [(a, b) for a, b in bands if (b - a) >= median_h * 0.5]
    n_rows = len(cfg["rows"])
    if len(bands) >= n_rows:
        data_bands = bands[:n_rows]
    else:
        body_h = H - 80
        rh = body_h // n_rows
        data_bands = [(80 + i * rh, 80 + (i + 1) * rh - 1) for i in range(n_rows)]
        print(f"!! {creature}: detected {len(bands)} bands; falling back to even split")

    out_dir = os.path.join(OUT_BASE, creature)
    if os.path.isdir(out_dir):
        for f in os.listdir(out_dir):
            if f.endswith(".png"):
                try:
                    os.remove(os.path.join(out_dir, f))
                except OSError:
                    pass
    os.makedirs(out_dir, exist_ok=True)

    # First pass: derive per-row X-bbox of sprite content, then either use
    # blob-detection (if it returns the expected count) or fall back to force-N split.
    row_blob_lists: List[List[Tuple[int, int]]] = []
    row_y_bounds: List[Tuple[int, int]] = []
    for (band_top, band_bot), row_states in zip(data_bands, cfg["rows"]):
        strip = sprite_mask[band_top:band_bot + 1, :]
        col_counts = strip.sum(axis=0)
        col_thr = max(4, int(strip.shape[0] * 0.10))
        active = col_counts >= col_thr
        if not active.any():
            row_blob_lists.append([])
            row_y_bounds.append((0, 0))
            continue
        xs = np.where(active)[0]
        row_x0, row_x1 = int(xs[0]), int(xs[-1])
        ys = np.where(strip[:, row_x0:row_x1 + 1].any(axis=1))[0]
        if ys.size == 0:
            row_blob_lists.append([])
            row_y_bounds.append((0, 0))
            continue
        sy0, sy1 = int(ys[0]), int(ys[-1])
        row_y_bounds.append((band_top + sy0, band_top + sy1))

        total_frames = sum(c for _, c in row_states)
        # Try blob-detection first
        blobs = find_blobs_in_row(strip, min_gap=12, min_run=18)
        if len(blobs) == total_frames:
            row_blob_lists.append(blobs)
            continue
        # Else: force-N split using the row's overall X-bbox (handles touching sprites)
        runs = force_n_split(row_x0, row_x1, total_frames, col_counts)
        row_blob_lists.append(runs)

    # Compute uniform output height across all rows (no clipping when frames swap)
    common_height = max((y1 - y0) for y0, y1 in row_y_bounds if y1 > y0) + 4

    cm: Dict[str, int] = {}
    total = 0
    for (band_top, band_bot), row_states, runs in zip(data_bands, cfg["rows"], row_blob_lists):
        if not runs:
            continue
        i = 0
        for state, expected in row_states:
            kept = 0
            for _ in range(expected):
                if i >= len(runs):
                    break
                cx0, cx1 = runs[i]
                i += 1
                strip = sprite_mask[band_top:band_bot + 1, cx0:cx1 + 1]
                ys = np.where(strip.any(axis=1))[0]
                if ys.size == 0:
                    continue
                blob_y0, blob_y1 = int(ys[0]), int(ys[-1])
                center = (blob_y0 + blob_y1) // 2
                target_h = common_height
                ay0 = band_top + max(0, center - target_h // 2)
                ay1 = ay0 + target_h
                if ay1 > H:
                    ay1 = H
                    ay0 = ay1 - target_h
                ax0 = max(0, cx0 - 1)
                ax1 = min(W, cx1 + 2)
                if (ax1 - ax0) * (ay1 - ay0) < 600:
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
    print(f"  {creature}: {cm}  (h={common_height}px)")
    return cm


def main():
    full_manifest: Dict[str, dict] = {}
    for creature, cfg in SHEETS.items():
        m = slice_creature(creature, cfg)
        if m:
            full_manifest[creature] = m

    # merge + bump version
    if os.path.exists(MANIFEST):
        with open(MANIFEST) as f:
            existing = json.load(f)
    else:
        existing = {}
    # preserve other creatures we didn't touch (alien/skeleton/slime/.../weirdbot)
    for k, v in full_manifest.items():
        existing[k] = v
    existing["__version"] = (existing.get("__version", 0) or 0) + 1
    with open(MANIFEST, "w") as f:
        json.dump(existing, f, indent=2)
    print(f"manifest version: {existing['__version']}")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
