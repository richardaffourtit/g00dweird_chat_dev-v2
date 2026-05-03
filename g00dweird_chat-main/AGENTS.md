# AGENTS.md

## Project Identity

This project is **g00dweird chat**.

It is a strange, living, multi-world interactive chat experience made of different spaces, moods, aesthetics, mechanics, and characters.

Do **not** treat the project as only "Neoclassick world."

Neoclassick may be one world, one influence, or one aesthetic thread, but the broader project includes **multiple worlds** and should be built as a flexible system that can support many distinct environments.

The app should feel:
- playful
- uncanny
- lo-fi
- weird
- reactive
- nostalgic
- alive
- expressive
- sometimes funny
- sometimes eerie
- never bland or generic

Think:
- retro computer interfaces
- isometric spaces
- browser worlds
- chatroom worlds
- surreal environments
- autonomous sprites
- ambient creatures
- strange props
- living UI
- different themed zones or worlds
- world-specific interactions and moods

## Core Product Direction

Build for **all worlds in g00dweird chat**, not just one.

The architecture should make it easy to:
- create new worlds
- define different world aesthetics
- support different background scenes
- load different entity sets per world
- support world-specific sprites and behaviors
- support world-specific interaction rules
- support different UI overlays or modes
- add future worlds without rewriting core systems

Every system should be evaluated with this question:

**Does this help the entire g00dweird chat platform support multiple worlds more cleanly and creatively?**

## Working Rules

- Work inside the developer project unless explicitly told otherwise.
- Do not rely on external drive paths at runtime.
- Do not make huge rewrites unless the current structure is blocking progress.
- Preserve what already works.
- Prefer focused, reviewable changes.
- Make the app better in visible ways, not just cleaner internally.
- Improve foundations in ways that benefit multiple worlds when possible.
- Do not ask for constant clarification. Make strong, reasonable decisions and continue.
- If something is risky, document the risk and choose the safest useful implementation.

## Codex Behavior

When given a task:
1. Inspect the existing app structure first.
2. Identify which systems are global and which are world-specific.
3. Make a brief plan.
4. Execute the plan.
5. Run available validation.
6. Summarize exactly what changed.

Prefer action over long explanation.

When editing, distinguish between:
- **global engine/platform code**
- **shared systems**
- **world-specific content**
- **asset/content organization**

Do not hardcode one world's assumptions into shared systems.

## Architecture Direction

Do not build the app around one giant static JSON file.

Do not hardwire the engine around a single world.

Prefer:
- small modular systems
- typed registries where helpful
- reusable sprite helpers
- lightweight entity definitions
- behavior modules for autonomous sprites
- clean asset manifests
- separate systems for rendering, input, world state, animation, asset loading, and world configuration
- a clear distinction between shared engine logic and per-world data/content

Avoid:
- massive hardcoded world files
- tangled state logic
- repeated sprite animation code
- unnecessary React re-renders
- fragile absolute paths
- external-drive runtime dependencies
- bloated global state
- clunky JSON-only architecture
- assumptions that every world behaves like Neoclassick

## World System Direction

The platform should support multiple worlds cleanly.

A good world system should make it easy to define:
- world id / slug
- world name
- world visual style
- background image or scene
- world-specific entities
- ambient effects
- collision/navigation rules if needed
- interactive objects
- music/sound hooks if supported
- cursor rules if world-specific
- event behaviors
- UI overlays or interface framing

Worlds may vary in:
- aesthetic
- tone
- density
- animation style
- interaction model
- props
- character population
- surreal logic

Some worlds may be:
- isometric
- screen-based
- room-like
- browser-like
- theatrical
- celestial
- chat-native
- abstract
- heavily retro
- minimally designed
- crowded and alive
- sparse and eerie

Design systems that allow this variation.

## Shared vs World-Specific Logic

Whenever possible, separate:

### Shared systems
- renderer
- animation engine
- input handling
- asset loading
- entity lifecycle
- debug tooling
- generic sprite helpers
- world loading
- interaction primitives

### World-specific content
- backgrounds
- props
- sprite sets
- behavior parameters
- event rules
- themed interactions
- environmental effects
- dialogue flavor or UI flavor if applicable

Do not bury world-specific logic inside shared engine code unless absolutely necessary.

Do not add global avatar/sprite assets into a world as ambient content unless explicitly requested. Prefer world-specific elements and assets that match the scene's existing visual language.

## Sprite / Entity System

Sprites should be easy to add, test, animate, and reuse across worlds.

A good sprite system should support:
- idle animations
- walking animations
- autonomous behavior
- click / hover reactions
- layered props
- frame timing
- hitboxes
- scale controls
- z-index or depth sorting
- debug visualization where useful
- world-specific animation sets

Entity behavior should live close to the entity or in reusable behavior modules.

Examples:
- wandering
- floating
- blinking
- pulsing
- praying
- thinking
- bouncing
- reacting to cursor
- avoiding other objects
- drifting across the world
- performing occasional rare actions
- world-specific special behaviors

The entity system should make it easy to reuse patterns across worlds without forcing all worlds to feel the same.

## World Behavior

Each world should feel alive even when the user is idle.

Add ambient behavior when appropriate:
- clouds drifting
- moon faces changing
- browser windows flickering
- characters wandering
- thought bubbles appearing
- strange props animating
- cursors reacting
- UI objects blinking
- background creatures doing tiny rituals
- random but controlled world events
- world-specific idle phenomena

Randomness should feel intentional, not chaotic.

Use deterministic or seeded randomness if it helps debugging.

Different worlds can have different ambient logic and different levels of activity.

## Interaction Direction

Interactions should feel playful and weird.

Prefer:
- hover states
- click reactions
- custom cursors
- draggable or pushable objects
- tiny sound/visual feedback where supported
- browser-window interactions
- weird UI toys
- object-specific reactions
- hidden surprises
- world-specific interaction rules

Avoid generic app-feeling interactions unless they serve the world.

Interaction systems should be reusable, but worlds should be free to express different interaction styles.

## Asset Rules

Assets may come from:
- generated sprite sheets
- uploaded files
- copied external drive folders
- project-local art
- developer-side imports

Rules:
- Keep runtime assets inside the project.
- Do not depend on external drive paths.
- Do not rename files unnecessarily.
- Organize assets clearly by type and/or by world.
- Preserve source filenames when practical.
- Add notes when assets are moved from uploaded or external locations.
- Keep raw, rotoscope, processed, and runtime-ready assets distinguishable when useful.

Suggested structure:

```text
assets/
  shared/
    sprites/
    ui/
    cursors/
    effects/
  worlds/
    world-name/
      backgrounds/
      sprites/
      props/
      ui/
      data/
  raw/
  processed/
```
