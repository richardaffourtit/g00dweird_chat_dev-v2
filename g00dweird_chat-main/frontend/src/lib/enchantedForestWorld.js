export const ENCHANTED_FOREST_WORLD = {
    id: "enchanted-forest-v2",
    name: "Enchanted Forest",
    width: 1774,
    height: 887,
    zoom: 2.45,
    speed: 212,
    avatarStart: { x: 864, y: 570 },
    assets: {
        forest: "/assets/worlds/enchanted-forest/forest.png",
        depth: "/assets/worlds/enchanted-forest/depth.png",
        shadow: "/assets/worlds/enchanted-forest/shadow-alpha.png",
    },
};

export const ENCHANTED_FOREST_AVATAR_FRAME = {
    width: 44,
    height: 52,
};

const AXIS_KEYS = {
    north: ["arrowup", "w"],
    south: ["arrowdown", "s"],
    west: ["arrowleft", "a"],
    east: ["arrowright", "d"],
};

const DIAGONAL_KEYS = {
    q: { x: -1, y: -1, label: "NW" },
    e: { x: 1, y: -1, label: "NE" },
    z: { x: -1, y: 1, label: "SW" },
    c: { x: 1, y: 1, label: "SE" },
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizedKeySet(keys) {
    return new Set(
        [...(keys || [])]
            .map((key) => String(key).toLowerCase())
            .filter(Boolean)
    );
}

function hasAny(keys, names) {
    return names.some((name) => keys.has(name));
}

function directionLabel(x, y) {
    if (!x && !y) return null;
    const vertical = y < 0 ? "N" : y > 0 ? "S" : "";
    const horizontal = x < 0 ? "W" : x > 0 ? "E" : "";
    return `${vertical}${horizontal}`;
}

export function movementVectorFromKeys(rawKeys) {
    const keys = normalizedKeySet(rawKeys);
    let x = 0;
    let y = 0;

    if (hasAny(keys, AXIS_KEYS.north)) y -= 1;
    if (hasAny(keys, AXIS_KEYS.south)) y += 1;
    if (hasAny(keys, AXIS_KEYS.west)) x -= 1;
    if (hasAny(keys, AXIS_KEYS.east)) x += 1;

    if (x === 0 && y === 0) {
        const diagonalKey = Object.keys(DIAGONAL_KEYS).find((key) => keys.has(key));
        if (diagonalKey) {
            const diagonal = DIAGONAL_KEYS[diagonalKey];
            const length = Math.hypot(diagonal.x, diagonal.y);
            return {
                x: diagonal.x / length,
                y: diagonal.y / length,
                label: diagonal.label,
            };
        }
    }

    if (x === 0 && y === 0) return { x: 0, y: 0, label: null };
    const length = Math.hypot(x, y);
    return {
        x: x / length,
        y: y / length,
        label: directionLabel(x, y),
    };
}

export function constrainWorldCamera(focus, viewport, world = ENCHANTED_FOREST_WORLD, zoom = world.zoom) {
    const viewportW = Math.max(1, Number(viewport?.width) || 1);
    const viewportH = Math.max(1, Number(viewport?.height) || 1);
    const worldW = Math.max(1, Number(world?.width) || ENCHANTED_FOREST_WORLD.width);
    const worldH = Math.max(1, Number(world?.height) || ENCHANTED_FOREST_WORLD.height);
    const scale = Math.max(0.1, Number(zoom) || 1);
    const scaledW = worldW * scale;
    const scaledH = worldH * scale;
    const rawX = (viewportW / 2) - (Number(focus?.x) || 0) * scale;
    const rawY = (viewportH / 2) - (Number(focus?.y) || 0) * scale;
    const x = scaledW <= viewportW
        ? (viewportW - scaledW) / 2
        : clamp(rawX, viewportW - scaledW, 0);
    const y = scaledH <= viewportH
        ? (viewportH - scaledH) / 2
        : clamp(rawY, viewportH - scaledH, 0);

    return {
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        scaledWidth: scaledW,
        scaledHeight: scaledH,
    };
}

export function isForestWalkable(samples, options = {}) {
    const minDepth = Number.isFinite(options.minDepth) ? options.minDepth : 0.08;
    const depth = clamp(Number(samples?.depth) || 0, 0, 1);
    return depth >= minDepth;
}

export function forestAvatarStyleFromMaps(samples, options = {}) {
    const depth = clamp(Number(samples?.depth) || 0, 0, 1);
    const shadow = clamp(Number(samples?.shadow) || 0, 0, 1);
    const depthT = clamp((depth - 0.08) / 0.84, 0, 1);
    const scale = 0.72 + depthT * 0.48;
    const shadowOpacity = clamp(0.14 + shadow * 0.44 + depthT * 0.08, 0.12, 0.72);
    const shadowScale = clamp(0.74 + depthT * 0.52 - shadow * 0.08, 0.58, 1.28);
    const brightness = clamp(0.86 + depthT * 0.16 - shadow * 0.2, 0.62, 1.12);
    const saturation = clamp(0.9 + depthT * 0.16 - shadow * 0.08, 0.74, 1.18);
    const lift = Math.round(-2 - depthT * 8);
    const zBase = Number.isFinite(options.zBase) ? options.zBase : 300;

    return {
        walkable: isForestWalkable({ depth, shadow }, options),
        scale: Math.round(scale * 1000) / 1000,
        lift,
        shadowOpacity: Math.round(shadowOpacity * 1000) / 1000,
        shadowScale: Math.round(shadowScale * 1000) / 1000,
        filter: `brightness(${brightness.toFixed(3)}) saturate(${saturation.toFixed(3)}) drop-shadow(0 8px 8px rgba(0,0,0,${(0.18 + shadow * 0.24).toFixed(3)}))`,
        zIndex: zBase + Math.round(depthT * 260),
    };
}

function clampToWorld(point, world) {
    return {
        x: clamp(Number(point?.x) || 0, 0, world.width),
        y: clamp(Number(point?.y) || 0, 0, world.height),
    };
}

function walkableAt(point, sampler, world, options) {
    const bounded = clampToWorld(point, world);
    return isForestWalkable(sampler(bounded), options);
}

export function resolveForestMove(
    current,
    desired,
    sampler,
    world = ENCHANTED_FOREST_WORLD,
    options = {}
) {
    const safeWorld = {
        ...ENCHANTED_FOREST_WORLD,
        ...(world || {}),
    };
    const start = clampToWorld(current, safeWorld);
    const target = clampToWorld(desired, safeWorld);

    if (typeof sampler !== "function") return target;
    if (walkableAt(target, sampler, safeWorld, options)) return target;

    const xOnly = { x: target.x, y: start.y };
    if (walkableAt(xOnly, sampler, safeWorld, options)) return xOnly;

    const yOnly = { x: start.x, y: target.y };
    if (walkableAt(yOnly, sampler, safeWorld, options)) return yOnly;

    return start;
}
