"""
Slice 'more avatars.png' (1536x1024 sheet of 7 creatures × multi-state frames)
into individual per-frame PNG files at /app/frontend/public/anim/<creature>/<state>_<n>.png

Sheet layout (rows, top->bottom):
  ALIEN, SKELETON, SLIME, TV_HEAD, PLANT, BAT, BOO

Each row is laid out as:
  [name label]  IDLE  WALK/SWAY/FLY/FLOAT  RUN/HOP/DIVE/FADE  JUMP/SPLIT/SCARE  ATTACK  HURT  DIE

We auto-detect non-black blobs to find frames, then assign state buckets by X-position
within each row.
"""
import os
import sys
from PIL import Image, ImageChops
import numpy as np

SRC = "/tmp/more_avatars.png"
OUT_BASE = "/app/frontend/public/anim"

# Names + state lists (indexed left -> right in their respective row).
# We DROP "die" frames (per-creature) only on request; user wants ALL animations,
# so we keep everything we can detect.
ROWS = [
    ("alien",    ["idle", "walk", "run",   "jump",  "attack", "hurt", "die"]),
    ("skeleton", ["idle", "walk", "run",   "jump",  "attack", "hurt", "die"]),
    ("slime",    ["idle", "wiggle","hop",  "split", "attack", "hurt", "die"]),
    ("tvhead",   ["idle", "walk", "run",   "jump",  "attack", "hurt", "die"]),
    ("plant",    ["idle", "sway", "bite",  "spitseed", "hurt", "die"]),
    ("bat",      ["idlehang", "fly", "dive", "attack", "hurt", "die"]),
    ("boo",      ["idle", "float", "fade", "scare", "hurt", "die"]),
]

# Header band height (skip the title strip).
HEADER_PX = 80

def load_alpha_mask(im):
    """Build a binary mask of 'sprite vs black BG' pixels using brightness threshold."""
    arr = np.asarray(im.convert("RGB"), dtype=np.int16)
    # any channel > 30 counts as sprite content
    mask = (arr.max(axis=2) > 30)
    return mask, arr

def find_blobs_in_strip(mask_strip):
    """
    Within a row strip (height H, width W), find connected blobs (4-conn).
    Return list of (x0, y0, x1, y1) bounding boxes sorted by x0.
    """
    H, W = mask_strip.shape
    visited = np.zeros_like(mask_strip, dtype=bool)
    boxes = []
    # iterative flood fill (avoid recursion depth limits)
    for sy in range(H):
        for sx in range(W):
            if not mask_strip[sy, sx] or visited[sy, sx]:
                continue
            stack = [(sy, sx)]
            x0, y0, x1, y1 = sx, sy, sx, sy
            while stack:
                y, x = stack.pop()
                if y < 0 or y >= H or x < 0 or x >= W:
                    continue
                if visited[y, x] or not mask_strip[y, x]:
                    continue
                visited[y, x] = True
                if x < x0: x0 = x
                if y < y0: y0 = y
                if x > x1: x1 = x
                if y > y1: y1 = y
                stack.append((y+1, x)); stack.append((y-1, x))
                stack.append((y, x+1)); stack.append((y, x-1))
            # Filter very small (label dots, dust)
            if (x1 - x0) >= 6 and (y1 - y0) >= 6:
                boxes.append((x0, y0, x1, y1))
    boxes.sort(key=lambda b: b[0])
    return boxes

def merge_close(boxes, max_gap=0):
    """Merge ONLY truly overlapping boxes (detached body parts), never adjacent ones."""
    if not boxes:
        return []
    merged = [list(boxes[0])]
    for x0, y0, x1, y1 in boxes[1:]:
        mx0, my0, mx1, my1 = merged[-1]
        # require strict X overlap (not just touching)
        x_overlap_pct = (min(x1, mx1) - max(x0, mx0)) / max(1, min(x1 - x0, mx1 - mx0))
        # AND require Y overlap > 50%
        y_overlap = max(0, min(y1, my1) - max(y0, my0))
        y_min_h = min(y1 - y0, my1 - my0)
        y_pct = y_overlap / max(1, y_min_h)
        if x_overlap_pct > 0.5 and y_pct > 0.5:
            merged[-1] = [min(mx0, x0), min(my0, y0), max(mx1, x1), max(my1, y1)]
        else:
            merged.append([x0, y0, x1, y1])
    return [tuple(m) for m in merged]


def split_wide_blobs(boxes, max_aspect=1.6):
    """If a single blob is suspiciously wide (likely 2 frames touching),
    split it into halves (or thirds) at internal vertical gaps."""
    out = []
    for b in boxes:
        x0, y0, x1, y1 = b
        w = x1 - x0
        h = y1 - y0
        aspect = w / max(1, h)
        if aspect <= max_aspect:
            out.append(b)
            continue
        # Try splitting into ceil(aspect) parts at evenly-spaced X cuts
        n_parts = max(2, round(aspect / 0.85))
        part_w = w / n_parts
        for i in range(n_parts):
            sx0 = int(x0 + i * part_w)
            sx1 = int(x0 + (i + 1) * part_w)
            out.append((sx0, y0, sx1, y1))
    return out

