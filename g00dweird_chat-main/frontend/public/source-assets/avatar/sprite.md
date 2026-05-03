# Sprite Sheet Specification for g00dweird Chat

## Important Note About Aseprite CLI

Running this command:

```bash
aseprite -b input.aseprite \
  --sheet g00dwierd_avatar_fairy_32.png \
  --data g00dwierd_avatar_fairy_32.json \
  --format json-array \
  --trim \
  --extrude 1
```

does **not create artwork from scratch**.

It only exports an existing `.aseprite` file into:
- a PNG sprite sheet
- a JSON animation/frame data file

You need to already have the art/animation inside `input.aseprite`.

If you want a blank template first, create the canvas/grid in Aseprite manually or use a script/template file, then draw or paste the frames into it.

---

# Sprite Sheet Layout

One sheet per avatar.

## File naming

Final sheets should be named:

```text
g00dwierd_avatar_<creature>_<size>.png
```

Examples:

```text
g00dwierd_avatar_fairy_32.png
g00dwierd_avatar_cat_64.png
```

---

# Canvas Sizes

## 32px avatar sheet

Frame size:

```text
32 × 32 px
```

Maximum columns:

```text
6
```

Rows:

```text
8
```

Canvas size:

```text
192 × 256 px
```

## 64px avatar sheet

Frame size:

```text
64 × 64 px
```

Maximum columns:

```text
8
```

Rows:

```text
8
```

Canvas size:

```text
512 × 512 px
```

---

# Row Order

Rows must be ordered exactly from top to bottom:

```text
idle
walk
attack_scare
attack_laser
attack_tongue
attack_chestbeat
hurt
die
```

---

# Frame Counts

## 32px avatars

```text
idle: 4 frames
walk: 6 frames
attack_scare: 6 frames
attack_laser: 6 frames
attack_tongue: 6 frames
attack_chestbeat: 6 frames
hurt: 3 frames
die: 6 frames
```

## 64px avatars

```text
idle: 6 frames
walk: 8 frames
attack_scare: 8 frames
attack_laser: 8 frames
attack_tongue: 8 frames
attack_chestbeat: 8 frames
hurt: 4 frames
die: 8 frames
```

---

# Animation Looping

Loop these:

```text
idle
walk
attack_scare
attack_laser
attack_tongue
attack_chestbeat
```

Do not loop these:

```text
hurt
die
```

---

# Suggested Timing

```text
idle: 120ms per frame
walk: 90ms per frame
attacks: 80ms per frame
hurt: 100ms per frame, play once
die: 90ms per frame, play once
```

---

# Hitbox and Alignment Rules

Keep the character centered on the same pixel column across all frames.

Keep the baseline aligned across all rows.

Do not bake per-frame offsets into the sheet.

For these frames:

```text
idle
hurt
first frame of die
```

the silhouette should stay the same width and height.

Avoid:
- arms sticking farther out
- ears extending past the idle width
- tail or accessories expanding the hitbox
- feet or body shifting off baseline

Squash/stretch is okay only if it happens inward, not outward.

---

# Hurt Animation Blueprint

## 32px hurt row, 3 frames

```text
Frame 1: impact pose / small flash / squash
Frame 2: recoil pose / slight tilt / bounce backward
Frame 3: settle back toward idle
```

## 64px hurt row, 4 frames

```text
Frame 1: impact pose
Frame 2: recoil
Frame 3: stagger
Frame 4: settle
```

---

# Die Animation Blueprint

## 32px die row, 6 frames

```text
Frame 1: freeze, matching idle silhouette
Frame 2: collapse start
Frame 3: falling / sinking
Frame 4: ground hit
Frame 5: flatten / puff / sparkle
Frame 6: fade, sparkle, or final hold
```

## 64px die row, 8 frames

```text
Frame 1: freeze, matching idle silhouette
Frame 2: collapse start
Frame 3: secondary collapse
Frame 4: falling / sinking
Frame 5: ground hit
Frame 6: flatten / puff
Frame 7: fade / sparkle
Frame 8: final hold
```

---

# Missing Sprite Requirement

The first five avatars in the fairy-to-cat run are missing:

```text
hurt
die
```

Recreate those rows for each of the first five avatars.

Keep the emotes as they are.

Do not change existing emote rows or rename files unless explicitly requested.

---

# Palette and Export

Use a shared indexed palette for the avatar set.

Recommended:

```text
32–64 colors
8-bit indexed PNG
transparent background when supported
no aggressive dithering
clean pixel clusters
```

Compress final PNGs with:

```bash
oxipng -o6 --strip all g00dwierd_avatar_<creature>_<size>.png
```

---

# Engine Prompt

Use this prompt for the chat animation engine:

```text
Use the sprite sheets named g00dwierd_avatar_<name>_<size>.png.

Each sheet is arranged in rows:
idle, walk, attack_scare, attack_laser, attack_tongue, attack_chestbeat, hurt, die.

Behavior mapping:

- Idle when standing: play "idle" and loop.
- Walk for close movement: play "walk" and loop.
- Float for ghosts or floating avatars: use "walk" as the movement loop unless a dedicated float exists.
- Run when clicking a far part of the world: play "walk" at 1.3x speed and loop.
- Jump between raised world sections: use the first half of "walk" faster, or use a dedicated jump/hop animation if present.

Combat:

When a user clicks another user in the chat, trigger that avatar's attack animation.

Attack types map like this:
- scare: "attack_scare"
- laser: "attack_laser"
- tongue: "attack_tongue"
- chest beat: "attack_chestbeat"

When an avatar is attacked, play "hurt" once.

After 3 successful hits, play "die" once and disable player control.

Looping:
- idle loops
- walk loops
- attack animations loop only while attacking
- hurt does not loop
- die does not loop

Other movement variants such as ghost dash should behave like run, which is a sped-up "walk".

Any animations not included in the main world movement/combat states should appear in the sprite picker window as emotes and actions.
```

---

# QA Checklist

Before shipping, confirm:

```text
[ ] Rows are in the exact required order
[ ] Correct frame counts for 32px sheets
[ ] Correct frame counts for 64px sheets
[ ] Hurt rows added for first five fairy-to-cat avatars
[ ] Die rows added for first five fairy-to-cat avatars
[ ] Existing emotes preserved
[ ] Baseline stays consistent
[ ] Center pixel stays consistent
[ ] No baked frame offsets
[ ] First hurt frame does not expand hitbox
[ ] First die frame does not expand hitbox
[ ] PNG uses indexed palette
[ ] Background/export format matches engine needs
[ ] File names remain unchanged unless explicitly requested
[ ] PNGs compressed with oxipng
```
