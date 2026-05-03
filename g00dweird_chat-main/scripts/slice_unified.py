"""
Unified solo-sheet slicer (red BG) for all 10 g00dweird avatars.

Layout per creature is declared as a list of "rows" of (state_name, frame_count) tuples.
The slicer:
  1. Auto-detects horizontal content bands (skips title strip + dashed separators)
  2. Within each row, finds sprite blobs via column projection. If blob count matches the
     expected total, uses those; else forces an N-way valley split.
  3. Uses a UNIFORM Y-bbox per creature so all frames have the same render height
     (no clipping when frames swap).
  4. Rotoscopes red BG via edge-flood-fill (preserves outlines & pink details).
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
from PIL import Image

from repair_frog_alpha import repair_image

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_BASE = os.environ.get("GW_ANIM_OUT", str(REPO_ROOT / "frontend/public/anim"))
SOURCE_BASE = Path(
    os.environ.get(
        "GW_AVATAR_SOURCE_DIR",
        str(REPO_ROOT / "frontend/public/source-assets/avatar"),
    )
)
MANIFEST = os.path.join(OUT_BASE, "manifest.json")


def sheet_src(filename: str) -> str:
    return str(SOURCE_BASE / filename)


ALPHA_REPAIR_MAX_COMPONENT_PIXELS = {
    "frog": 460,
    "slime": 8000,
}

SHEETS: Dict[str, dict] = {
    "alien": {
        "src": sheet_src("g00dwierd_avatar_alien.png"),
        "rows": [
            [("idle", 3), ("walk", 4), ("run", 4)],
            [("jump", 3), ("attack", 5)],
            [("hurt", 2), ("die", 2)],
            [("emote_a", 1), ("emote_b", 1), ("emote_c", 1), ("emote_d", 1)],
        ],
    },
    "ape": {
        "src": sheet_src("g00dwierd_avatar_ape.png"),
        "rows": [
            [("idle", 3), ("walk", 4), ("jump", 3)],
            [("action", 4)],
            [("emote_a", 1), ("emote_b", 1), ("emote_c", 1), ("emote_d", 1)],
            [("hurt", 3), ("die", 3)],
        ],
    },
    "cat": {
        "src": sheet_src("g00dwierd_avatar_cat.png"),
        "rows": [
            [("idle", 3)],
            [("walk", 4)],
            [("jump", 3)],
            [("action", 4)],
            [("emote_a", 1), ("emote_b", 1), ("emote_c", 1), ("emote_d", 1)],
            [("hurt", 3)],
            [("die", 4)],
        ],
    },
    "fairy": {
        "src": sheet_src("g00dwierd_avatar_fairy.png"),
        "rows": [
            [("idle", 3), ("walk", 4), ("jump", 3)],
            [("action", 4)],
            [("emote_a", 1), ("emote_b", 1), ("emote_c", 1), ("emote_d", 1), ("hurt", 3)],
            [("die", 3)],
        ],
    },
    "frog": {
        "src": sheet_src("g00dwierd_avatar_frog.png"),
        "rows": [
            [("idle", 3)],
            [("hop", 4)],
            [("jump", 3)],
            [("action", 5)],
            [("emote_a", 1), ("emote_b", 1), ("emote_c", 1), ("emote_d", 1)],
            [("hurt", 3)],
            [("die", 3)],
        ],
    },
    "ghost": {
        "src": sheet_src("g00dwierd_avatar_ghost.png"),
        "rows": [
            [("idle", 3)],
            [("float", 4)],
            [("dash", 3)],
            [("action", 4)],
            [("emote_a", 1), ("emote_b", 1), ("emote_c", 1), ("emote_d", 1)],
            [("hurt", 3)],
            [("die", 4)],
        ],
    },
    "robot": {
        "src": sheet_src("g00dwierd_avatar_robot.png"),
        "rows": [
            [("idle", 3), ("walk", 4), ("jump", 3)],
            [("action", 4)],
            [("emote_a", 1), ("emote_b", 1), ("emote_c", 1), ("emote_d", 1)],
            [("hurt", 3), ("die", 3)],
        ],
    },
    "skeleton": {
        "src": sheet_src("g00dwierd_avatar_skeleton.png"),
        "rows": [
            [("idle", 3), ("walk", 4), ("run", 4)],
            [("jump", 3), ("attack", 4)],
            [("hurt", 2), ("die", 2)],
            [("emote_a", 1), ("emote_b", 1), ("emote_c", 1), ("emote_d", 1)],
        ],
    },
    "slime": {
        "src": sheet_src("g00dwierd_avatar_slime.png"),
        "rows": [
            [("idle", 3), ("wiggle", 4), ("hop", 4)],
            [("split", 5), ("attack", 5)],
            [("hurt", 2), ("die", 2)],
            [("emote_a", 1), ("emote_b", 1), ("emote_c", 1), ("emote_d", 1)],
        ],
    },
    "tvhead": {
        "src": sheet_src("g00dwierd_avatar_tv_head.png"),
        "rows": [
            [("idle", 3), ("walk", 4), ("run", 4)],
            [("jump", 3), ("attack", 5), ("hurt", 2)],
            [("die", 2), ("emote_a", 1), ("emote_b", 1), ("emote_c", 1), ("emote_d", 1)],
        ],
    },
}


def is_red_bg(rgb: np.ndarray) -> np.ndarray:
    r = rgb[..., 0]; g = rgb[..., 1]; b = rgb[..., 2]
    return (r > 130) & (g < 90) & (b < 90)


def is_edge_alpha_bg(rgb: np.ndarray) -> np.ndarray:
    r = rgb[..., 0]; g = rgb[..., 1]; b = rgb[..., 2]
    return (r > 130) & (g < 90) & (b < 90)


def floodfill_bg(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    pix = np.array(rgba)
    h_, w_ = pix.shape[:2]
    is_bg = is_edge_alpha_bg(pix[..., :3])
    bg = np.zeros((h_, w_), dtype=bool)
    stack: List[Tuple[int, int]] = []
    for x in range(w_):
        if is_bg[0, x]: stack.append((0, x))
        if is_bg[h_ - 1, x]: stack.append((h_ - 1, x))
    for y in range(h_):
        if is_bg[y, 0]: stack.append((y, 0))
        if is_bg[y, w_ - 1]: stack.append((y, w_ - 1))
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


def find_content_bands(sprite_mask: np.ndarray, min_band_h: int = 30,
                       min_gap_h: int = 14) -> List[Tuple[int, int]]:
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
                in_run = True; start = i
            gap = 0
        else:
            if in_run:
                gap += 1
                if gap >= min_gap_h:
                    end = i - gap
                    if end - start + 1 >= min_band_h:
                        bands.append((start, end))
                    in_run = False; gap = 0
    if in_run:
        end = H - 1
        if end - start + 1 >= min_band_h:
            bands.append((start, end))
    return bands


def find_blobs(strip: np.ndarray, min_gap=12, min_run=18, col_thr_pct=0.10):
    H = strip.shape[0]
    col_counts = strip.sum(axis=0)
    col_thr = max(4, int(H * col_thr_pct))
    active = col_counts >= col_thr
    runs = []
    in_run = False; s = 0; gap = 0
    for i, a in enumerate(active):
        if a:
            if not in_run:
                in_run = True; s = i
            gap = 0
        else:
            if in_run:
                gap += 1
                if gap >= min_gap:
                    e = i - gap
                    if e - s + 1 >= min_run:
                        runs.append((s, e))
                    in_run = False; gap = 0
    if in_run:
        e = len(active) - 1
        if e - s + 1 >= min_run:
            runs.append((s, e))
    return runs, col_counts


def force_n_split(row_x0: int, row_x1: int, n: int, col_counts: np.ndarray):
    w = row_x1 - row_x0 + 1
    if n <= 1: return [(row_x0, row_x1)]
    if w < n * 14: return []
    step = w / n
    target_cuts = [int(row_x0 + step * i) for i in range(1, n)]
    win = max(8, int(step * 0.18))
    cuts = []
    for tc in target_cuts:
        lo = max(row_x0 + 6, tc - win)
        hi = min(row_x1 - 6, tc + win)
        if hi <= lo:
            cuts.append(tc); continue
        seg = col_counts[lo:hi + 1]
        cuts.append(lo + int(np.argmin(seg)))
    cuts = sorted(set(cuts))
    runs = []
    prev = row_x0
    for c in cuts:
        if c > prev + 8:
            runs.append((prev, c - 1)); prev = c
    if row_x1 > prev + 8:
        runs.append((prev, row_x1))
    return runs


def label_components(mask: np.ndarray) -> Tuple[np.ndarray, int]:
    """Iterative 4-connected connected-component labelling on a boolean mask.
    Returns (labels, n_components). Background = 0; components numbered 1..n.
    """
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    n = 0
    for sy in range(h):
        for sx in range(w):
            if not mask[sy, sx] or labels[sy, sx] != 0:
                continue
            n += 1
            stack = [(sy, sx)]
            while stack:
                y, x = stack.pop()
                if y < 0 or y >= h or x < 0 or x >= w:
                    continue
                if not mask[y, x] or labels[y, x] != 0:
                    continue
                labels[y, x] = n
                stack.append((y + 1, x)); stack.append((y - 1, x))
                stack.append((y, x + 1)); stack.append((y, x - 1))
    return labels, n


def dominant_cc_bbox(cell_mask: np.ndarray, min_keep_ratio: float = 0.18,
                     max_centroid_dx_ratio: float = 0.55):
    """Within a cell mask, find the LARGEST connected component, then keep any
    additional CC whose centroid is horizontally within `max_centroid_dx_ratio
    * cell_width` of the largest one AND whose pixel count is >= `min_keep_ratio
    * largest_count`. Returns the union bbox (y0,y1,x0,x1) of kept CCs and the
    boolean mask of kept pixels (cropped to the bbox). Returns None if nothing
    kept.
    """
    H, W = cell_mask.shape
    labels, n = label_components(cell_mask)
    if n == 0:
        return None
    counts = np.bincount(labels.ravel(), minlength=n + 1)
    counts[0] = 0  # bg
    largest = int(np.argmax(counts))
    if counts[largest] < 24:
        return None
    # Centroid of largest
    ys, xs = np.where(labels == largest)
    lx = float(xs.mean())
    keep = {largest}
    thr = max_centroid_dx_ratio * W
    cnt_thr = max(12, int(counts[largest] * min_keep_ratio))
    for k in range(1, n + 1):
        if k == largest or counts[k] < cnt_thr:
            continue
        ys2, xs2 = np.where(labels == k)
        if abs(xs2.mean() - lx) <= thr:
            keep.add(k)
    keep_mask = np.isin(labels, list(keep))
    yy, xx = np.where(keep_mask)
    if yy.size == 0:
        return None
    y0, y1 = int(yy.min()), int(yy.max())
    x0, x1 = int(xx.min()), int(xx.max())
    bbox_keep = keep_mask[y0:y1 + 1, x0:x1 + 1]
    return (y0, y1, x0, x1, bbox_keep)


def filter_label_blobs(blobs, expected, sprite_mask, band_top, band_bot):
    """When too many blobs are detected, drop ones that look like row labels:
    significantly narrower OR shorter than the median sprite blob.
    Returns blobs sorted left-to-right of length == expected if filterable, else original.
    """
    if len(blobs) <= expected:
        return blobs
    # Compute width and pixel count per blob
    info = []
    for cx0, cx1 in blobs:
        sub = sprite_mask[band_top:band_bot + 1, cx0:cx1 + 1]
        w = cx1 - cx0 + 1
        cnt = int(sub.sum())
        info.append((cx0, cx1, w, cnt))
    widths = sorted(i[2] for i in info)
    counts = sorted(i[3] for i in info)
    median_w = widths[len(widths) // 2]
    median_c = counts[len(counts) // 2]
    kept = [(cx0, cx1, w, c) for cx0, cx1, w, c in info
            if w >= median_w * 0.45 and c >= median_c * 0.30]
    if len(kept) == expected:
        return [(cx0, cx1) for cx0, cx1, _, _ in sorted(kept, key=lambda x: x[0])]
    if len(kept) > expected:
        # Keep the N widest
        kept = sorted(kept, key=lambda x: -x[2])[:expected]
        return [(cx0, cx1) for cx0, cx1, _, _ in sorted(kept, key=lambda x: x[0])]
    return blobs


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

    bands = find_content_bands(sprite_mask)
    if bands:
        bands = bands[1:]
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
        print(f"  !! {creature}: detected {len(bands)} bands; falling back to even split")

    out_dir = os.path.join(OUT_BASE, creature)
    if os.path.isdir(out_dir):
        for f in os.listdir(out_dir):
            if f.endswith(".png"):
                try: os.remove(os.path.join(out_dir, f))
                except OSError: pass
    os.makedirs(out_dir, exist_ok=True)

    # Pass 1: figure out cell boundaries per row.
    row_runs: List[List[Tuple[int, int]]] = []
    for (band_top, band_bot), row_states in zip(data_bands, cfg["rows"]):
        strip = sprite_mask[band_top:band_bot + 1, :]
        col_thr = max(4, int(strip.shape[0] * 0.10))
        active = strip.sum(axis=0) >= col_thr
        if not active.any():
            row_runs.append([]); continue
        xs = np.where(active)[0]
        row_x0, row_x1 = int(xs[0]), int(xs[-1])
        total = sum(c for _, c in row_states)
        blobs, col_counts = find_blobs(strip)
        if len(blobs) > total:
            blobs = filter_label_blobs(blobs, total, sprite_mask, band_top, band_bot)
        runs = blobs if len(blobs) == total else force_n_split(row_x0, row_x1, total, col_counts)
        row_runs.append(runs)

    # Pass 2: for each cell, compute dominant-CC tight bbox dimensions so the
    # canvas size only reflects the ACTUAL sprite, not cell boundaries (which
    # may overshoot due to row labels or force-split misalignment).
    tight_dims: List[Tuple[int, int, int, int, np.ndarray, int, int]] = []  # bx0,bx1,by0,by1,kmask,band_top,_unused
    cell_cells: List[Tuple[int, int, int, int]] = []  # (band_top, band_bot, cx0, cx1) per output frame
    blob_widths: List[int] = []
    blob_heights: List[int] = []
    for (band_top, band_bot), runs in zip(data_bands, row_runs):
        for cx0, cx1 in runs:
            cell_mask = sprite_mask[band_top:band_bot + 1, cx0:cx1 + 1]
            res = dominant_cc_bbox(cell_mask)
            if res is None:
                continue
            cy0, cy1, cxr0, cxr1, kmask = res
            tight_dims.append((cx0 + cxr0, cx0 + cxr1, band_top + cy0, band_top + cy1, kmask, band_top, band_bot))
            cell_cells.append((band_top, band_bot, cx0, cx1))
            blob_widths.append(cxr1 - cxr0 + 1)
            blob_heights.append(cy1 - cy0 + 1)

    if not blob_widths:
        return {}
    canvas_w = max(blob_widths) + 6
    canvas_h = max(blob_heights) + 6
    if canvas_w % 2: canvas_w += 1
    if canvas_h % 2: canvas_h += 1

    # Pass 3: emit frames in row/state order, using the tight dominant-CC bbox.
    cm: Dict[str, int] = {}
    total_kept = 0
    tight_idx = 0
    for (band_top, band_bot), row_states, runs in zip(data_bands, cfg["rows"], row_runs):
        if not runs:
            continue
        i = 0
        for state, expected in row_states:
            kept = 0
            for _ in range(expected):
                if i >= len(runs): break
                # Walk past any cells skipped earlier (none in current pipeline,
                # but stay safe).
                while tight_idx < len(cell_cells) and cell_cells[tight_idx] != (band_top, band_bot, runs[i][0], runs[i][1]):
                    tight_idx += 1
                if tight_idx >= len(cell_cells):
                    i += 1
                    continue
                bx0, bx1, by0, by1, kmask, _bt, _bb = tight_dims[tight_idx]
                tight_idx += 1
                i += 1
                # Crop the source tightly to the dominant CC bbox, then mask out
                # any non-kept CC pixels so adjacent-cell leakage / row labels
                # are erased.
                ax0 = max(0, bx0 - 1)
                ax1 = min(W, bx1 + 2)
                ay0 = max(0, by0 - 1)
                ay1 = min(H, by1 + 2)
                if (ax1 - ax0) * (ay1 - ay0) < 600:
                    continue
                # Build padded keep-mask aligned to (ax0..ax1, ay0..ay1)
                pad_top = by0 - ay0
                pad_left = bx0 - ax0
                full_keep = np.zeros((ay1 - ay0, ax1 - ax0), dtype=bool)
                kh, kw = kmask.shape
                full_keep[pad_top:pad_top + kh, pad_left:pad_left + kw] = kmask
                tight = im.crop((ax0, ay0, ax1, ay1))
                tight_rgba = floodfill_bg(tight)
                # Erase pixels outside the kept CC cluster
                pix = np.array(tight_rgba)
                # Fairy uses red/pink/green interior detail that the coarse CC
                # mask can mistake for background. The edge flood-fill already
                # strips the red sheet safely, so preserve those interior pixels.
                if creature != "fairy":
                    pix[..., 3] = np.where(full_keep, pix[..., 3], 0)
                tight_rgba = Image.fromarray(pix, "RGBA")
                # Re-tighten to the final non-empty bbox (kept-mask removed
                # spurious pixels, which may shrink width/height slightly).
                a2 = pix[..., 3] > 128
                if int(a2.sum()) < 80:
                    continue
                ys2, xs2 = np.where(a2)
                ty0, ty1 = int(ys2.min()), int(ys2.max())
                tx0, tx1 = int(xs2.min()), int(xs2.max())
                tight_rgba = tight_rgba.crop((tx0, ty0, tx1 + 1, ty1 + 1))
                # Paste centered horizontally, bottom-aligned vertically.
                canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
                paste_x = (canvas_w - tight_rgba.width) // 2
                paste_y = canvas_h - tight_rgba.height - 2
                if paste_y < 0:
                    paste_y = 0
                canvas.paste(tight_rgba, (paste_x, paste_y), tight_rgba)
                canvas.save(os.path.join(out_dir, f"{state}_{kept}.png"))
                kept += 1
            if kept:
                cm[state] = kept; total_kept += kept
    print(f"  {creature}: {cm}  (canvas={canvas_w}x{canvas_h}, {total_kept} frames)")
    if creature in ALPHA_REPAIR_MAX_COMPONENT_PIXELS:
        repair_limit = ALPHA_REPAIR_MAX_COMPONENT_PIXELS[creature]
        repaired = sum(
            repair_image(path, max_component_pixels=repair_limit)
            for path in Path(out_dir).glob("*.png")
        )
        if repaired:
            print(f"  {creature} alpha repair: {repaired} pixels")
    return cm


def main():
    out: Dict[str, dict] = {}
    for creature, cfg in SHEETS.items():
        m = slice_creature(creature, cfg)
        if m: out[creature] = m

    if os.path.exists(MANIFEST):
        with open(MANIFEST) as f:
            existing = json.load(f)
    else:
        existing = {}
    for k, v in out.items():
        existing[k] = v
    existing["__version"] = (existing.get("__version", 0) or 0) + 1
    with open(MANIFEST, "w") as f:
        json.dump(existing, f, indent=2)
    print(f"manifest version: {existing['__version']}")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
