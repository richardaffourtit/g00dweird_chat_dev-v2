# PRESENT. — action sprite pack

## Deliverables

- `present-actions.png`: transparent 2080 × 1344 atlas.
- `present-actions.json`: exact atlas rectangles, pixel pivots and animation order.
- Individual frames: `frontend/public/anim/present/`.
- Animated comparison: `/tools/present-sprite-preview.html` when the frontend/public directory is served.

## Tee Kae sizing contract

| Action | Frames | Frame canvas | Pivot / baseline |
| --- | ---: | --- | --- |
| Idle | 3 | 180 × 224 | (90, 220) |
| Walk | 6 | 180 × 224 | (90, 220) |
| Emotes: heart, question, sparkle, music | 4 total | 180 × 224 | (90, 220) |
| Attack: palm soundwave | 4 | 520 × 224 | (260, 220) |
| Hurt | 1 | 280 × 224 | (140, 220) |
| Die / fall | 4 | 280 × 224 | (140, 220) |

22 frames total. Standing height is approximately 201 pixels, matching Tee Kae; walking and attack are 201 pixels. Every frame's bottom opaque pixel is y=219, with four transparent rows below. Shorter crouching/fallen poses retain the same canvas and floor baseline. Hurt reuses the upright dizzy pose, following Tee Kae.

Atlas rows, top to bottom: idle, walk, four emotes, attack, hurt, die. Frames within a row use the canvas widths in the table. Unused atlas area is transparent. Use the JSON rectangles; the atlas is not a single fixed-width grid.

Render at a fixed image height and preserve aspect ratio. Use nearest-neighbor/pixelated rendering. Do not crop each frame tight or use a fixed width for every action: that changes apparent actor scale.

## Generation and rebuild

Artwork was generated with the built-in image_gen tool from the approved PRESENT. avatar and Tee Kae references. Final source PNGs are in `frontend/public/source-assets/avatar/`, alongside `g00dweird_avatar_present_actions.prompt.md` with all generation prompts. The approved single-avatar master is unchanged.

Rebuild assets from `g00dweird_chat-main/`:

```sh
python3 scripts/slice_present.py
```

The slicer requires Pillow and NumPy. It preserves source files, removes low-alpha fringes, uses nearest-neighbor scaling, and assembles the canonical Idle head into movement and attack poses through scripts/present_model.py. It checks frame counts, corners, bounds, the shared floor baseline and exact head pixels, then rebuilds the atlas, manifest, walk loop and ZIP.

## Chat integration

The avatar is displayed as **PRESENT.** and uses the internal ID `present` in the chat avatar picker, frontend animation registry, and backend avatar registry. Runtime frames load from `/anim/present/`.

The slicer publishes the action counts to `frontend/public/anim/manifest.json`. It increments that manifest's `__version` only when the `present` entry changes, so rebuilding unchanged artwork does not invalidate all avatar caches.

## One character model (revision 5)

Walk and Attack reuse the exact approved Idle head pixels at 1:1 scale. Attack mirrors that same head for its right-facing poses. Registration follows the beard/neck boundary into the collar, preserving pose-specific shoulders, arms and effects. The walk body keeps its alternating legs and opposing arm swings. Attack now uses the same head size, hoodie length and chest-print size as Idle, with shorter legs in its planted stance.

Current body sources:
- Walk: frontend/public/source-assets/avatar/g00dweird_avatar_present_walk-v4-source.png
- Attack: frontend/public/source-assets/avatar/g00dweird_avatar_present_attack-v5-source.png
- Idle, emotes and reactions: frontend/public/source-assets/avatar/g00dweird_avatar_present_actions-source.png

Older generated sources are retained for provenance. The 12 idle, emote and reaction frames remain unchanged in this revision. Pose-specific expressions in those original actions are preserved.

present-walk.png is the six-frame strip; present-walk.webp is the 8fps loop. Use Previous/Next frame controls to inspect the movement, and the fixed-scale action comparison to compare Idle, Walk, Attack, Hurt and emotes.
