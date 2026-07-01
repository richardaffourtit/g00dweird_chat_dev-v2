import React, { useEffect, useRef } from "react";

/**
 * Animated sprite renderer driven by /public/anim/{creature}/{state}_{n}.png frames.
 *
 * `version` cache-busts when assets are re-sliced.
 *
 * State system per creature:
 *   - idle (always)
 *   - SLOW move: walk | float | hop | wiggle  (creature-specific)
 *   - FAST move: run | dash | hop             (creature-specific)
 *   - JUMP    : jump | hop                    (creature-specific)
 *   - ATTACK  : attack | action               (action used for melee creatures)
 *   - HURT, DIE
 *   - emote_a / emote_b / emote_c / emote_d   (user-pickable poses)
 *   - split (slime), talk/think/glitch/react (weirdbot), etc.
 *
 * STATE_ALIASES maps requested-but-missing states onto sensible existing frames.
 */

export const ANIM_VERSION = 30;

// Frame counts per creature/state — mirrors slicer v3 / unified output.
export const FRAMES = {
    alien:    { idle: 3, walk: 4, run: 4, jump: 3, attack: 5, hurt: 2, die: 2,
                emote_a: 1, emote_b: 1, emote_c: 1, emote_d: 1 },
    ape:      { idle: 3, walk: 4, jump: 3, action: 4, hurt: 3, die: 3,
                emote_a: 1, emote_b: 1, emote_c: 1, emote_d: 1 },
    cat:      { idle: 3, walk: 4, jump: 3, action: 4, hurt: 3, die: 4,
                emote_a: 1, emote_b: 1, emote_c: 1, emote_d: 1 },
    fairy:    { idle: 3, walk: 4, jump: 3, action: 4, hurt: 3, die: 3,
                emote_a: 1, emote_b: 1, emote_c: 1, emote_d: 1 },
    frog:     { idle: 3, hop: 4, jump: 3, action: 5, hurt: 3, die: 3,
                emote_a: 1, emote_b: 1, emote_c: 1, emote_d: 1 },
    ghost:    { idle: 3, float: 4, dash: 3, action: 4, hurt: 3, die: 4,
                emote_a: 1, emote_b: 1, emote_c: 1, emote_d: 1 },
    robot:    { idle: 3, walk: 4, jump: 3, action: 4, hurt: 3, die: 3,
                emote_a: 1, emote_b: 1, emote_c: 1, emote_d: 1 },
    skeleton: { idle: 3, walk: 4, run: 4, jump: 3, attack: 4, hurt: 2, die: 2,
                emote_a: 1, emote_b: 1, emote_c: 1, emote_d: 1 },
    slime:    { idle: 3, wiggle: 4, hop: 4, split: 5, attack: 4, hurt: 2, die: 2,
                emote_a: 1, emote_b: 1, emote_c: 1, emote_d: 1 },
    tvhead:   { idle: 3, walk: 4, run: 4, jump: 3, attack: 5, hurt: 2, die: 2,
                emote_a: 1, emote_b: 1, emote_c: 1, emote_d: 1 },
    weirdbot: { idle: 4, talk: 4, think: 4, walk: 6, glitch: 4, react: 4 },
};

// Per-creature aliases — for melee creatures, `attack` maps onto the `action` row.
export const STATE_ALIASES = {
    ape:   { attack: "action" },
    cat:   { attack: "action" },
    fairy: { attack: "action" },
    frog:  { attack: "action" },
    ghost: { attack: "action" },
    robot: { attack: "action" },
    weirdbot: { attack: "react", hurt: "glitch", die: "glitch" },
};

export const ANIM_CREATURES = Object.keys(FRAMES);
const ANIM_CREATURE_SET = new Set(ANIM_CREATURES);

export function sanitizeAnimCreature(creature) {
    return ANIM_CREATURE_SET.has(creature) ? creature : null;
}

export function shouldUseCleanedSprites(env = process.env) {
    return env?.REACT_APP_USE_CLEANED_SPRITES !== "0";
}

const USE_CLEANED_SPRITES = shouldUseCleanedSprites();

let cleanedSpriteManifest = null;
let cleanedSpriteManifestLoading = false;
const cleanedSpriteSubscribers = new Set();

function publicUrlFromOutput(outputSheet) {
    if (!outputSheet) return "";
    const marker = "frontend/public/";
    return outputSheet.includes(marker) ? `/${outputSheet.split(marker, 2)[1]}` : `/${outputSheet.replace(/^\/+/, "")}`;
}

function cleanedFrameSrc(creature, state, frame) {
    const id = `anim-${creature}-${state}_${frame}`;
    if (cleanedSpriteManifest === null) {
        return `/assets/cleaned-sprites/${id}.png?v=${ANIM_VERSION}`;
    }
    const item = cleanedSpriteManifest?.[id];
    return item ? `${publicUrlFromOutput(item.outputSheet)}?v=${ANIM_VERSION}` : null;
}

