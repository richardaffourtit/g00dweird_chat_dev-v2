# Present. (Tom) action sprites

Generated with the built-in image_gen tool. The approved portrait remains unchanged.

## Action-sheet generation prompt

Use case: stylized-concept. Asset: pixel-art game avatar animation sprite sheet for Present. (Tom).
REFERENCE 1 is Tom's approved avatar and is the exact character model. Preserve his recognizable face, dark upswept hair, full beard, small stud earring, orange/gold mirrored sunglasses perched on his head with eyes visible, black pullover hoodie with pale chartreuse NEOCLASSICK circular microphone logo, charcoal trousers and dark sneakers. Keep this design in EVERY pose. Reference 2 is Tee Kae's existing sheet: use its concise game-sprite pixel clusters, physical action staging, dark outlines and compact proportions ONLY; do not copy Tee Kae's face, bird, microphone, orange suit or background. Reference 3 is Tee Kae's walking reference: use its alternation of contact and passing leg silhouettes, not its character.

Create ONE meticulously aligned spritesheet on genuine transparent alpha. Requested canvas 2400 x 2000 pixels, SIX equal-width columns by FIVE equal-height rows. Each invisible cell is 400 x 400. Do not draw the grid. Top-left cell is row 1 column 1. Character is always at the SAME SCALE: upright hair-to-sole height about 330 pixels, consistent roughly 80px head height throughout, including crouching and fallen poses. Pose changes must never change anatomical scale. All upright shoe soles at y=380 within their own cell, pelvis centered at x=200. Same camera: front-three-quarter angle facing viewer's left for idle/walk/emotes; face right for attack. All pixels stay inside their cell with transparent gutters. Nothing touches a neighboring character. No captions, labels, row titles, name, numbers or background graphics. Only hoodie branding and the specified emote symbols.

EXACT GRID CONTENT, no extra poses:
ROW 1: columns 1–3 are three subtly different idle breathing/blinking frames of the approved stance: hand in hoodie pocket, opposite hand relaxed; neutral, slight inhale, blink/exhale. Columns 4–6 completely empty transparent.
ROW 2: SIX distinct sequential WALK frames, one per column, facing left. Both hands out of pockets, natural alternating arm swing, relaxed shoulders. Column 1 left foot forward/right back contact; column 2 weight-down recoil; column 3 right leg passing planted left leg; column 4 right foot forward/left back contact; column 5 opposite weight-down recoil; column 6 left leg passing planted right leg. Clearly alternate wide-contact and narrow-passing silhouettes. Preserve torso, head scale and body identity.
ROW 3: columns 1–4 are FOUR EMOTES: (1) smile with hand over heart and two small pink pixel hearts near head, (2) quizzical palm-up shrug with small cyan question mark near head, (3) confident small thumbs-up with one amber pixel sparkle near head, (4) cheerful head-bob and finger-snap with two tiny purple musical notes near head. Columns 5–6 empty. Symbols must remain inside cells.
ROW 4: columns 1–4 are FOUR ATTACK/action frames of a playful open-palm soundwave push facing right: (1) slight crouch and hand drawing back, (2) palm pushes outward with small amber concentric ripple, (3) arm extends fully and ripple expands slightly to the right, (4) arm lowers in recovery with a few fading tiny amber pixels. No weapons, microphone or extra gear. Maintain enough room within each cell for the ripple without making the character smaller. Columns 5–6 empty.
ROW 5: columns 1–4 are FOUR cartoon DIE/fall frames: (1) upright startled/dizzy with small amber swirl above head (this pose also serves as HURT); (2) losing balance and falling backward with knees bending and arms up; (3) landed on side horizontally, eyes squeezed closed; (4) resting on side horizontally, eyes closed. Retain sunglasses on his head in every pose. Anatomical body length stays same as standing height; horizontal poses use available cell width. No injury or gore. Columns 5–6 empty.

Exactly 21 character drawings total. All 5 rows required. This is a production game asset: same costume, same head size, same beard, same palette, same pixel scale across every frame. Crisp deliberate square pixels, no soft painterly rendering or photorealistic details. Genuinely transparent background, no checkerboard texture, no floor or shadows. Preserve Tom's approved likeness and outfit while reducing detail for Tee Kae-compatible game sprite scale.

## Action-sheet refinement prompt

