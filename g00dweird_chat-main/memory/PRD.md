# g00dweird.com — PRD

## Original Problem Statement
> a win 95 style retro chatroom for g00dweird.com that allows upload music audio video and avatars in pixel strange isomorphic worlds

## User Choices (captured)
- 12 themed iso rooms incl. **Inspiration Theatre** (communal YouTube)
- Distance + vertical-aware locomotion: walk/float/hop/wiggle close, run/dash/hop far,
  jump on vertical, all per-creature-mapped
- 4 symbol-labeled emotes per creature (♥, ✨, !, ?, etc.) + creature `action` + extras
  like `split` for slime
- PvP click-to-attack (3 hits → die → 4s respawn). Bots are attackable too
- Animation priority: DIE > HURT > ATTACK > MOVE > IDLE > EMOTE
- **Uniform per-creature frame canvas** so frames never jump or show two sprites
- Custom Win95 cursors (weird-arrow + weird-pointer + red attack-hover variant)
- WeirdBot AI: pure canned with user-supplied quotes + 20 keyword triggers
- YouTube theatre: late-joiner sync, 30s drift correction, **auto-advance on ENDED**
- Reaction emoji burst, touch-swipe rooms, mobile responsive

## Architecture
- **Backend**: FastAPI + MongoDB
  - PvP guards: `attack_until` (700ms), `hurt_until` (600ms), `dead_until` (4s)
  - WeirdBot loop + canned brain. Bot has full PvP fields → attackable
- **Frontend**: React + Win95 chrome
  - `IsoWorld`: distance + vertical-aware travel stance, attack-hover cursor swap,
    1.4s ease-out tween
  - `AnimSprite`: single-image swap (uniform canvas means no layout shift)
  - `SpritePicker`: only emotes + action + special states (slime split, etc.)
  - `TheatreScreen`: YT iframe + `event=listening` handshake + `onStateChange` → auto-next

## Implemented — Iteration 20 (2026-02-29)
- **CRITICAL fix: Ghost dash/float animation now plays during travel.**
  Root cause: `Desktop.jsx` had `useEffect(() => socket.send({type:"stance",
  stance: animStance}), [animStance, socket])` — but `socket` is the object
  returned by `useChatSocket()`, which is recreated on every render. So
  every chat/move/users update re-fired the effect and broadcast
  `stance:"idle"` within ~120ms of any click, clobbering the dash/float
  stance set by `ChatWindow.handleMove`. **Fix**: introduced a
  `lastSentStanceRef` guard and changed the deps to `[animStance,
  socket.connected]` (primitive, stable). Now the effect only fires when
  `animStance` actually changes. Verified via the new `data-stance`
  attribute: dash holds for the full ~1.3s travel duration, float for ~1s.
- **WeirdBot tuning**: action weights `[3,2,1,1,6]` (was `[3,4,1,1,4]`),
  tick `uniform(12,22)` (was `uniform(6,10)`), `weirdbot_react` probability
  12% (was 30%). Net effect: bot speaks ~3-4× less often.
- **`QUOTE_TTL_MS` 8s → 12s** so users have 50% more time to read each bot
  quote bubble.
- **Test-friendly attributes** on `[data-testid="iso-avatar"]`:
  `data-user-id`, `data-nickname`, `data-stance`, `data-anim-id` — makes
  playwright assertions deterministic at 100-150ms granularity.
- **`fpsForStance`**: added `float: 8`, bumped `dash: 9 → 10` for
  liveliness.
- **Tests**: iter19 backend 6/6 regression PASS, iter20 frontend 4/4 PASS
  (dash held, float held, idle revert, bubble TTL).


