# Halloween Town lighting layers

Generated with the built-in imagegen tool from `/worlds/halloween.png`. Original artwork is retained. Both runtime layers keep the original 1254 × 1254 framing.

## Background prompt

Use case: precise-object-edit
Asset type: separated background plate for an existing pixel-art isometric Halloween chat world.
Input image 1 is the edit target. Preserve the exact square canvas, pixel-art style, purple color palette, moon location/size, clouds, stars and distant tiny floating islands.
Primary request: remove ONLY the entire large main foreground island and everything standing on it (the large clocktower building, market, plaza, graveyard, spiral hill in front of the moon, trees, gates, front stairs and the large dangling rock mass). Fill the area naturally with the same continuous purple night sky, violet clouds and small distant floating islands. Reconstruct the full circular pale yellow moon behind the removed spiral hill.
Keep all existing background pixels, camera, composition and colors unchanged wherever possible. The result is the empty distant background layer behind the town, no large objects, no new town, no text, no border. Opaque full canvas.

## Foreground prompt

Use case: background-extraction
Asset type: pixel-perfect foreground layer for an existing pixel art isometric game room.
Input image 1 is the edit target. Extract the ENTIRE large central main island with all its existing objects: clocktower building, leafless trees and their thin curling branches, market, plaza cobblestones, graveyard, curled spiral hill, iron fences, lanterns, front stairs, and the large dangling purple rock underside.
Remove only the distant background: sky, moon, clouds, stars, and small faraway floating islands. Replace those areas with GENUINE alpha transparency, including gaps between branches and around fences.
CRITICAL: keep the original 1254 by 1254 square framing and positions. Do not recenter, rescale, zoom, move, redraw, recolor, or redesign any part of the central island. All its pixels and lighting should look exactly like the input. The top clocktower still touches the top canvas edge and the bottom island tip still touches bottom edge. Return one RGBA foreground cutout on truly transparent background; no checkerboard painted into image, no shadow outside silhouette, no text.

## Runtime

- `/assets/halloween/scene/background.png`: reconstructed distant sky.
- `/assets/halloween/scene/foreground.png`: transparent town/island.
- `HalloweenLighting.jsx`: lantern cutout masks, stepped lightning, directional cast shadows.
- The original room image remains the loading/failure fallback. Storms wait for both layers, pause offscreen/in a hidden tab, and remain off with reduced motion.