Use case: style-transfer. Refine reference image 1, the 21-pose Present./Tom action sprite sheet. Preserve its exact five-row action organization and pose counts (3 idle, 6 walk, 4 emote, 4 attack, 4 die) but fix CHARACTER PROPORTIONS AND SPACING throughout.
Reference image 2 is the APPROVED Tom avatar: its adult face, longer torso/legs, swept hair, full beard, orange sunglasses atop head, black Neoclassick hoodie, charcoal pants and sneakers are identity/design invariants.
Reference image 3 is the ACTUAL Tee Kae runtime idle frame: use this for compact full-body GAME PROPORTIONS and physical character scale. Tom's entire hair-to-beard head should occupy approximately ONE THIRD of the hair-to-sole standing height, just like Tee Kae. Current sheet reference 1 has an oversized head and too short a body. Make Tom less chibi, with a moderately smaller head, longer torso and longer legs, matching the proportions of reference 2 and 3. Keep head and body dimensions identical across actions; crouch, walk and horizontal fall must change pose, never size. All upright bodies roughly 200 relative pixel units tall with about70-unit tall hair+face+beard.
Reference image 4 is Tee Kae's walk cycle; copy only the distinct alternating wide contact / down / narrow passing / opposite contact / down / opposite passing action mechanics.

Preserve Tom's mature distinctive long nose, slightly hooded eyes, beard shape and slight smile from APPROVED reference2; no giant anime eyes, no baby-face. The sunglasses stay on his head in EVERY pose. Crisp purposeful retro pixel art with limited color clusters and black outlines, not smooth cartoon illustration.

OUTPUT ONE large transparent PNG at 2400x2000 or similar aspect ratio. EXACTLY6 equally spaced invisible columns and EXACTLY5 rows, generous transparent gutters. Each cell must retain its own pose/effects without any overlap; especially separate the wave in attack column3 from character in column4. Same actor center and same upright foot baseline in every cell. Never rescale a character to fit effects. NO labels, titles, drawn grid or captions.
Row1: first3 cells idle neutral, slight inhale, blink/exhale, last3 empty.
Row2: all6 cells a left-facing WALK CYCLE. Clearly different legs in every frame, alternation of leading legs after frame3, appropriate alternating arm swings, stable head orientation.
Row3: first4 cells heart, question/shrug, sparkle/thumbs-up, music/finger-snap emotes; last2 empty.
Row4: first4 cells RIGHT-facing open-palm sonic push windup, release, expanded small amber ripple, recovery. Small simple amber rings fit inside each cell with clear transparent separation from neighboring pose. Last2 empty.
Row5: first4 cells upright dizzy reaction, falling backward, landed on side, resting on side. Same anatomical scale as standing poses. Last2 empty. Dizzy pose also serves hurt.
Exactly21 complete characters, no missing row, no extra frames. Genuine transparent alpha backdrop, no colored background, no floor/shadow, no checkerboard. All character interiors fully opaque; clean cutout edges. Only refine the requested proportions/likeness and spacing while keeping the character, action set, palette and clothing.

## Dedicated attack-strip prompt

Use case: stylized-concept. Create the FOUR attack animation frames for Present. (Tom), exact same pixel character design as the supplied approved avatar and action sheet. Costume/identity invariant: black pullover Neoclassick hoodie with pale chartreuse circular microphone emblem, gray pants, dark sneakers, full dark beard, dark upswept hair, small stud earring, orange mirrored sunglasses always perched above eyes.

A production transparent sprite strip in ONE HORIZONTAL ROW of EXACTLY FOUR equally spaced cells. Wide landscape 3:1 canvas. Each character complete and separate with very generous empty space around it. All four characters are drawn at identical anatomical scale, identical head size, same camera three-quarter view FACING RIGHT, same grounded shoe baseline and centered torso pivot. Never shrink a character to fit the effect. Pixel-art quality and design match references. Head + hair + beard approximately one third total standing height, adult face, compact longer-bodied game avatar similar Tee Kae.

Left to right, one continuous playful soundwave-push action:
frame1 WINDUP: feet apart, slight crouch, right hand drawn back near chest, no effect.
frame2 RELEASE: right arm and open palm push to the right, two small amber semicircular ripple lines appear a short distance ahead of palm.
frame3 EXTENSION: same lower body/pelvis, right arm fully outstretched to the right, three amber ripple lines a little farther ahead of palm. Ripple is SMALLER THAN HIS HEAD and ends well inside his own cell. Keep at least one entire head-width of empty transparency between effect and next cell/character.
frame4 RECOVERY: right arm relaxes, torso returns to ready stance, just three small fading amber pixels near palm.