- **Kill-Mode toggle (PvP opt-in)**: avatar clicks in the iso world now
  default to opening that user's `/u/<nick>?u=<id>` profile in a new tab —
  calmer "alive web" feel. PvP is opt-in via a toggle.
  - **Toggle UI**: floating pill `data-testid="kill-mode-pill"` top-right of
    the iso world (always visible, '⚔ PEACE' / '⚔ KILL'); sidebar action
    button `data-testid="toggle-kill-mode"`; mobile bar entry
    `data-testid="m-kill-mode"`. State persists across reload via
    `localStorage["g00d_kill_mode"]`.
  - **Visual cues when ON**: red crosshair cursor (`.attack-hover` reused) on
    avatar hover; pulsing red `data-testid="kill-mode-banner"` reading
    "⚔ KILL MODE — click to strike" at the top-center of the iso. When OFF
    and hovering an avatar, link cursor (`.profile-hover`).
  - **Hostile broadcast**: new WS message `{type:"kill_mode", on:bool}`.
    `ws.handle_kill_mode` mutates `conn.kill_mode` and broadcasts.
    `room_user_list` now emits `kill_mode` per user, and the chat user-list
    renders ⚔ next to hostile names (`data-testid="user-hostile-<nick>"`).
  - **Click router**: `IsoWorld` accepts `killMode` + `onClickUser`. When
    `killMode=true` clicks call `onAttack(target_id)` (existing PvP path);
    when false they call `onClickUser(target)` which `window.open`s the
    profile page in a new tab.
  - **Server policy**: attacks are NOT gated by `attacker.kill_mode` on the
    backend (per spec — gating is client-side UX). `WeirdBotConn` got a
    `self.kill_mode = False` defensive default for symmetry.
- **Tests**: iter18 7/7 PASS, iter17 19/19 regression PASS, frontend 11/11
  UI flows verified including localStorage persist + new-tab profile open
  + ON-mode attack send.


- **`server.py` ws-handler split (P2 done)**: extracted all per-message-type
  handlers from the 1.4k-line `server.py` into `/app/backend/ws/handlers.py`
  (485 lines). The endpoint is now a 5-line dispatch loop:
  `await ws_dispatch(WS_CTX, conn, room, msg)`. State classes (`RoomState`,
  `ClientConn`), broadcast, weirdbot, jukebox-advance, and the upload helper
  stay in `server.py` and are wired into a small `WSContext` dataclass passed
  to every handler. Net result: `server.py` 1397→1043 lines (-25%), every
  handler is now trivially unit-testable in isolation.
- **`ChatWindow.jsx` refactor (P2 done)**: 580→344 lines. Extracted
  subcomponents into `/app/frontend/src/components/chat/`:
  `UserListSidebar.jsx` (clickable-handle user list + action buttons),
  `ChatMessageList.jsx` (translucent message overlay), `ChatInputBar.jsx`
  (compose form + emote/think/fullfunk toggles), `MobileActionBar.jsx`
  (mobile horizontal action row).
- **Auto-raise focus (P2 done)**: `Win95Window` now accepts a `requestFocus`
  number prop. `Desktop.jsx` keeps a `focusNonces` map and bumps the right
  key on every `toggle(key, true)` call, so clicking a desktop icon, a
  taskbar button, OR an action-bar button raises that window above all
  peers — even if it was already open. Implementation uses both an
  in-render `lastFocusRef`-guarded counter bump AND a `useEffect` that calls
  `setZ(++Z)`, so the new z-index is in the DOM by the next paint.
  Verified via playwright: opening Sprites then Worlds, then clicking the
  Sprites desktop icon raises Sprites z 21→32 above Worlds z=30.
- **Profile disambiguation (P2 done)**: `GET /api/profile/{nickname}` now
  accepts an optional `?user_id=<id>` query param to pin to a specific
  account when handles collide. Without it, the most recently created user
  with that handle is returned (unchanged behaviour). With a wrong user_id,
  returns 404. The chat user-list links and the My-Profile share button
  both now emit URLs of the form `/u/<nick>?u=<user_id>` so the link is
  always unambiguous.
- **`ChatMessageList` key fix**: replaced `key={m.id}` with
  `key={m.id || `${m.user_id}-${m.ts || i}`}` to silence a React warning
  flagged by the iteration-17 testing agent.
- **Tests**: `/app/backend/tests/test_iteration17.py` 19/19 PASS. Frontend
  smoke verified via playwright (focus-raise via desktop-icon and taskbar).


- **Universal Key refreshed** in `/app/backend/.env` after the Pro upgrade —
  `POST /api/upload` now returns 200 (was 401). Verified via curl + the
  iter16 backend tests.
