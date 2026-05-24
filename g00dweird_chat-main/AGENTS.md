# AGENTS.md

## Project Identity

This project is **g00dweird chat**: a strange, living, multi-world interactive chat experience made of browser rooms, isometric spaces, autonomous sprites, retro UI, weird props, ambient creatures, and world-specific moods.

Neoclassick is one world and one aesthetic thread. The platform should support many distinct worlds without forcing them to behave or feel the same.

The app should feel playful, uncanny, lo-fi, reactive, nostalgic, alive, expressive, sometimes funny, sometimes eerie, and never bland or generic.

## Repository Map

The active app source is organized as:

```text
backend/                       FastAPI backend services and APIs
frontend/                      React/Vite frontend source of truth
  src/                         React app code
  public/                      runtime-served public assets
  public/assets/               runtime-ready app assets
  public/source-assets/        raw/imported/source art
  public/tools/                standalone dev tools
  public/assets/cleaned-sprites/ generated sprite outputs
  scripts/                     frontend asset/tooling scripts
scripts/                       project-level tooling scripts
tests/                         project-level tests
docs/                          plans, specs, notes
reports/                       generated reports
```

Do not recreate root-level `frontend/`, root-level `assets/`, or root-level `index.html` outside this app directory. The active frontend lives at `frontend/`.

## Default Workflow

When given a task:

1. Inspect the relevant existing structure first.
2. Identify whether the change belongs to platform/shared code, world-specific code, asset organization, or tooling.
3. Make a brief plan for non-trivial work.
4. Execute with focused, reviewable changes.
5. Run the smallest validation that proves the change works.
6. Summarize exactly what changed and what was verified.

Prefer action over long explanation. Make strong, reasonable decisions and continue. If a decision is risky, document the risk and choose the safest useful implementation.

## Creative Standard

Every user-facing change should add at least one of these:

- a visible weird, expressive, funny, eerie, or tactile behavior
- a reusable primitive that makes future weirdness easier
- a clearer world-specific mood, interaction, or visual identity
- a reduction in friction for creating, testing, or arranging worlds and sprites

Before building, ask:

**What should feel alive, surprising, funny, eerie, or reactive here?**

Small details matter: hover reactions, cursor behavior, idle animation, flicker, tiny rituals, subtle movement, sprite personality, responsive props, weird UI toys, and controlled randomness can make the world feel alive.

Randomness should feel intentional, not chaotic. Use deterministic or seeded randomness when it helps debugging.

## Architecture Direction

Build for all worlds in g00dweird chat, not just the current scene.

Prefer:

- small modular systems
- reusable sprite and animation helpers
- lightweight entity definitions
- behavior modules for autonomous sprites
- asset manifests where they reduce hardcoding
- clear separation between rendering, input, world state, animation, asset loading, and world configuration
- registries/modules for world definitions and shared primitives

Avoid:

- giant hardcoded world files
- tangled shared/world-specific state
- repeated sprite animation logic
- unnecessary React re-renders in animation-heavy surfaces
- fragile absolute paths
- external-drive runtime dependencies
- bloated global state
- assuming every world behaves like Neoclassick

JSON is fine for content manifests. Do not make JSON the whole architecture when behavior, rendering, or interaction logic needs real modules.

## Shared vs World-Specific

Keep shared systems reusable:

- renderer
- animation engine
- input handling
- asset loading
- entity lifecycle
- debug tooling
- generic sprite helpers
- world loading
- interaction primitives

Keep world-specific content close to the world:

- backgrounds
- props
- sprite sets
- behavior parameters
- event rules
- environmental effects
- dialogue or UI flavor
- interaction style
- cursor rules
- sound/music hooks, when present

Do not bury world-specific behavior inside shared engine code unless the current structure makes that unavoidable. Prefer world assets and entities that match the scene's visual language.

## World Contract

A world should be easy to define, load, inspect, and extend. When adding or refactoring world support, aim for a clear contract with:

- id / slug
- display name
- visual style notes
- background image or scene component
- entity definitions
- ambient behavior rules
- interactive objects
- collision/navigation rules, if needed
- UI overlay or interface framing, if world-specific
- cursor rules, if world-specific
- music/sound hooks, if supported
- debug affordances, if useful

Worlds may be isometric, screen-based, room-like, browser-like, theatrical, celestial, chat-native, abstract, crowded, sparse, loud, quiet, retro, or eerie. The shared system should allow this variation.

## Sprite And Entity Rules

Sprites should be easy to add, test, animate, and reuse across worlds.

Support where practical:

- idle, walk, run, jump, float, hurt, emote, and special animations
- click and hover reactions
- frame timing
- hitboxes and pivots
- scale controls
- z-index/depth sorting
- debug visualization
- autonomous behavior
- world-specific animation sets

Entity behavior should live close to the entity or in reusable behavior modules. Good behavior primitives include wandering, floating, blinking, pulsing, thinking, reacting to cursor, avoiding objects, drifting, rare actions, and world-specific special events.

## Asset Lifecycle

Keep runtime assets inside the project. Do not depend on external drive paths.

Use the current structure:

```text
frontend/public/
  assets/                 runtime-ready public app assets
    cleaned-sprites/      generated cleaned sprite sheets and descriptors
    world-icons/          runtime world picker icons
    multitaire-cards/     runtime card faces
    effects/              runtime effects
  source-assets/          raw/imported/source art for processing
    avatar/
    sheets/
    worlds/
    debug/
  tools/                  standalone browser tools
```

Preserve source filenames when practical. Do not rename files unnecessarily. Keep raw/imported, processed/generated, and runtime-ready assets distinguishable.

When moving assets from uploaded, external, or local scratch locations, put them in the right app-local folder and note the move when it affects future work.

Do not place app runtime assets in root-level `assets/`. Do not place app code in root-level `frontend/`.

## Performance Guardrails

Animated worlds can get expensive quickly.

Prefer:

- stable props and memoized derived data where useful
- refs and `requestAnimationFrame` for high-frequency animation state
- CSS animation for simple loops
- bounded timers and cleanup for ambient behavior
- sprite manifests over repeated path construction
- lightweight entity objects

Avoid:

- pushing every animation tick through React state
- recreating large arrays/objects on every render
- unbounded random timers
- fetching manifests repeatedly
- duplicating large asset sets

## Validation

Run the smallest check that proves the change.

Frontend:

```bash
cd frontend
npm run build
```

Sprite tooling:

```bash
cd frontend
npm run sprites
```

Backend/project tests when relevant:

```bash
pytest
```

Use browser verification for visible frontend changes when available. The local frontend dev server usually runs from:

```text
http://127.0.0.1:3000
```

If validation cannot be run, say why and name the remaining risk.

## Practical Editing Rules

- Preserve what already works.
- Prefer focused, reviewable changes.
- Make visible improvements when the task is user-facing.
- Improve foundations when the foundation clearly benefits multiple worlds.
- Avoid huge rewrites unless the current structure is blocking progress.
- Do not rely on external drive paths at runtime.
- Do not introduce new top-level project folders without a clear reason.
- Keep dependencies, caches, and local scratch work out of app commits.