Exactly FOUR Tom poses in ONE row. Same head size/torso width/leg length in all frames; crouch and hand position change only. No oversized energy balls, no full-height sonic rings. No emote symbols, text labels, numbers, captions, grid, floor, background, checkerboard, shadow, weapons or additional props. Genuine transparent alpha, opaque character interiors, crisp dark pixel outlines. Preserve approved face and outfit.

## Final proportion correction, action sheet

EDIT REFERENCE IMAGE 1. It is Tom's 21-pose sprite sheet. Change ONE thing: CHARACTER PROPORTIONS in ALL21 poses. The current characters are too big-headed and short-legged.
Required precise correction: REDUCE EVERY HEAD (hair, sunglasses, ears, face AND beard together) TO 70 PERCENT of its current width AND height. LENGTHEN EACH TORSO AND BOTH LEGS to compensate so the total upright character height remains unchanged. Head must be visibly much smaller relative to body than in image1. Do not merely stretch or enlarge the entire character. Keep head shape and Tom's recognizable face while resizing it. The result should be a longer-bodied adult mini game avatar, roughly THREE-AND-A-HALF HEADS TALL, not chibi. This visibly SMALLER HEAD is the central mandatory edit.

REFERENCE2 is the approved Tom portrait and gives the correct identity, face and proportion feel. REFERENCE3 is Tee Kae standing frame and gives the correct head/body relationship. Match Tee Kae's head scale at equal overall standing height. In image1 a standing figure is about235px high with ~100px head width; target the SAME235px overall height with head width about68px and hair-to-beard height about80px. Allocate the remaining height to torso and longer legs. At game export201px standing height his head should be about55–60px wide, not75px wide.

Preserve the 1374x1145 canvas or exact same aspect ratio, transparent background, same five rows and same individual character centers. Exact same 21 poses and positions: idle3 row1, walk6 row2, emotes4 row3, attacks4 row4, falls4 row5. Preserve outfit, orange sunglasses, hoodie emblem, charcoal pants, sneakers, hand gestures, emote symbols and attack effects. Do not add or remove poses, rows, columns, symbols or props. In the upright hurt/dizzy pose at row5 col1 keep the same anatomical size as standing idle; its head must match the other heads and its torso/legs need to be long enough to prevent shrinking. In fallen poses resize head and lengthen the torso/legs so total anatomical length stays the same as the standing character.
Pixel art, clean opaque interiors, sharp dark outlines, real transparent alpha. No background checkerboard, no shadows, no labels. Show a OBVIOUS REDUCTION IN HEAD SIZE in every pose and longer body and legs.

## Final proportion correction, attack strip

EDIT REFERENCE IMAGE1, the four-frame Tom attack strip. ONE correction: shrink all FOUR heads, including hair, sunglasses, ears, face and beard, to70% of their current width and height. Compensate with longer torsos and legs so the total actor height remains unchanged. Make the adult character visibly less chibi and longer-bodied. This should be an obvious head-size reduction, not just a slight face edit or rescaling the whole body.
Reference2 is the CORRECTED Tom action sheet; match exactly its new SMALLER HEAD and longer-body proportions. Reference3 is approved Tom avatar for face/clothing identity.
Preserve the SAME2172x724 canvas or exact3:1aspect, SAME4poses in ONE horizontal row, same centers, same foot baseline, same stable pelvis pivot, same outfit, same orange glasses above eyes, same facial identity, same four distinct stages of right-facing open-palm sound-wave attack. Small amber ripples stay separated within respective cells. Every head stays same size between poses. Characters should be about3.5heads tall when standing. Do not draw large childlike heads. Clean crisp pixel-art edges, genuine transparent alpha, no checkerboard or backdrop, no labels. Keep all poses/effects completely isolated. Mandatory: shrink heads70%, longer body/legs, unchanged total actor height.


## Walk correction: anatomical near/far gait

Built-in image_gen used to redraw only the walk. The final art follows an explicit six-pose joint guide (`present-walk-pose-guide.png`).

Create a production six-frame pixel-art walking animation of Tom (Present.). REFERENCE1 is a mandatory JOINT POSITION / POSE GUIDE. REFERENCE2 is the approved character design and pixel-art appearance. REFERENCE3 is extra facial identity detail.
DRESS THE SIX POSE-GUIDE SKELETONS AS TOM, preserving each guide's exact joint configuration, relative limb placement and foot-contact pattern. The guide solves the walk motion; do not replace its six poses with generic walking stances.