def assign_to_states(boxes, state_names, row_w):
    """
    Given sprite boxes in a row sorted left-to-right, group them into state buckets.
    Strategy: split row width evenly into N state cells, drop boxes whose centers
    fall outside any cell, then assign by cell.
    The first 'name label' column on the far left is dropped (no sprites there).
    """
    n = len(state_names)
    # Estimate cell width by row width / (n + label_factor).
    # Sheet header table shows columns are evenly spaced AFTER label.
    # Empirically: label takes ~7-9% of width.
    label_pct = 0.085
    label_w = int(row_w * label_pct)
    cell_w = (row_w - label_w) / n
    buckets = {st: [] for st in state_names}
    for b in boxes:
        cx = (b[0] + b[2]) / 2
        if cx < label_w + 2:
            continue  # skip name-label glyphs
        idx = int((cx - label_w) // cell_w)
        if idx < 0 or idx >= n:
            continue
        buckets[state_names[idx]].append(b)
    # ensure left->right order within bucket
    for st in buckets:
        buckets[st].sort(key=lambda b: b[0])
    return buckets

def main():
    im = Image.open(SRC).convert("RGB")
    W, H = im.size
    mask, arr = load_alpha_mask(im)

    # Determine 7 row Y-bounds. Skip header HEADER_PX, divide remainder.
    body_h = H - HEADER_PX
    row_h = body_h // 7
    print(f"sheet {W}x{H}, body_h={body_h}, row_h={row_h}")

    manifest = {}
    total_frames = 0
    for ri, (creature, states) in enumerate(ROWS):
        y0 = HEADER_PX + ri * row_h
        y1 = HEADER_PX + (ri + 1) * row_h
        strip_mask = mask[y0:y1, :]
        boxes = find_blobs_in_strip(strip_mask)
        boxes = merge_close(boxes)
        # Filter out ultra-thin sliver labels (label glyphs are small)
        boxes = [b for b in boxes if (b[2] - b[0]) >= 18 and (b[3] - b[1]) >= 22]
        # Split overly-wide merged blobs (touching frames)
        boxes = split_wide_blobs(boxes, max_aspect=1.6)
        boxes.sort(key=lambda b: b[0])
        buckets = assign_to_states(boxes, states, W)

        out_dir = os.path.join(OUT_BASE, creature)
        # Clear existing creature dir
        if os.path.isdir(out_dir):
            for f in os.listdir(out_dir):
                if f.endswith(".png"):
                    try:
                        os.remove(os.path.join(out_dir, f))
                    except OSError:
                        pass
        os.makedirs(out_dir, exist_ok=True)

        creature_manifest = {}
        for state, blist in buckets.items():
            if not blist:
                continue
            for i, (bx0, by0, bx1, by1) in enumerate(blist):
                # bounding box is relative to strip; convert to absolute Y
                ax0 = max(0, bx0 - 1)
                ay0 = max(0, by0 - 1) + y0
                ax1 = min(W, bx1 + 2)
                ay1 = min(H, by1 + 2) + y0
                frame = im.crop((ax0, ay0, ax1, ay1))
                # Make ONLY the background-connected black transparent.
                # Black pixels INSIDE the sprite (outlines) are connected to colored pixels
                # and must remain opaque. Use flood-fill from the frame's edge.
                rgba = frame.convert("RGBA")
                pix = np.array(rgba)
                h_, w_ = pix.shape[:2]
                rgb_sum = pix[..., :3].sum(axis=2)
                is_dark = rgb_sum < 24
                bg_mask = np.zeros((h_, w_), dtype=bool)
                # seed: every dark pixel touching the frame border
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
                    if bg_mask[yy, xx] or not is_dark[yy, xx]:
                        continue
                    bg_mask[yy, xx] = True
                    stack.append((yy + 1, xx)); stack.append((yy - 1, xx))
                    stack.append((yy, xx + 1)); stack.append((yy, xx - 1))
                alpha = np.where(bg_mask, 0, 255).astype(np.uint8)
                pix2 = pix.copy()
                pix2[..., 3] = alpha
                Image.fromarray(pix2, "RGBA").save(
                    os.path.join(out_dir, f"{state}_{i}.png")
                )
            creature_manifest[state] = len(blist)
            total_frames += len(blist)
        manifest[creature] = creature_manifest
        print(f"  {creature}: {creature_manifest}")

    # Write manifest
    import json
    with open(os.path.join(OUT_BASE, "manifest.json"), "r") as f:
        existing = json.load(f)
    existing.update(manifest)
    with open(os.path.join(OUT_BASE, "manifest.json"), "w") as f:
        json.dump(existing, f, indent=2)
    print(f"\nTotal new frames: {total_frames}")
    print("Manifest updated:", os.path.join(OUT_BASE, "manifest.json"))

if __name__ == "__main__":
    main()