function ensureCleanedSpriteManifest() {
    if (!USE_CLEANED_SPRITES) return;
    if (cleanedSpriteManifest || cleanedSpriteManifestLoading || typeof window === "undefined") return;
    cleanedSpriteManifestLoading = true;
    fetch(`/assets/cleaned-sprites/manifest.json?v=${ANIM_VERSION}`)
        .then((response) => (response.ok ? response.json() : { sprites: [] }))
        .then((data) => {
            cleanedSpriteManifest = Object.fromEntries((data.sprites || []).map((item) => [item.id, item]));
            cleanedSpriteSubscribers.forEach((subscriber) => subscriber());
        })
        .catch(() => {
            cleanedSpriteManifest = {};
        })
        .finally(() => {
            cleanedSpriteManifestLoading = false;
        });
}

function frameSrc(creature, state, frame) {
    const cleaned = USE_CLEANED_SPRITES ? cleanedFrameSrc(creature, state, frame) : null;
    if (cleaned) return cleaned;
    return `/anim/${creature}/${state}_${frame}.png?v=${ANIM_VERSION}`;
}

const preloadedFrameSets = new Set();
const spriteFrameSubscribers = new Set();
let spriteTickerRaf = null;

function spriteTickerStep(ts) {
    for (const subscriber of spriteFrameSubscribers) subscriber(ts);
    spriteTickerRaf = spriteFrameSubscribers.size
        ? window.requestAnimationFrame(spriteTickerStep)
        : null;
}

function subscribeSpriteFrames(subscriber) {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
        return () => {};
    }
    spriteFrameSubscribers.add(subscriber);
    if (!spriteTickerRaf) {
        spriteTickerRaf = window.requestAnimationFrame(spriteTickerStep);
    }
    return () => {
        spriteFrameSubscribers.delete(subscriber);
        if (spriteFrameSubscribers.size === 0 && spriteTickerRaf) {
            window.cancelAnimationFrame(spriteTickerRaf);
            spriteTickerRaf = null;
        }
    };
}

function preloadFrames(creature, state, count) {
    if (typeof window === "undefined" || typeof window.Image !== "function") return;
    const key = `${creature}:${state}:${count}:${ANIM_VERSION}`;
    if (preloadedFrameSets.has(key)) return;
    preloadedFrameSets.add(key);
    for (let i = 0; i < count; i++) {
        const im = new Image();
        im.decoding = "async";
        im.src = frameSrc(creature, state, i);
    }
}

export function getAvailableStates(creature) {
    return Object.keys(FRAMES[creature] || {});
}

export function resolveState(creature, wanted) {
    const avail = FRAMES[creature];
    if (!avail) return "idle";
    if (avail[wanted]) return wanted;
    const alias = STATE_ALIASES[creature]?.[wanted];
    if (alias && avail[alias]) return alias;
    if (avail.idle) return "idle";
    return Object.keys(avail)[0];
}

export function spriteFrameBox(creature, state, size) {
    if (creature === "weirdbot" && state === "walk") {
        return {
            width: Math.round(size * 1.24),
            height: size,
        };
    }
    return null;
}

export function spriteVisualEffect(creature) {
    if (creature === "slime") {
        return {
            filter: "hue-rotate(0deg) saturate(1.45) contrast(1.08) drop-shadow(0 1px 0 rgba(0,0,0,0.55))",
            animation: "slime-chroma-cycle 8s linear infinite",
            willChange: "filter, transform",
        };
    }
    return {};
}

// ---- Locomotion mapping (per spec) ----
// SLOW: walk | float | hop | wiggle
// FAST: run | dash | hop | walk (fallback)
// JUMP: jump | hop
export function pickTravelStance(creature, dist, dy = 0) {
    const F = FRAMES[creature] || {};
    const isFar = dist > 260;
    const isVertical = Math.abs(dy) > 110;

    if (isVertical) {
        if (F.dive) return "dive";
        if (F.jump) return "jump";
        if (F.hop) return "hop";
        if (F.fly) return "fly";
    }
    if (isFar) {
        if (F.run) return "run";
        if (F.dash) return "dash";
        if (F.fly) return "fly";
        if (F.hop) return "hop";
        if (F.walk) return "walk";
        if (F.float) return "float";
        if (F.sway) return "sway";
    }
    if (F.walk) return "walk";
    if (F.float) return "float";
    if (F.fly) return "fly";
    if (F.hop) return "hop";
    if (F.wiggle) return "wiggle";
    if (F.sway) return "sway";
    return "idle";
}