The BLUE arm/leg are the NEAR limbs, always closer to camera, on TOP of the far limbs. The PURPLE arm/leg are the FAR limbs, behind. In final artwork the BLUE parts become lighter charcoal-black hoodie sleeve / charcoal pants and the PURPLE parts become distinctly darker shadowed charcoal sleeve / pants. Keep all clothing within the approved black-and-gray palette. NO BLUE OR PURPLE in final clothes. Crucially the NEAR LEG is forward in1, beneath body in2, BACK in3and4, lifted BACK in5, lifted FORWARD in6. The FAR leg does the opposite. Frame4 has the near leg BACK and far leg FORWARD, unlike frame1. Preserve the guide's blue-to-purple crossing order when drawing pants. Near arm in1 goes BACK, near arm in4 goes FORWARD. At frames2,3,5,6 the guide's raised shoe is OFF GROUND. Trace the guide closely; these are six consecutive frames of a SINGLE continuous gait cycle, not six independent poses. Retain small natural bends rather than rigid sticks, but never change which limb is forward/back or planted/lifted.

Same Tom in each cell: slim adult, small head/body relationship as approved reference2, dark swept-up hair, full beard, orange mirrored sunglasses perched above visible eyes, black pullover hoodie with pale chartreuse circular microphone/Neoclassick emblem, gray pants, dark sneakers. Preserve exact identity/costume and constant head size/torso size/leg lengths in every frame. Head faces LEFT with slight three-quarter visibility like reference2, fixed viewing direction. Upright stable head and torso with subtle natural bob. Crisp deliberate square pixel clusters, limited palette, dark outlines, no soft painting.

Output SAME2160x724or3:1 canvas as the guide: ONE horizontal row of SIX equally spaced full-body sprites. Each actor pelvis centered in its cell, same shoe contact baseline as guide, consistent full-body height. No drifting. Each cell has ample transparent gutter. Genuine transparent alpha, opaque character interiors, no checkerboard/background, no ground line, no guide skeleton, no colored limb diagram, no text/numbers/labels, no shadows or effects.
MANDATORY: follow all six DIFFERENT rig poses, especially the reversed near/far leg and arm in frames4–6. Anatomically believable walk, arms oppose legs.


## Walk head-size consistency pass

EDIT reference image1, the SIX-FRAME Tom walk strip. Make ONE precise proportion correction while preserving the successful new walking poses.
INCREASE each head — hair, sunglasses, ears, face, and beard as one group — to 118% of its current WIDTH and HEIGHT, consistently across all6frames. Reference2 shows the target head-to-body proportion from the approved idle avatar. At equal overall character height, the current walking head is about15% too narrow; it needs to be18% larger.
Keep the TOP OF THE HAIR at its CURRENT vertical coordinate, and grow the head downward and equally outward left/right around its center. Let the beard/neck joint sit slightly lower by shortening only the upper hoodie/neck area. Keep the exact SAME total hair-to-shoe height, fixed pelvis positions, and same foot baseline. Do not scale the whole body. Do not move shoes, knees, hips, elbows or hands. Keep the 2166x726canvas and all6character centers. The larger head now covers a little more of the upper chest/collar region, giving the approved compact character proportions, while legs/arms stay exactly posed.
Mandatory invariants: preserve all SIX distinct leg configurations, near/far limb identity and shading, walking silhouette, foot contacts, raised shoes in passing frames, alternating arm swings, and limb layer order. Do NOT redraw the gait into different poses. The first near leg points forward and fourth near leg points backward; preserve this opposition. Keep the same left-facing camera angle in all frames.
Exact same face, full beard, swept dark hair, orange mirrored sunglasses perched above eyes, black pullover Neoclassick hoodie with pale chartreuse circular emblem, charcoal trousers, dark sneakers. Same crisp pixel-art rendering, actual transparent alpha background, opaque body, clean gutters, no labels, no backdrop or shadows. Only fix heads to118% size with crown fixed and slightly shorter neck/upper torso. All other artwork should remain as close as possible to image1.

## Cross-action proportion correction — built-in image_gen

### Proportion consistency pass 1

Use case: identity-preserve
Asset type: production transparent pixel-art six-frame walk sprite sheet.