- **Shareable public profile pages — alive-web/social-network vibe**.
  - **Backend**: new `GET /api/profile/{nickname}` returning the user doc +
    their recent tags + recent uploads + live-presence snapshot (`live_room_id`,
    `live_room_name`). 404 on unknown handle.
  - **WS handler** now persists `sprite_id`, `anim_id`, `avatar_path`,
    `last_room_id`, `last_seen_at` on connect, on each `avatar`/`sprite`/`anim`
    msg, and on disconnect — so the profile page reflects the user's most
    recent presence even when they're offline. Helper `_avatar_url_to_path`
    safely extracts the storage path from `/api/files/<path>` URLs (returns
    None for any non-files URL).
  - **Frontend**: new standalone `ProfilePage.jsx` at `/u/:nickname` with a
    purple-gradient alive-web aesthetic (deliberately *outside* the Win95
    chrome): top scrolling green-on-black marquee, neon gradient pixel handle
    `@nickname`, pulsing red `LIVE` glow ring on the avatar when connected,
    BIO card, stat chips (TAGS / UPLOADS / STATUS), grouped graffiti gallery
    chips (rotated, dashed pink borders) per room, drop list of recent media
    uploads, "enter g00dweird →" + "copy share link" CTAs. 404 ghost screen
    for unknown handles.
  - **ProfileWindow**: added `Share` button (`data-testid="profile-share"`)
    that copies `/u/<nickname>` to clipboard.
  - **ChatWindow**: every entry in `data-testid="user-list"` is now a
    clickable anchor `data-testid="user-list-link-<nickname>"` that opens
    `/u/<nickname>` in a new tab.
- **Touch-swipe rooms (P2 backlog)**: confirmed already implemented in
  `Desktop.jsx` (left swipe = next, right = prev, vertical guard, max
  duration). No code change needed.
- **Tests**: `/app/backend/tests/test_iteration16.py` — 11/11 pass.
  Frontend smoke covers `profile-page`, `profile-page-not-found`,
  `profile-page-live-cta`, `user-list-link-<nick>`, `profile-share`, and
  sprite single-instance regression.


- **Sprite "double-instance" bug fixed across all creatures** — root cause: the
  slicer was cropping cells by raw cell-boundary X-range, so when a row label was
  detected as an extra blob and `force_n_split` divided the row into N evenly,
  the cell boundaries straddled adjacent sprites. The output PNGs contained
  parts of TWO sprites side by side (the "left + right" duplication users saw on
  frog, ghost, cat, tvhead, slime).
- **Slicer changes** (`/app/scripts/slice_unified.py`):
  1. New `label_components` 4-connected CC labelling (no scipy dependency).
  2. New `dominant_cc_bbox` — for each cell, finds the largest CC and keeps any
     additional CC whose centroid is within ±0.55·cell_width and pixel count
     ≥18% of the largest. Returns the union bbox. Discards label slivers and
     leakage from adjacent cells.
  3. New `filter_label_blobs` — when blob-detect returns N+k blobs (because of
     row-label text), drop blobs whose width is <45% of median or pixel count
     <30% of median, then keep the N widest. Avoids force-split misalignment in
     the common +1 case.
  4. Each frame is masked by the kept-CC mask before paste, so leakage outside
     the dominant cluster is fully erased.
- **Verified**: 253/254 emitted frames are single-blob; the 1 remaining (frog
  action_0) has a small adjacent sliver that is intentional sprite content.
- **Cache invalidated**: `ANIM_VERSION` bumped 14 → 16; manifest version 14 → 16.
- **`FRAMES` table updated** in `AnimSprite.jsx` to match the new manifest:
  `alien.hurt 1→2`, `ghost.idle 2→3`, `ghost.die 3→4`.


- **Pixel-art thought cloud** — replaced the SVG cloud with a hand-designed 92×36
  pixel PNG (`/app/frontend/src/assets/thought_cloud.png`). Stretches via
  `background-size: 100% 100%` + `image-rendering: pixelated`. No clipping, no
  smooth circles, no internal black gaps. Three pixelated puffs across the top +
  rounded-corner pixel rectangle for the body.
- **Bot thinks less + thoughts fade** — bot loop weights changed from
  `[walk:3, talk:4, think:2, glitch:1, idle:2]` to `[walk:3, talk:4, think:1,
  glitch:1, idle:4]`. Bot thoughts now also auto-clear after 6 seconds via a
  scheduled task that broadcasts `thought=""`. Bubble fades opacity 1→0 over the
  same 6s via the `.thought-fading` CSS class (added only when `user_id` starts
  with `weirdbot-`).
