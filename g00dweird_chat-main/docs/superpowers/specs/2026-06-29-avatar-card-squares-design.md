# Avatar Card Squares Design

## Goal

Use the generated stock-avatar card art as the square identity image for stock avatars across profile surfaces. Uploaded avatars remain user-authored images and continue to render centered inside the same square shell. The square itself is not an upload control; clicking it opens a larger card view when a stock card is available.

## Surfaces

- `ProfileWindow`: replace the fallback initial-only square with a stock card square when the user has selected a stock animated/static avatar and has not selected an uploaded avatar.
- `ProfilePage`: replace the current stock sprite preview frame with the same card-square treatment on public profiles.
- Later reuse: the same component can be used by Dripnet/Wall active artist tiles, but this implementation should avoid changing Wall behavior unless the shared component makes that use trivial and low-risk.

## Display Rules

1. Uploaded avatar wins. If `avatar_path`, `avatar_url`, or the current uploaded avatar record exists, show that image centered in the square.
2. Stock animated avatar next. If `anim_id` maps to a generated card asset, show that card art cropped to square.
3. Stock static avatar next. If `sprite_id` maps to a generated card asset, show that card art cropped to square.
4. Fallback last. If no stock card is available, show a readable initials tile.

Every square gets a small initials chip, such as `RF`, with high-contrast white text on a dark chip. For stock cards, the chip overlays the lower-right corner. For uploaded avatars, the chip can be omitted if it fights the image, but it should remain available where identity would otherwise be unclear.

## Large View

Clicking a stock-card square opens a modal-style enlarged card view:

- Use the full portrait card asset, not the cropped square.
- Provide a clear close button and close-on-backdrop behavior.
- Do not expose upload controls in the enlarged view.
- If a stock card asset is missing, the square should not open an empty modal.

## Asset Model

Create app-owned card assets under `frontend/public/assets/avatar-cards/`:

- `full/{id}.png` for portrait cards used by the large view.
- `square/{id}.png` for square crops used by profile tiles.

Initial IDs should cover the current stock avatars:

- Animated: `alien`, `ape`, `cat`, `fairy`, `frog`, `ghost`, `robot`, `skeleton`, `slime`, `tvhead`, `weirdbot`.
- Static: `ghost_tiny`, `ghost_cute`, `ghost_giant`, `alien_gray`, `alien_green`, `alien_hulk`, `ape_baby`, `ape_dude`, `ape_king`.

The corrected big purple `ape` card replaces the first generated punk/cute variants.

## Component Plan

Add a small reusable component, tentatively `AvatarCardSquare`, that accepts:

- `nickname`
- `avatarUrl` or uploaded avatar URL
- `animId`
- `spriteId`
- `size`
- optional `testId`

It computes initials from the nickname, chooses the correct image source, renders the square shell, and owns the click-to-large-card behavior. This keeps profile windows and public pages from duplicating card selection rules.

## Error Handling

- Broken stock card image falls back to initials.
- Broken uploaded avatar image falls back to stock card if one is available, then initials.
- Modal only opens when a full stock-card image is known.
- Missing nickname falls back to `??` initials.

## Testing

- Unit/component tests cover asset selection priority: uploaded avatar, animated stock, static stock, fallback initials.
- Tests cover initials generation from one-word and multi-word names.
- Tests cover that stock cards open the large view and uploaded-avatar squares do not open a stock-card modal.
- Existing profile tests and frontend build should continue passing.

## Visual Acceptance

- Rich Ford should no longer show a huge magenta `R` fallback when a stock avatar is selected.
- The initials chip should be legible over busy card art.
- The public profile square should read as a square avatar image first, not as a tiny portrait card squeezed into a box.
- The large card view should feel like inspecting the collectible card, not like editing a profile.

## Self Review

- No placeholder requirements remain.
- Display priority is explicit and resolves uploaded-vs-stock ambiguity.
- Scope is limited to profile/card identity surfaces, with Dripnet reuse deferred unless naturally supported by the shared component.
- The corrected `ape` card requirement is captured so the wrong generated ape is not used.