Image 1 is the EDIT TARGET: the existing six-frame walking sheet. Image 2 is the canonical idle model and Image 3 is the matching emote model. These show the correct anatomy and hoodie fit. Correct ONLY the walk character proportions to match the idle/emote model EXACTLY. The walk currently has a vertically compressed head and torso, overly long legs, and a chest badge sitting too high.

Maintain image 1's exact six different leg/arm poses, same left three-quarter facing, same horizontal centers, six equal cells, transparent background, 2167x726 canvas. Preserve alternating front/back legs, foot lift, planted feet and opposite arm swings in their existing order. No change in gait design. Each figure must have the same model as image 2: slightly taller lower face/beard/neck, taller fuller hoodie torso, correspondingly shorter legs. Do NOT make the entire character taller or enlarge the entire sprite. Maintain current crown and planted sole positions. Keep current head WIDTH, extend head/neck HEIGHT downward by approximately 6% of head height. Extend hoodie body downward so hem is about 11 runtime pixels lower, reduce leg length accordingly. The circular cream Neoclassick chest print must be the same size and placement below the neckline as idle/emote, centered about 10 runtime pixels LOWER than current walk print. Maintain this exact badge anchor, proportions, shape and lettering across all six walk frames, naturally occluded only by the existing swinging foreground arms.

To make the geometry precise: relative to a 201-pixel-tall visible figure (from hair crown to sole), the target neck/skin bottom is 77 pixels below crown; the top of chest lettering is 86 pixels below crown; the chest badge measures approx 25 pixels wide and 26 tall; hoodie hem 133 pixels below crown; sole 201 pixels below crown. ALL six walk figures must use these same anatomical dimensions. Their head width is approximately 61 pixels. The current walk wrongly has neck bottom at 71, badge top at77, and hem at122 below crown. Please fix those specific ratios. In the high-resolution target sheet these coordinates should scale proportionately. Do not add guides or text annotations.

Identity/style invariants: exactly the same Tom as reference2, brown swept-up hair, orange sunglasses on head, full dark beard, expressive face, black hoodie, cream circular Neoclassick microphone badge, charcoal pants, black sneakers. Match the idle/emote pixel-art style. No new objects, no new facial expression, no effects. Preserve real transparent alpha, generous transparent margins, no background, shadows, labels, guide lines or grid. This is a precise consistency edit to an approved character, not a redesign.

### Proportion consistency pass 2

Use case: identity-preserve
Edit Image 1, the six-frame sprite sheet. Image 2 is the approved idle character size/proportions. Image 3 shows the exact original walking poses to retain.
The first edit improved the proportions but the hoodie is STILL too short and thin and the head/neck is still too short compared to Image 2. Make a precise SECOND proportional correction without changing the overall crown-to-sole height or head width:
1. Lengthen the lower head and neck downward another 3% of the complete head height, maintaining the face identity.
2. Lengthen the hoodie torso downward another 7% of its current height; lower the hoodie hem, lower the crotch correspondingly, and shorten the legs so soles stay at their original positions.
3. Enlarge the cream circular Neoclassick print about 10% in width and height, and lower its top edge another 4 pixels on a 201-pixel-tall figure (equivalent about 12 pixels in this source sheet). EXACTLY match Image 2's head-to-logo-to-waist spacing and widths. The original walk figure is too skinny/long-legged: torso must be as full and chunky as Image 2. Preserve a SINGLE consistent badge position/scale across all six frames.
4. In frame 4 (fourth character from left), restore the foreground arm swinging ACROSS the chest toward screen-left, as in the FOURTH character of Image 3. It must NOT have the same arms as frame1. Frame3 and4 must have crossing-forward arms; frames1 and6 have arms behind. Preserve original alternating leg poses exactly, both feet must not get swapped/repeated.
5. Preserve image1 head crown and planted sole coordinates, left-facing orientation, orange sunglasses, brown hair/beard, black hoodie and charcoal pants, skin tone, exact pixel-art style, identity. Six evenly spaced cells in one row, 2167x726, fully transparent background. The head width must stay the same; do not enlarge the whole image.
The final result should visually look like Image 2 has started walking, not like a different taller/leaner version of the character. No effects or additional text, no guides.

### Proportion consistency pass 3

