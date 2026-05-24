# Here are your Instructions

## Sprite Cleanup and Sprite Lab

Use the sprite cleaner for red-background sprite sheets and other pixel-art source sprites. Originals stay untouched.

1. Put red-background sprite sheets into `assets/imported`, `imported`, `frontend/public/anim`, or the correct world/sprite asset folder.
2. From `frontend/`, run `npm run sprites`.
3. Start the backend and frontend, then open `/sprite-lab`.
4. Fix bounding boxes and pivots visually.
5. Save overrides. They are written to `frontend/public/assets/cleaned-sprites/manual-overrides.json`.
6. Rebuild cleaned sprites from Sprite Lab, or run `npm run sprites` again.
7. Use generated descriptors from `frontend/public/assets/cleaned-sprites/descriptors` in the iso/world engine.

The cleaner uses Pillow with hard pixel edges only: red key pixels (`#ff0000` plus tolerance) become transparent, red edge contamination is removed, frames are cropped and normalized, duplicate/still frames are flagged, and suspicious frames are reported in `reports/sprite-audit.md`.
