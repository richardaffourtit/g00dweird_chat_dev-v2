# Halloween ghost animation pack

Four atmospheric characters based on the user's handmade ghost photographs.
Artwork was created with the built-in imagegen tool. Generated source sheets
and exact prompts are preserved under
`frontend/public/source-assets/worlds/halloween-ghosts/`.
The original reference photographs and photo-comparison preview are local review
materials and are excluded from the public release.

## Characters

| ID | Working name | Reference features |
| --- | --- | --- |
| ghost1 | Crooked Grin | Curved neck, round black eyes, broad grin, ivory and sage |
| ghost2 | Velvet Eyes | Long magenta eyes, dripping smile, ivory sheet |
| ghost3 | Little Wisp | Pointed head, raised arm, lime-to-purple fabric, no mouth |
| ghost4 | Skull Veil | Hunched hood, long eye sockets, jagged grin, mint and chartreuse |

## Animation contract

Each character has a transparent 4 × 4 atlas and 16 individual PNG frames.
Use the dimensions in `manifest.json`; every frame of a character has a fixed
canvas and anchor. Source sheets are split and padded to equal cells without
rescaling, repainting, or trimming individual poses. Generated alpha is retained.

| State | Atlas row | Frames | FPS | Playback |
| --- | --- | --- | --- | --- |
| rise | 0 | 4 | 7 | Once, then float |
| float | 1 | 4 | 6 | Loop |
| haunt | 2 | 4 | 7 | Once, then float |
| vanish | 3 | 4 | 7 | Once, then hidden |

`animations[state].files` contains runtime URLs; `atlasFrames` gives source
rectangles. The normalized anchor marks the center near the base of each cell.
Ground clipping, flight paths, bobbing, and lifecycle timing are demonstrated
in the preview independently of the frame animation.

## Review

In the original local workspace, with the frontend dev server running, open
`/tools/halloween-ghost-preview.html`.
The preview provides a shared Halloween stage, reference comparisons, isolated
animation playback, pause/frame stepping, and speed/size controls. Reduced-motion
preferences start playback paused.

## Rebuild

From `g00dweird_chat-main/`, with frontend dependencies installed:

```sh
node scripts/package_halloween_ghosts.cjs --webp
```

The script uses the existing Playwright dependency for lossless canvas slicing.
The optional `--webp` flag requires FFmpeg and creates a transparent animated
`float.webp` for each character. PNG source sheets are never overwritten.
An asset audit is written to `reports/halloween-ghost-assets.json`.

These are ambient scene assets, separate from the selectable `ghost` avatar.

## Scene appearance

`appearance.css` gives the cropped sprites a spectral green tint and soft green
halo. Apply `halloween-ghost-glow` to an outer wrapper around the clipped frame;
this keeps neighboring atlas cells out of the glow. The original artwork remains
available for future palette changes. Preview and chat share this stylesheet.
The approved scene size is 0.75 × the preview's base size.