- **User profile bio editor** — new endpoints:
  - `GET /api/users/{user_id}/bio` → `{user_id, nickname, bio}` (404 on unknown)
  - `PUT /api/users/{user_id}/bio` → persists `bio` to the `users` collection
    (capped at 500 chars; whitespace stripped; 404 on unknown).
  - Frontend `ProfileWindow` now has a textarea (`profile-bio-input`) + save
    button (`profile-bio-save`) that toggles `save bio` ↔ `saved` based on dirty
    state. Auto-loads existing bio on open.

## Implemented — Iteration 14 (2026-02-28)
- **Slicer rewritten with uniform per-creature canvas size**:
  - Computes `max_width × max_height` across ALL frames for a creature
  - Pastes each tightly-cropped sprite onto a transparent canvas of that size,
    centered horizontally + bottom-aligned (creatures stand on the same ground line)
  - Verified: every alien frame is now 238x170, slime 170x140, tvhead 158x210, etc.
  - Eliminates layout shift, ghost frames, and "two sprites visible" bugs.
- **AnimSprite reverted to clean single-image swap** — uniform canvases mean swapping
  src is safe. Frames preloaded via `new Image()` so swap is instant from cache.
- **Slime SPLIT animation in picker**: confirmed live — `stance-split` button visible
  alongside emote_a/b/c/d, plays the 5-frame split sequence.
- **Spray verified working live**: 7 placed-tag elements, floating-spray-can renders
  next to avatar, mix-blend-mode: screen on tag-layer.
- **WeirdBot quotes confirmed live**: `weirdbot: PSA: the chairs are gossiping about the ceiling.`
  rendered in chat (your provided text).

## Implemented — Iterations 1–13 (preserved)
12 themed iso rooms, real-time chat/jukebox/uploads, graffiti tagging, 11 anim
creatures, animation priority enforcement, YouTube theatre + sync + drift correction +
auto-advance, EmojiBurst, touch-swipe, mobile responsive, FULLFUNK font, BSOD
marquee, guestbook, invite links, Win95 chrome with custom cursors.

## Test Coverage (2026-02-28)
**Backend**: 42/42 non-upload tests pass (1 transient WS handshake passes on retry;
upload tests blocked by Universal Key 401 — refresh to fix)
- iter9 (5): PvP attack flow, 3-hits→die→respawn, attack-on-bot allowed,
  attack-self ignored, move-blocked-while-dead
- iter10 (6): keyword bot path, sanitiser, no-LLM-import
- iter12 (3): emote priority guards (hurt/attack/die)

**Frontend (Playwright manual smoke)**:
- ✓ Spray flow: 7 tags placed, floating can visible
- ✓ Slime picker shows `wiggle`, `split`, `?`, `♥`, `!`, `z` (no auto stances)
- ✓ All sliced frames have uniform canvas per creature
- ✓ `?v=14` cache busted
- ✓ WeirdBot quotes from user-supplied list rendering live

## Backlog
**P2**
- Hide weirdbot from the chat user-list link target (currently `/u/weirdbot?u=...`
  returns 404 because the bot has no DB doc) OR seed a synthetic profile row
- Visual QA on hit-flash + GET REKT FX (CSS keyframes wired)
- More keyword triggers for WeirdBot
- Optionally split `ProfilePage.jsx` (~540 lines) into smaller components
- Embeddable profile widget (iframe / HTML snippet) so users can drop their
  live "now in [room]" badge on tumblr/blogs (boosts alive-web flywheel)

## Future Add-ons
- **Neoclassick Back 9 / Hole 9**: keep the experimental back-nine assets and
  interactive Hole 9 scene from the polish branch out of the current main
  release until they have a clean world-runtime contract, production asset
  manifest, and routing/picker behavior that does not replace the shipped
  `neoclassick-world` room background.

## Environment
- Backend: `MONGO_URL`, `DB_NAME`, `LOCAL_STORAGE_DIR`, `OBJECT_STORAGE_PROVIDER`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ENDPOINT_URL`, `OBJECT_STORAGE_REGION`
- Frontend: `REACT_APP_BACKEND_URL`
- Slicer: `slice_unified.py` (uniform-canvas per creature)
- Cursors: `/app/frontend/src/assets/{arrow,pointer,arrow_red,pointer_red}.png`
- Cache version: `ANIM_VERSION = 16`