Use case: precise-object-edit.
Make exactly TWO small corrections to the six walking characters in image1, using image2 (idle) and image3 (emote) as proportion references.
1) Narrow each HEAD ONLY by 5 percent horizontally around its existing centerline, without changing its vertical height, crown, chin/neck, body, sunglasses design, hair or face. Runtime head width needs to be approx61px rather than current65px. Do not shrink head height or character height. Same head shape and width across all six.
2) Move each cream Neoclassick badge DOWN 10 pixels in this 2167x726 source image (approximately 3–4px on the runtime 201px-tall figure). Do not resize or redesign the badge. It should have more black hoodie fabric between neckline/drawstrings and the badge, exactly matching the spacing in image2/3. Lettering should be at the same local body position in every frame. In frames3 and4 the foreground arm remains over the print; the shifted print must be naturally hidden behind that arm.
EVERYTHING else is already correct: preserve hoodie hem position and size, torso width and height, pants and leg lengths, six existing foot/leg/arm poses, identity, style, alpha silhouette, same canvas dimensions2167x726 and framing. Maintain crown and planted sole positions. Preserve the exact six-frame walking sequence including the foreground arm crossing the chest in frames3 and4. Change only head width and vertical badge placement. Transparent background, no effects, no guides, no text outside the existing hoodie print.

### Proportion consistency pass 4

Use case: precise-object-edit. Correct the over-narrowed heads in this walk sheet.
Image 1 is the target to edit. It now has correct torso, leg and logo placement but the heads became TOO NARROW in the previous edit. Image 2 is the correct idle model.
WIDEN ONLY each of the six heads horizontally by 20 percent (one fifth), maintaining the exact head height and vertical position. Their current source head widths are 158–161 pixels; the desired head width is 189–193 pixels. Keep each head centered on its current neck. They should regain the fuller face/hair silhouette of image2, not a thin stretched face. Target the same head width-to-height ratio as image2.
Every other pixel/feature should be preserved as closely as possible: do not move or alter the chest badge (its new lower position is correct), hoodie/torso shape, hem, arm and hand poses, legs, shoes, overall scale, height, or framing. Same six distinct walk poses. Preserve current foreground arms crossing the chest in frames3/4. Keep head vertical size, beard identity, hair, orange sunglasses design, ears, skin tone and gaze. Output same transparent2167x726 sheet. Only restore head WIDTH to approx190 source pixels in each cell. No background or effects.

## Shared character model — revision 5

Generation mode: built-in image_gen, attack edit. The final generated attack source is g00dweird_avatar_present_attack-v5-source.png. Pose assembly then reuses the approved Idle head at its exact pixel scale for all Walk frames, and mirrored for all Attack frames. See scripts/present_model.py. This prevents facial redrawing between actions while preserving the generated body poses and effects.

### Attack proportion edit

Use case: identity-preserve
Asset type: transparent four-frame pixel-art attack sprite sheet.
Image1 is the attack sheet to edit. Image2 is the approved IDLE model and absolute anatomy/identity reference.
Correct Image1's four figures to use Image2's exact character proportions. Maintain the four attack poses in their existing order, right-facing orientation, palm soundwave effects, and cell positions. The existing attack figure has a head about15percent too short and12percent too narrow, a torso that ends too high, and legs that are too long.
Enlarge the attack HEADS to match the idle model's fuller62px-wide by78px-high head when the complete character is201px tall. Copy the same idle face geometry, nose, eyes, eyebrow shape, cheek, beard, jaw, hair and orange sunglasses, mirrored for facing right. Faces must not be a different character. Lower the neckline so the enlarged head joins the hoodie naturally. Lower the hoodie hem about8pixels relative to a201px-tall character, and shorten the legs to preserve the existing ground/sole position. Maintain the stance bend and width. The hoodie must have the same torso size and fit as idle, with the same approx26x25pixel cream circular Neoclassick print, positioned at the same neckline-to-print spacing. Do not shrink character to fit effects.
Target anatomical landmarks for the actor relative to top of hair: neckline77px below crown; chest lettering86px below crown; hoodie hem133px below crown; soles201px below crown. Four figures must share the same anatomy, clothing proportions, scale, head/face and badge across every frame. Only arm articulation and the existing orange soundwave effects change between frames.
Preserve transparent background; single horizontal row of four well-separated cells; canvas2172x724; no captions, guide lines, grid, ground shadows or new elements. Crisp pixel art and identical outfit. Keep existing attack1 anticipation, attack2 palm release, attack3 larger wave, attack4 recovery.
