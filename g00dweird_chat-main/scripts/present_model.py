"""Register generated pose bodies to the approved Idle head component.

This is the final sprite assembly stage. The canonical head is reused at 1:1
pixel scale, with a horizontal flip for right-facing poses, so a generation
revision cannot redraw Tom's facial features between movement and attack.
"""
from __future__ import annotations
import numpy as np
from PIL import Image

# Head-only area: keep shoulders, arms, torso and effects from the pose source.
HEAD_TOP, HEAD_BOTTOM = 0, 100
HEAD_LEFT, HEAD_RIGHT = 44, 137
UNOBSTRUCTED_HEAD_BOTTOM = 77

def head_mask(pixels):
    mask = np.zeros(pixels.shape[:2], dtype=bool)
    mask[:UNOBSTRUCTED_HEAD_BOTTOM, HEAD_LEFT:HEAD_RIGHT] = True
    # Follow the skin/beard boundary into the collar rather than cutting a
    # horizontal seam through the differently articulated hoodie shoulders.
    rgb = pixels[:, :, :3].astype(int)
    warm = ((rgb[:, :, 0] - rgb[:, :, 1] > 10)
            & (rgb[:, :, 1] - rgb[:, :, 2] > 4)
            & (pixels[:, :, 3] > 0))
    for y in range(UNOBSTRUCTED_HEAD_BOTTOM, HEAD_BOTTOM):
        xs = np.flatnonzero(warm[y, HEAD_LEFT:HEAD_RIGHT]) + HEAD_LEFT
        if xs.size:
            left = max(HEAD_LEFT, int(xs.min()) - 2)
            right = min(HEAD_RIGHT, int(xs.max()) + 3)
            mask[y, left:right] = True
    return mask

def assemble_shared_head(pose, idle, facing="left"):
    canonical = np.array(idle)
    if facing == "right":
        canonical = canonical[:, ::-1].copy()
    pixels = np.array(pose)
    left = (pose.width - idle.width) // 2
    body = pixels[:, left:left + idle.width]
    reference_mask = head_mask(canonical)
    mask = reference_mask | head_mask(body)
    body[mask] = canonical[mask]
    # Exact facial pixels, rather than approximate perceptual resemblance.
    assert np.array_equal(body[reference_mask], canonical[reference_mask])
    pixels[:, left:left + idle.width] = body
    return Image.fromarray(pixels)