// Per-creature display labels for the 4 emotes (used by the picker).
// Each creature has 4 emote slots; labels match the symbols on the sprite sheet.
export const EMOTE_LABELS = {
    alien:    { emote_a: "?", emote_b: "♥", emote_c: "!", emote_d: "z" },
    ape:      { emote_a: "?", emote_b: "♥", emote_c: "✨", emote_d: "!" },
    cat:      { emote_a: "?", emote_b: "♥", emote_c: "z", emote_d: "ooo" },
    fairy:    { emote_a: "♥", emote_b: "✨", emote_c: "!!", emote_d: "T_T" },
    frog:     { emote_a: "^_^", emote_b: "z", emote_c: "!", emote_d: ">:(" },
    ghost:    { emote_a: "?", emote_b: "♥", emote_c: "!", emote_d: "z" },
    robot:    { emote_a: "✌", emote_b: "?", emote_c: "♥", emote_d: "x_x" },
    skeleton: { emote_a: "?", emote_b: "♥", emote_c: "!", emote_d: "x_x" },
    slime:    { emote_a: "?", emote_b: "♥", emote_c: "!", emote_d: "z" },
    tvhead:   { emote_a: "?", emote_b: "♥", emote_c: "!", emote_d: "><" },
};

export default function AnimSprite({
    creature, state = "idle", size = 64, fps = 8,
    paused = false, flip = false, testId, alt = "",
    frameWidth = null, frameHeight = null,
}) {
    const renderCreature = sanitizeAnimCreature(creature) || "ghost";
    const resolved = resolveState(renderCreature, state);
    const rawCount = (FRAMES[renderCreature] && FRAMES[renderCreature][resolved]) || 1;
    const steadyIdle = renderCreature === "cat" && resolved === "idle";
    const count = steadyIdle ? 1 : rawCount;
    const imgRef = useRef(null);
    const lastRef = useRef(0);
    const frameRef = useRef(0);

    useEffect(() => {
        ensureCleanedSpriteManifest();
        const refresh = () => {
            if (imgRef.current) imgRef.current.src = frameSrc(renderCreature, resolved, frameRef.current);
        };
        cleanedSpriteSubscribers.add(refresh);
        return () => cleanedSpriteSubscribers.delete(refresh);
    }, [renderCreature, resolved]);

    // Reset frame on creature/state change without triggering a React render per animation tick.
    useEffect(() => {
        frameRef.current = 0;
        lastRef.current = 0;
        if (imgRef.current) {
            imgRef.current.src = frameSrc(renderCreature, resolved, 0);
        }
    }, [renderCreature, resolved, count]);

    // Preload all frames so swaps come from cache
    useEffect(() => {
        preloadFrames(renderCreature, resolved, count);
    }, [renderCreature, resolved, count]);

    // Shared RAF ticker: one frame loop drives every animated sprite instance.
    useEffect(() => {
        if (paused || count <= 1) return undefined;
        const step = (t) => {
            const frameMs = Math.max(16, 1000 / Math.max(1, fps || 1));
            if (!lastRef.current) {
                lastRef.current = t;
                return;
            }
            const elapsed = t - lastRef.current;
            if (elapsed >= frameMs) {
                const framesToAdvance = Math.max(1, Math.floor(elapsed / frameMs));
                lastRef.current += framesToAdvance * frameMs;
                frameRef.current = (frameRef.current + framesToAdvance) % count;
                if (imgRef.current) {
                    imgRef.current.src = frameSrc(renderCreature, resolved, frameRef.current);
                }
            }
        };
        const unsubscribe = subscribeSpriteFrames(step);
        return () => {
            unsubscribe();
            lastRef.current = 0;
        };
    }, [renderCreature, resolved, count, fps, paused]);

    const src = frameSrc(renderCreature, resolved, 0);
    const isGhost = renderCreature === "ghost";
    const ghostGlow = isGhost
        ? "drop-shadow(0 0 2px rgba(190,255,232,0.95)) drop-shadow(0 0 7px rgba(86,255,214,0.78)) drop-shadow(0 0 14px rgba(112,192,255,0.55))"
        : undefined;
    const visualEffect = spriteVisualEffect(renderCreature);
    const filter = [ghostGlow, visualEffect.filter].filter(Boolean).join(" ") || undefined;
    const fixedFrame = Number.isFinite(frameWidth) && Number.isFinite(frameHeight);
    const frameBox = fixedFrame
        ? { width: frameWidth, height: frameHeight }
        : spriteFrameBox(renderCreature, resolved, size);

    return (
        <img
            ref={imgRef}
            src={src}
            alt={alt}
            data-testid={testId}
            draggable={false}
            style={{
                height: frameBox ? frameBox.height : size,
                width: frameBox ? frameBox.width : "auto",
                objectFit: frameBox ? "contain" : undefined,
                objectPosition: frameBox ? "center bottom" : undefined,
                imageRendering: "pixelated",
                display: "block",
                position: "relative",
                zIndex: 1,
                filter,
                animation: visualEffect.animation,
                transform: flip ? "scaleX(-1)" : "none",
                willChange: visualEffect.willChange || (isGhost ? "filter, transform" : "transform"),
            }}
        />
    );
}
