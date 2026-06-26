import React, { useCallback, useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import { Sprite, SPRITES } from "../lib/sprites";
import FullfunkText from "./FullfunkText";
import AnimSprite, {
    pickTravelStance,
    sanitizeAnimCreature,
    spriteFrameBox,
} from "./AnimSprite";
import { isPresetTag, tagImageUrl, jetFrameUrl, canUrl, JET_FRAMES } from "../lib/tags";
import { youtubeEmbedUrl, THEATRE_SCREEN_BBOX, elapsedSinceStart } from "../lib/youtube";
import EmojiBurst from "./EmojiBurst";
import HelloLivingScene from "./HelloLivingScene";
import SpiderwebPhase2Scene from "./SpiderwebPhase2Scene";
import LiminalPhase4Scene from "./LiminalPhase4Scene";
import NeoclassickPhase2Scene from "./NeoclassickPhase2Scene";
import WWWorldScene from "./WWWorldScene";
import { isLiminalRoom, liminalAvatarDrift, liminalCornerShadow, liminalDisplayName } from "../lib/liminal";
import { clearThoughtBubbleMatte } from "../lib/thoughtBubbleMatte";
import thoughtBubbleManifest from "../data/thoughtBubbles.json";

const MemoEmojiBurst = React.memo(EmojiBurst);
const MemoHelloLivingScene = React.memo(HelloLivingScene);
const MemoSpiderwebPhase2Scene = React.memo(SpiderwebPhase2Scene);
const MemoLiminalPhase4Scene = React.memo(LiminalPhase4Scene);
const MemoNeoclassickPhase2Scene = React.memo(NeoclassickPhase2Scene);
const MemoWWWorldScene = React.memo(WWWorldScene);

function JungleFog() {
    return (
        <div className="jungle-fog-layer" aria-hidden data-testid="jungle-fog">
            <div className="jungle-fog-bank jungle-fog-bank-a" />
            <div className="jungle-fog-bank jungle-fog-bank-b" />
            <div className="jungle-fog-bank jungle-fog-bank-c" />
        </div>
    );
}

function MarsRover({ stageRect }) {
    const roverRef = useRef(null);
    const stageRef = useRef({ width: STAGE_W, height: STAGE_H });

    useEffect(() => {
        stageRef.current = {
            width: Math.max(1, Number(stageRect?.width) || STAGE_W),
            height: Math.max(1, Number(stageRect?.height) || STAGE_H),
        };
    }, [stageRect?.width, stageRect?.height]);

    useEffect(() => {
        let rafId = 0;
        let startMs = null;
        const reduceMotion = typeof window !== "undefined" &&
            window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

        const applyRoverPose = (elapsedMs) => {
            const node = roverRef.current;
            if (!node) return;
            const progress = (((elapsedMs % MARS_ROVER_PATROL_MS) + MARS_ROVER_PATROL_MS) % MARS_ROVER_PATROL_MS) / MARS_ROVER_PATROL_MS;
            const pose = marsRoverPoseAt(progress);
            const { width, height } = stageRef.current;
            const x = width * pose.x;
            const y = height * pose.y;
            const anchorX = (width * MARS_ROVER_PLATFORM_ANCHOR.x) / MARS_ROVER_SOURCE_WIDTH;
            const anchorY = (height * MARS_ROVER_PLATFORM_ANCHOR.y) / MARS_ROVER_SOURCE_HEIGHT;
            const tx = x - anchorX * (pose.scale - 1);
            const ty = y - anchorY * (pose.scale - 1);
            const snappedTx = Math.round(tx * 4) / 4;
            const snappedTy = Math.round(ty * 4) / 4;
            const frame = Math.floor((elapsedMs % (MARS_ROVER_FRAME_MS * MARS_ROVER_FRAMES.length)) / MARS_ROVER_FRAME_MS);

            node.style.transform = `translate3d(${snappedTx}px, ${snappedTy}px, 0) scale(${pose.scale.toFixed(4)})`;
            if (node.dataset.facing !== pose.facing) node.dataset.facing = pose.facing;
            if (node.dataset.frame !== String(frame)) node.dataset.frame = String(frame);
        };

        const step = (timestamp) => {
            if (startMs == null) startMs = timestamp;
            applyRoverPose(timestamp - startMs);
            if (!reduceMotion) rafId = requestAnimationFrame(step);
        };

        rafId = requestAnimationFrame(step);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, []);

    return (
        <div
            ref={roverRef}
            className="mars-rover-layer"
            aria-hidden
            data-testid="mars-rover"
            data-facing="right"
            data-frame="0"
            style={MARS_ROVER_PLATFORM_STYLE}
        >
            {MARS_ROVER_DIRECTIONS.flatMap((direction) => (
                MARS_ROVER_FRAMES.map((frame) => (
                    <img
                        key={`${direction}-${frame}`}
                        className="mars-rover-sprite"
                        data-direction={direction}
                        data-frame={frame}
                        src={`/assets/mars-rover/${direction}_${frame}.png?v=${MARS_ROVER_ASSET_VERSION}`}
                        alt=""
                        draggable={false}
                        decoding="async"
                    />
                ))
            ))}
        </div>
    );
}

function marsRoverPoseAt(progress) {
    const p = clamp(progress, 0, 1);
    let from = MARS_ROVER_PATROL[0];
    let to = MARS_ROVER_PATROL[MARS_ROVER_PATROL.length - 1];

    for (let index = 0; index < MARS_ROVER_PATROL.length - 1; index += 1) {
        const current = MARS_ROVER_PATROL[index];
        const next = MARS_ROVER_PATROL[index + 1];
        if (p >= current.at && p <= next.at) {
            from = current;
            to = next;
            break;
        }
    }

    const span = Math.max(0.0001, to.at - from.at);
    const t = clamp((p - from.at) / span, 0, 1);
    return {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        scale: from.scale + (to.scale - from.scale) * t,
        facing: from.facing,
    };
}

const THEME_ACCENT = {
    hello: "#ff6ec7",
    jello: "#ff00ff",
    heaven: "#ffcf5a",
    mars: "#ff5533",
    "neoclassick-world": "#8b5cff",
    "regular-cafe": "#7ca35a",
    "toxic-void": "#b3ff00",
    "basketball-court": "#ff8a2a",
    "food-court": "#ff00a0",
    jungle: "#4ae053",
    spiderweb: "#b86cff",
    "liminal-backroom": "#ffd47b",
    "inspiration-theatre": "#ff0033",
    wwworld: "#38ff4b",
};

function hashColor(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    const colors = ["#ff5555", "#55ff55", "#55aaff", "#ffaa00", "#ff55ff", "#00ffff", "#ffff55", "#aa55ff"];
    return colors[Math.abs(h) % colors.length];
}

const STAGE_W = 1000;
const STAGE_H = 500;
const SPRITE_RENDER_SIZE = { sm: 44, md: 60, lg: 84 };
const QUOTE_TTL_MS = 12000;
const WEIRDBOT_QUOTE_TTL_MS = 45000;
const MOVING_STANCES = new Set(["walk", "run", "dash", "float", "hop", "jump", "wiggle", "fly", "dive"]);
const WEIRDBOT_SAFE_BOX = { minX: 130, maxX: 870, minY: 210, maxY: 430 };
const SPRAY_STANDOFF_X = 112;
const SPRAY_STANDOFF_Y = 34;
const ATTACK_STANDOFF_Y = 8;
const ATTACK_CLOSE_ENOUGH = 14;
const BASKETBALL_ART_SIZE = 1254;

function basketballArtX(x) {
    return Math.round((x / BASKETBALL_ART_SIZE) * STAGE_W);
}

function basketballArtY(y) {
    return Math.round((y / BASKETBALL_ART_SIZE) * STAGE_H);
}

function basketballArtRect({ x, y, w, h, ...rest }) {
    return {
        ...rest,
        x: basketballArtX(x),
        y: basketballArtY(y),
        w: Math.max(1, Math.round((w / BASKETBALL_ART_SIZE) * STAGE_W)),
        h: Math.max(1, Math.round((h / BASKETBALL_ART_SIZE) * STAGE_H)),
    };
}

const BASKETBALL_HOOP = {
    x: basketballArtX(838),
    y: basketballArtY(224),
    rimWidth: Math.round((68 / BASKETBALL_ART_SIZE) * STAGE_W),
    rimHeight: Math.round((28 / BASKETBALL_ART_SIZE) * STAGE_H),
    backboardX: basketballArtX(796),
    backboardY: basketballArtY(110),
    backboardW: Math.round((132 / BASKETBALL_ART_SIZE) * STAGE_W),
    backboardH: Math.round((128 / BASKETBALL_ART_SIZE) * STAGE_H),
};
const BASKETBALL_GRAVITY = 250;
const BASKETBALL_FLOOR_Y = 486;
const BASKETBALL_RADIUS = 12;
// Basketball court art is square, but the gameplay plane is 1000x500.
// Keep collider coordinates in source-art pixels and convert once here so
// the hit areas stay attached to the drawn hoop/backboard instead of screen guesswork.
const BASKETBALL_BACKBOARD_COLLIDER = basketballArtRect({
    id: "backboard",
    x: 796,
    y: 110,
    w: 132,
    h: 128,
    restitution: 0.64,
    tangentDamping: 0.82,
});
const BASKETBALL_RIM_COLLIDER = {
    id: "rim",
    x: BASKETBALL_HOOP.x - BASKETBALL_HOOP.rimWidth / 2,
    y: BASKETBALL_HOOP.y - BASKETBALL_HOOP.rimHeight * 0.15,
    w: BASKETBALL_HOOP.rimWidth,
    h: Math.max(4, BASKETBALL_HOOP.rimHeight * 0.5),
    restitution: 0.72,
    tangentDamping: 0.78,
};
const MAX_BASKETBALLS = 10;
const WORLD_REACTION_TTL_MS = 2600;
const THOUGHT_BUBBLE_SHEET_SRC = `${thoughtBubbleManifest.sourceImage}?v=thought-clouds-json-20260507b`;
const MARS_ROVER_PATROL_MS = 28000;
const MARS_ROVER_FRAME_MS = 160;
const MARS_ROVER_DIRECTIONS = ["right", "back", "left", "front"];
const MARS_ROVER_FRAMES = [0, 1, 2, 3];
const MARS_ROVER_CANVAS_PAD_PX = 12;
const MARS_ROVER_BASE_SIDE_PAD_PX = 2;
const MARS_ROVER_SIDE_PAD_PX = 10;
const MARS_ROVER_SIDE_PAD_TOTAL_PX = MARS_ROVER_BASE_SIDE_PAD_PX + MARS_ROVER_SIDE_PAD_PX;
const MARS_ROVER_SOURCE_WIDTH = 398 + (MARS_ROVER_CANVAS_PAD_PX * 2) + (MARS_ROVER_SIDE_PAD_TOTAL_PX * 2);
const MARS_ROVER_SOURCE_HEIGHT = 306 + (MARS_ROVER_CANVAS_PAD_PX * 2);
const MARS_ROVER_ASSET_VERSION = "v8-right3-wheel-repair";
const MARS_ROVER_PLATFORM_ANCHOR = {
    x: 199 + MARS_ROVER_CANVAS_PAD_PX + MARS_ROVER_SIDE_PAD_PX,
    y: 293 + MARS_ROVER_CANVAS_PAD_PX,
};
const MARS_ROVER_PLATFORM_STYLE = {
    "--rover-frame-offset-x": `${((-MARS_ROVER_PLATFORM_ANCHOR.x / MARS_ROVER_SOURCE_WIDTH) * 100).toFixed(4)}%`,
    "--rover-frame-offset-y": `${((-MARS_ROVER_PLATFORM_ANCHOR.y / MARS_ROVER_SOURCE_HEIGHT) * 100).toFixed(4)}%`,
};
const MARS_ROVER_PATROL = [
    { at: 0, x: 0.08, y: 0.62, scale: 0.86, facing: "right" },
    { at: 0.24, x: 0.70, y: 0.58, scale: 0.94, facing: "back" },
    { at: 0.36, x: 0.78, y: 0.42, scale: 0.8, facing: "left" },
    { at: 0.61, x: 0.18, y: 0.46, scale: 0.76, facing: "front" },
    { at: 0.74, x: 0.12, y: 0.64, scale: 0.92, facing: "front" },
    { at: 1, x: 0.08, y: 0.62, scale: 0.86, facing: "right" },
];

const WORLD_REACTION_HOTSPOTS = {
    hello: [
        { id: "heart", x: 515, y: 205, r: 54, color: "#ff6ec7", messages: ["HEART.EXE HUMS", "HELLO BACK", "SOFT SIGNAL"] },
        { id: "rainbow", x: 420, y: 155, r: 66, color: "#ffee55", messages: ["RAINBOW BUFFERING", "COLOR FOUND", "SKY CACHE OK"] },
    ],
    spiderweb: [
        { id: "rune", x: 735, y: 242, r: 52, color: "#b86cff", messages: ["RUNE HEARD YOU", "THREAD UNLOCKED", "WEB WHISPERS"] },
        { id: "lantern", x: 735, y: 92, r: 42, color: "#ffd45f", messages: ["LANTERN BLINKS", "WARM BYTE", "LIGHT REMEMBERS"] },
        { id: "low-web", x: 380, y: 338, r: 58, color: "#62f6ff", messages: ["STICKY SIGNAL", "SILK MODE", "PATH TUGGED"] },
    ],
    "neoclassick-world": [
        { id: "moon", x: 510, y: 96, r: 60, color: "#f7ddff", messages: ["MOON FACE LOADED", "ORB IS AWAKE", "NEO LOOKS UP"] },
        { id: "portal", x: 772, y: 264, r: 58, color: "#8b5cff", messages: ["PORTAL WARMS", "GOLF LEVEL HIGH", "MIRACLE QUEUED"] },
        { id: "record", x: 545, y: 105, r: 42, color: "#62f6ff", messages: ["VINYL PRAYER", "DISC SPINS BACK", "TEMPLE BPM +1"] },
    ],
    wwworld: [
        { id: "browser", x: 505, y: 230, r: 78, color: "#38ff4b", messages: ["WINDOW MUTTERS", "LINK GHOSTED", "TAB DREAMS"] },
        { id: "address", x: 500, y: 95, r: 54, color: "#00ffff", messages: ["URL WIGGLES", "HTTP://HI", "CACHE BREATHES"] },
    ],
    "liminal-backroom": [
        { id: "hum", x: 500, y: 160, r: 86, color: "#ffd47b", messages: ["LIGHTS LISTEN", "ROOM REMEMBERS", "EXIT MOVED"] },
        { id: "corner", x: 835, y: 315, r: 70, color: "#ff6ec7", messages: ["CORNER SAW THAT", "WALL BREATH", "TAPE LOOPED"] },
    ],
    "inspiration-theatre": [
        { id: "screen", x: 500, y: 170, r: 92, color: "#ff0033", messages: ["SCREEN DREAMS", "STATIC APPLAUDS", "PLAYBACK OMEN"] },
    ],
};

const THOUGHT_BUBBLE_BODY_BOUNDS = {
    s1: { y: 0, h: 41 },
    s2: { y: 0, h: 54 },
    s3: { y: 0, h: 59 },
    s4a: { y: 0, h: 62 },
    s4b: { y: 0, h: 71 },
    s5: { y: 0, h: 94 },
    s6: { y: 0, h: 107 },
    s7: { y: 0, h: 102 },
    s8: { y: 0, h: 121 },
    m1: { y: 0, h: 73 },
    m2: { y: 0, h: 89 },
    m3: { y: 0, h: 83 },
    m4: { y: 0, h: 111 },
    m5: { y: 0, h: 120 },
    m7: { y: 0, h: 111 },
    m8: { y: 0, h: 125 },
    l1: { y: 0, h: 70 },
    l2: { y: 0, h: 84 },
    l3: { y: 0, h: 91 },
    l4: { y: 0, h: 100 },
    l5: { y: 0, h: 107 },
    l6: { y: 0, h: 106 },
    l7: { y: 0, h: 100 },
    l8: { y: 0, h: 91 },
};

function thoughtBubbleVariant(entry) {
    const source = entry.source || entry;
    const scale = Number(entry.render?.scale) || (entry.tier === "long" ? 0.76 : entry.tier === "medium" ? 0.82 : 0.92);
    const text = entry.text || {
        x: Math.round(source.w * 0.16),
        y: Math.round(source.h * 0.2),
        w: Math.round(source.w * 0.68),
        h: Math.round(source.h * 0.44),
    };
    return {
        id: entry.id,
        tier: entry.tier,
        rank: entry.rank,
        x: source.x,
        y: source.y,
        w: source.w,
        h: source.h,
        renderW: Math.round(source.w * scale),
        renderH: Math.round(source.h * scale),
        tailX: entry.tail?.x ?? Math.round(source.w * (entry.tier === "short" ? 0.24 : 0.18)),
        text,
        body: entry.body || THOUGHT_BUBBLE_BODY_BOUNDS[entry.id] || { y: 0, h: source.h },
        fontSize: entry.fontSize || (entry.tier === "long" ? 12 : entry.rank > 4 ? 12 : 13),
    };
}

const THOUGHT_BUBBLE_VARIANTS = thoughtBubbleManifest.variants.reduce((groups, entry) => {
    const variant = thoughtBubbleVariant(entry);
    groups[variant.tier] = [...(groups[variant.tier] || []), variant]
        .sort((a, b) => a.rank - b.rank);
    return groups;
}, { short: [], medium: [], long: [] });

let thoughtBubbleImagePromise = null;
const thoughtBubbleCanvasCache = new Map();

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function messageFullfunk(msg) {
    return !!(msg?.fullfunk || msg?.is_fullfunk);
}

function messageTimeMs(msg) {
    if (!msg?.ts) return 0;
    const ms = new Date(msg.ts).getTime();
    return Number.isFinite(ms) ? ms : 0;
}

function movementFacing(dx) {
    if (Math.abs(dx) < 1) return null;
    return dx < 0 ? "left" : "right";
}

function avatarCreature(user) {
    const animCreature = sanitizeAnimCreature(user?.anim_id);
    if (animCreature) return animCreature;
    const spriteDef = user?.sprite_id ? SPRITES[user.sprite_id] : null;
    return spriteDef?.kind || null;
}

function isWeirdbotUser(user) {
    const id = String(user?.user_id || "").toLowerCase();
    const nickname = String(user?.nickname || "").toLowerCase();
    return id.startsWith("weirdbot") || nickname.includes("weirdbot") || sanitizeAnimCreature(user?.anim_id) === "weirdbot";
}

function avatarRenderPoint(user) {
    const rawX = Number.isFinite(Number(user?.x)) ? Number(user.x) : 500;
    const rawY = Number.isFinite(Number(user?.y)) ? Number(user.y) : 250;
    const isWeirdbot = isWeirdbotUser(user);
    return {
        x: isWeirdbot ? clamp(rawX, WEIRDBOT_SAFE_BOX.minX, WEIRDBOT_SAFE_BOX.maxX) : rawX,
        y: isWeirdbot ? clamp(rawY, WEIRDBOT_SAFE_BOX.minY, WEIRDBOT_SAFE_BOX.maxY) : rawY,
    };
}

function buildBasketball(shot) {
    return {
        id: shot?.id || `hoop-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        user_id: shot?.user_id || "",
        nickname: shot?.nickname || "",
        x: clamp(Number(shot?.x) || 500, BASKETBALL_RADIUS, STAGE_W - BASKETBALL_RADIUS),
        y: clamp(Number(shot?.y) || 250, BASKETBALL_RADIUS, STAGE_H - BASKETBALL_RADIUS),
        vx: clamp(Number(shot?.vx) || 220, -650, 650),
        vy: clamp(Number(shot?.vy) || -320, -760, 320),
        spin: 0,
        scored: false,
        bounces: 0,
        life: 0,
        r: BASKETBALL_RADIUS,
    };
}

function basketballScored(prevY, ball) {
    if (ball.scored || ball.vy <= 0) return false;
    const crossedRim = prevY <= BASKETBALL_HOOP.y && ball.y >= BASKETBALL_HOOP.y - BASKETBALL_HOOP.rimHeight * 0.35;
    const insideRim = Math.abs(ball.x - BASKETBALL_HOOP.x) <= BASKETBALL_HOOP.rimWidth / 2;
    return crossedRim && insideRim;
}

function basketballCircleTouchesRect(x, y, radius, rect) {
    const nearestX = clamp(x, rect.x, rect.x + rect.w);
    const nearestY = clamp(y, rect.y, rect.y + rect.h);
    const dx = x - nearestX;
    const dy = y - nearestY;
    return dx * dx + dy * dy <= radius * radius;
}

function basketballSweptCircleRectHit(prevX, prevY, x, y, radius, rect) {
    if (basketballCircleTouchesRect(x, y, radius, rect)) {
        return { side: null, t: 1 };
    }
    const expanded = {
        x: rect.x - radius,
        y: rect.y - radius,
        w: rect.w + radius * 2,
        h: rect.h + radius * 2,
    };
    const dx = x - prevX;
    const dy = y - prevY;
    let tMin = 0;
    let tMax = 1;
    const axes = [
        { name: "x", start: prevX, delta: dx, min: expanded.x, max: expanded.x + expanded.w },
        { name: "y", start: prevY, delta: dy, min: expanded.y, max: expanded.y + expanded.h },
    ];
    let hitAxis = null;

    for (const axis of axes) {
        if (Math.abs(axis.delta) < 0.0001) {
            if (axis.start < axis.min || axis.start > axis.max) return null;
            continue;
        }
        const inv = 1 / axis.delta;
        let t1 = (axis.min - axis.start) * inv;
        let t2 = (axis.max - axis.start) * inv;
        if (t1 > t2) [t1, t2] = [t2, t1];
        if (t1 > tMin) {
            tMin = t1;
            hitAxis = axis;
        }
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return null;
    }
    if (tMax < 0 || tMin > 1) return null;
    if (!hitAxis) return { side: null, t: tMin };
    const side = hitAxis.name === "x"
        ? (hitAxis.delta > 0 ? "left" : "right")
        : (hitAxis.delta > 0 ? "top" : "bottom");
    return { side, t: tMin };
}

function resolveBasketballRectCollision(prevX, prevY, x, y, vx, vy, radius, rect) {
    const sweptHit = basketballSweptCircleRectHit(prevX, prevY, x, y, radius, rect);
    if (!sweptHit) return null;

    const restitution = Number.isFinite(Number(rect.restitution)) ? Number(rect.restitution) : 0.6;
    const tangentDamping = Number.isFinite(Number(rect.tangentDamping)) ? Number(rect.tangentDamping) : 0.84;
    const sides = [];
    const leftPen = Math.abs((x + radius) - rect.x);
    const rightPen = Math.abs((rect.x + rect.w) - (x - radius));
    const topPen = Math.abs((y + radius) - rect.y);
    const bottomPen = Math.abs((rect.y + rect.h) - (y - radius));

    if (prevX + radius <= rect.x || vx > 0) sides.push({ side: "left", pen: leftPen });
    if (prevX - radius >= rect.x + rect.w || vx < 0) sides.push({ side: "right", pen: rightPen });
    if (prevY + radius <= rect.y || vy > 0) sides.push({ side: "top", pen: topPen });
    if (prevY - radius >= rect.y + rect.h || vy < 0) sides.push({ side: "bottom", pen: bottomPen });

    const candidates = sides.length
        ? sides
        : [
            { side: "left", pen: leftPen },
            { side: "right", pen: rightPen },
            { side: "top", pen: topPen },
            { side: "bottom", pen: bottomPen },
        ];
    const hit = sweptHit.side
        ? { side: sweptHit.side, pen: 0 }
        : candidates.reduce((best, next) => (next.pen < best.pen ? next : best), candidates[0]);

    if (hit.side === "left") {
        return {
            x: rect.x - radius,
            y,
            vx: -Math.abs(vx) * restitution,
            vy: vy * tangentDamping,
            side: hit.side,
        };
    }
    if (hit.side === "right") {
        return {
            x: rect.x + rect.w + radius,
            y,
            vx: Math.abs(vx) * restitution,
            vy: vy * tangentDamping,
            side: hit.side,
        };
    }
    if (hit.side === "top") {
        return {
            x,
            y: rect.y - radius,
            vx: vx * tangentDamping,
            vy: -Math.abs(vy) * restitution,
            side: hit.side,
        };
    }
    return {
        x,
        y: rect.y + rect.h + radius,
        vx: vx * tangentDamping,
        vy: Math.abs(vy) * restitution,
        side: hit.side,
    };
}

function basketballShotVector(origin, target) {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const flightSec = clamp(dist / 270, 0.95, 2.05);
    return {
        flightSec,
        vx: clamp(dx / flightSec, -560, 560),
        vy: clamp((dy - 0.5 * BASKETBALL_GRAVITY * flightSec * flightSec) / flightSec, -680, -80),
    };
}

function basketballArcPoints(origin, target, steps = 20) {
    const { flightSec, vx, vy } = basketballShotVector(origin, target);
    return Array.from({ length: steps + 1 }, (_, index) => {
        const t = (index / steps) * flightSec;
        return {
            x: clamp(origin.x + vx * t, 0, STAGE_W),
            y: clamp(origin.y + vy * t + 0.5 * BASKETBALL_GRAVITY * t * t, 0, STAGE_H),
        };
    });
}

function fitRect(containerW, containerH, imageW, imageH, mode = "contain") {
    if (!containerW || !containerH || !imageW || !imageH) {
        return { left: 0, top: 0, width: containerW || 0, height: containerH || 0 };
    }
    const imageAspect = imageW / imageH;
    const containerAspect = containerW / containerH;
    const fitByHeight = mode === "cover"
        ? containerAspect < imageAspect
        : containerAspect > imageAspect;
    if (fitByHeight) {
        const height = containerH;
        const width = height * imageAspect;
        return { left: (containerW - width) / 2, top: 0, width, height };
    }
    const width = containerW;
    const height = width / imageAspect;
    return { left: 0, top: (containerH - height) / 2, width, height };
}

function snapRect(rect) {
    return {
        left: Math.round(rect.left || 0),
        top: Math.round(rect.top || 0),
        width: Math.max(1, Math.round(rect.width || 0)),
        height: Math.max(1, Math.round(rect.height || 0)),
    };
}

function stageToCssPixels(point, rect) {
    return {
        x: (point.x / STAGE_W) * (rect.width || STAGE_W),
        y: (point.y / STAGE_H) * (rect.height || STAGE_H),
    };
}

function avatarCssSize(user) {
    const animCreature = sanitizeAnimCreature(user?.anim_id);
    const spriteDef = user?.sprite_id ? SPRITES[user.sprite_id] : null;
    const spriteSize = spriteDef ? SPRITE_RENDER_SIZE[spriteDef.size] : 56;
    return {
        width: animCreature ? 96 : user?.avatar_url ? 42 : spriteSize,
        height: animCreature ? 112 : user?.avatar_url ? 46 : spriteSize,
    };
}

function avatarEdgePadCss(user, rect) {
    const { width } = avatarCssSize(user);
    const worldW = Math.max(1, rect?.width || STAGE_W);
    return Math.min(
        Math.floor(worldW / 2),
        Math.max(14, Math.ceil(width * 0.5) + 6)
    );
}

function avatarStageEdgePad(user, rect) {
    const worldW = Math.max(1, rect?.width || STAGE_W);
    const padStage = (avatarEdgePadCss(user, rect) / worldW) * STAGE_W;
    return clamp(padStage, 10, STAGE_W / 2);
}

function avatarStageWidth(user, rect) {
    const worldW = Math.max(1, rect?.width || STAGE_W);
    return (avatarCssSize(user).width / worldW) * STAGE_W;
}

function stageToAvatarCssPixels(point, rect, user) {
    const css = stageToCssPixels(point, rect);
    const worldW = Math.max(1, rect?.width || STAGE_W);
    const padX = avatarEdgePadCss(user, rect);
    return {
        x: clamp(css.x, padX, Math.max(padX, worldW - padX)),
        y: css.y,
    };
}

function avatarEdgeScale(cssX, rect) {
    const worldW = Math.max(1, rect?.width || STAGE_W);
    const edgeDistance = Math.min(cssX, Math.max(0, worldW - cssX));
    const squashZone = Math.max(86, worldW * 0.22);
    const t = clamp(edgeDistance / squashZone, 0, 1);
    return Math.round((0.74 + t * 0.26) * 1000) / 1000;
}

function easeInOutSine(t) {
    const p = clamp(t, 0, 1);
    return -(Math.cos(Math.PI * p) - 1) / 2;
}

function smoothPointAt(entry, nowMs) {
    if (!entry) return null;
    if (!entry.duration || entry.duration <= 0) {
        return { x: entry.targetX, y: entry.targetY };
    }
    const t = easeInOutSine((nowMs - entry.startTime) / entry.duration);
    return {
        x: entry.startX + (entry.targetX - entry.startX) * t,
        y: entry.startY + (entry.targetY - entry.startY) * t,
    };
}

function smoothEntryActive(entry, nowMs) {
    return !!entry?.duration && nowMs - entry.startTime < entry.duration;
}

function movementPower(dist, stance) {
    const stanceBoost = stance === "dash" || stance === "run" || stance === "dive" ? 1.18 : 1;
    return clamp((dist / 170) * stanceBoost, 0, 1);
}

function pickWorldReactionHotspot(theme, point) {
    const hotspots = WORLD_REACTION_HOTSPOTS[theme] || [];
    return hotspots.find((hotspot) => Math.hypot(point.x - hotspot.x, point.y - hotspot.y) <= hotspot.r) || null;
}

export default function IsoWorld({
    room, users, myId, onMove,
    tags = [],
    basketballShots = [],
    spray = null, // { active, tag, custom, size }
    onPlaceTag,
    onAttack,
    onClickUser,
    killMode = false,
    onToggleKillMode,
    youtubeTrack = null,
    chatMessages = [],
    sendWS,
    restStance = "idle",
    bottomInset = 0,
    fitMode = "contain",
}) {
    const stageRef = useRef(null);
    const accent = THEME_ACCENT[room?.theme] || "#ff00ff";
    const liminal = isLiminalRoom(room);
    const [now, setNow] = useState(() => Date.now());
    const [jetAnim, setJetAnim] = useState(null); // {x,y,frame}
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [worldImageSize, setWorldImageSize] = useState({ width: 1, height: 1 });
    const [hoopsMode, setHoopsMode] = useState(false);
    const [basketballs, setBasketballs] = useState([]);
    const [aimShot, setAimShot] = useState(null);
    const [hoopScore, setHoopScore] = useState(0);
    const [swish, setSwish] = useState(null);
    const sprayTimersRef = useRef([]);
    const attackTimersRef = useRef([]);
    const processedShotIdsRef = useRef(new Set());
    const swishTimerRef = useRef(null);
    const worldReactionTimersRef = useRef([]);
    const smoothPositionsRef = useRef(new Map());
    const smoothFrameRef = useRef(null);
    const avatarNodeRefs = useRef(new Map());
    const [worldReactions, setWorldReactions] = useState([]);
    const [hoveringWorldReaction, setHoveringWorldReaction] = useState(false);
    const isBasketballCourt = room?.theme === "basketball-court";
    const isToxicVoid = room?.theme === "toxic-void";
    const [fullVoid, setFullVoid] = useState(false);

    useEffect(() => {
        if (!isToxicVoid) setFullVoid(false);
    }, [isToxicVoid]);

    const me = useMemo(
        () => users.find((u) => u.user_id === myId),
        [users, myId]
    );

    const usableWorldHeight = Math.max(0, containerSize.height - bottomInset);
    const worldRect = useMemo(
        () => snapRect(fitRect(
            containerSize.width,
            usableWorldHeight,
            worldImageSize.width,
            worldImageSize.height,
            fitMode
        )),
        [containerSize.width, fitMode, usableWorldHeight, worldImageSize.height, worldImageSize.width]
    );

    const avatarTargetSignature = useMemo(() => (
        users.map((u) => {
            const p = avatarRenderPoint(u);
            return `${u.user_id}:${Math.round(p.x * 10) / 10}:${Math.round(p.y * 10) / 10}:${avatarCreature(u) || ""}`;
        }).join("|")
    ), [users]);

    const getAvatarDisplayPoint = useCallback((u, nowMs = performance.now()) => {
        const smoothEntry = u?.user_id ? smoothPositionsRef.current.get(u.user_id) : null;
        return smoothPointAt(smoothEntry, nowMs) || avatarRenderPoint(u);
    }, []);

    const applyAvatarNodeTransform = useCallback((u, point, nowMs = performance.now()) => {
        const node = u?.user_id ? avatarNodeRefs.current.get(u.user_id) : null;
        if (!node) return;

        const displayPoint = point || getAvatarDisplayPoint(u, nowMs);
        const drift = liminalAvatarDrift(u, nowMs, liminal);
        const cssPoint = stageToAvatarCssPixels(
            { x: displayPoint.x + drift.x, y: displayPoint.y + drift.y },
            worldRect,
            u
        );

        const safeCssPoint = {
            x: Math.round(cssPoint.x * 4) / 4,
            y: Math.round(cssPoint.y * 4) / 4,
        };

        // Keep movement on the compositor while still snapping to whole pixels.
        node.style.transform = `translate3d(${safeCssPoint.x}px, ${safeCssPoint.y}px, 0)`;
    }, [getAvatarDisplayPoint, liminal, worldRect]);

    const applyAvatarNodeTransforms = useCallback((items, nowMs = performance.now()) => {
        for (const u of items || []) {
            applyAvatarNodeTransform(u, getAvatarDisplayPoint(u, nowMs), nowMs);
        }
    }, [applyAvatarNodeTransform, getAvatarDisplayPoint]);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (!stageRef.current) return undefined;
        const update = () => {
            const rect = stageRef.current?.getBoundingClientRect();
            if (!rect) return;
            setContainerSize({ width: rect.width, height: rect.height });
        };
        update();
        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", update);
            return () => window.removeEventListener("resize", update);
        }
        const observer = new ResizeObserver(update);
        observer.observe(stageRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!room?.bg_url) {
            setWorldImageSize({ width: 1, height: 1 });
            return undefined;
        }
        let alive = true;
        const img = new Image();
        img.onload = () => {
            if (!alive) return;
            setWorldImageSize({
                width: img.naturalWidth || 1,
                height: img.naturalHeight || 1,
            });
        };
        img.src = room.bg_url;
        return () => { alive = false; };
    }, [room?.bg_url]);

    // spray-jet frame animation
    useEffect(() => {
        if (!jetAnim) return undefined;
        const t = setTimeout(() => {
            if (jetAnim.frame >= JET_FRAMES) {
                setJetAnim(null);
            } else {
                setJetAnim({ ...jetAnim, frame: jetAnim.frame + 1 });
            }
        }, 45);
        return () => clearTimeout(t);
    }, [jetAnim]);

    useEffect(() => () => {
        sprayTimersRef.current.forEach((timerId) => clearTimeout(timerId));
        sprayTimersRef.current = [];
        attackTimersRef.current.forEach((timerId) => clearTimeout(timerId));
        attackTimersRef.current = [];
        if (smoothFrameRef.current) cancelAnimationFrame(smoothFrameRef.current);
        if (swishTimerRef.current) clearTimeout(swishTimerRef.current);
        worldReactionTimersRef.current.forEach((timerId) => clearTimeout(timerId));
        worldReactionTimersRef.current = [];
    }, []);

    useEffect(() => {
        if (smoothFrameRef.current) cancelAnimationFrame(smoothFrameRef.current);
        smoothFrameRef.current = null;
        smoothPositionsRef.current.clear();
        processedShotIdsRef.current.clear();
        setHoopsMode(false);
        setBasketballs([]);
        setAimShot(null);
        setHoopScore(0);
        setSwish(null);
        setWorldReactions([]);
        attackTimersRef.current.forEach((timerId) => clearTimeout(timerId));
        attackTimersRef.current = [];
        worldReactionTimersRef.current.forEach((timerId) => clearTimeout(timerId));
        worldReactionTimersRef.current = [];
    }, [room?.id]);

    useEffect(() => {
        const nowMs = performance.now();
        const next = new Map(smoothPositionsRef.current);
        const seen = new Set();
        let shouldAnimate = false;

        for (const u of users) {
            const id = u?.user_id;
            if (!id) continue;
            seen.add(id);
            const target = avatarRenderPoint(u);
            const entry = next.get(id);
            const current = smoothPointAt(entry, nowMs) || target;
            const targetChanged =
                !entry ||
                Math.abs(entry.targetX - target.x) > 0.5 ||
                Math.abs(entry.targetY - target.y) > 0.5;

            if (!entry) {
                next.set(id, {
                    startX: target.x,
                    startY: target.y,
                    targetX: target.x,
                    targetY: target.y,
                    startTime: nowMs,
                    duration: 0,
                });
                continue;
            }

            if (targetChanged) {
                const dist = Math.hypot(target.x - current.x, target.y - current.y);
                const duration = dist < 1 ? 0 : travelDurationMs(avatarCreature(u), dist);
                next.set(id, {
                    startX: current.x,
                    startY: current.y,
                    targetX: target.x,
                    targetY: target.y,
                    startTime: nowMs,
                    duration,
                });
                shouldAnimate = shouldAnimate || duration > 0;
            } else if (smoothEntryActive(entry, nowMs)) {
                shouldAnimate = true;
            }
        }

        for (const id of next.keys()) {
            if (!seen.has(id)) next.delete(id);
        }

        smoothPositionsRef.current = next;
        applyAvatarNodeTransforms(users, nowMs);

        if (!shouldAnimate || smoothFrameRef.current) return undefined;

        const step = (ts) => {
            const map = smoothPositionsRef.current;
            let active = false;

            for (const [id, entry] of map.entries()) {
                if (smoothEntryActive(entry, ts)) {
                    active = true;
                } else if (entry.duration) {
                    map.set(id, {
                        ...entry,
                        startX: entry.targetX,
                        startY: entry.targetY,
                        startTime: ts,
                        duration: 0,
                    });
                }
            }

            applyAvatarNodeTransforms(users, ts);
            if (active) {
                smoothFrameRef.current = requestAnimationFrame(step);
            } else {
                smoothFrameRef.current = null;
            }
        };

        smoothFrameRef.current = requestAnimationFrame(step);
        return undefined;
    }, [applyAvatarNodeTransforms, avatarTargetSignature, users]);

    useEffect(() => {
        if (!isBasketballCourt) return;
        const fresh = [];
        for (const shot of basketballShots || []) {
            const id = shot?.id;
            if (!id || processedShotIdsRef.current.has(id)) continue;
            processedShotIdsRef.current.add(id);
            fresh.push(buildBasketball(shot));
        }
        if (fresh.length) {
            setBasketballs((balls) => [...balls, ...fresh].slice(-MAX_BASKETBALLS));
        }
    }, [basketballShots, isBasketballCourt]);

    const handleBasketballScore = useCallback(() => {
        setHoopScore((s) => s + 1);
        setSwish({ id: `swish-${Date.now()}` });
        if (swishTimerRef.current) clearTimeout(swishTimerRef.current);
        swishTimerRef.current = setTimeout(() => setSwish(null), 1500);
    }, []);

    const handleBasketballDone = useCallback((id) => {
        setBasketballs((balls) => balls.filter((ball) => ball.id !== id));
    }, []);

    const stagePoint = (clientX, clientY) => {
        const rect = stageRef.current.getBoundingClientRect();
        const worldW = worldRect.width || rect.width;
        const worldH = worldRect.height || rect.height;
        const rx = (clientX - rect.left - worldRect.left) / worldW;
        const ry = (clientY - rect.top - worldRect.top) / worldH;
        const edgePad = avatarStageEdgePad(me, worldRect);
        return {
            x: clamp(rx * STAGE_W, edgePad, STAGE_W - edgePad),
            y: Math.max(10, Math.min(STAGE_H - 10, ry * STAGE_H)),
        };
    };

    /** Decide the travel stance based on distance + creature's available states. */
    const pickStance = (creature, dist, dy) => pickTravelStance(creature, dist, dy);

    const avatarHitBox = (u) => {
        const scaleX = STAGE_W / Math.max(1, worldRect.width || STAGE_W);
        const scaleY = STAGE_H / Math.max(1, worldRect.height || STAGE_H);
        const { width: cssWidth, height: cssHeight } = avatarCssSize(u);
        return {
            halfWidth: Math.max(30, cssWidth * 0.62 * scaleX),
            bodyHeight: Math.max(48, cssHeight * 1.12 * scaleY),
            footPad: Math.max(12, 16 * scaleY),
        };
    };

    const avatarContainsPoint = (u, p) => {
        if (!u || u.user_id === myId || !p) return false;
        const pos = getAvatarDisplayPoint(u);
        const box = avatarHitBox(u);
        return (
            Math.abs(p.x - pos.x) <= box.halfWidth &&
            p.y >= pos.y - box.bodyHeight &&
            p.y <= pos.y + box.footPad
        );
    };

    const targetAtPoint = (p) => (
        [...users]
            .sort((a, b) => getAvatarDisplayPoint(b).y - getAvatarDisplayPoint(a).y)
            .find((u) => avatarContainsPoint(u, p))
    );

    const triggerWorldReaction = (point) => {
        const hotspot = pickWorldReactionHotspot(room?.theme, point);
        if (!hotspot) return false;
        const messages = hotspot.messages || [hotspot.id.toUpperCase()];
        const text = messages[Math.floor(Math.random() * messages.length)] || hotspot.id.toUpperCase();
        const id = `${hotspot.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const reaction = {
            id,
            x: hotspot.echoX ?? point.x,
            y: hotspot.echoY ?? point.y,
            text,
            color: hotspot.color || accent,
        };

        setWorldReactions((items) => [...items.slice(-5), reaction]);
        const timerId = setTimeout(() => {
            setWorldReactions((items) => items.filter((item) => item.id !== id));
            worldReactionTimersRef.current = worldReactionTimersRef.current.filter((timer) => timer !== timerId);
        }, WORLD_REACTION_TTL_MS);
        worldReactionTimersRef.current.push(timerId);
        return true;
    };

    const queueSprayTimer = (fn, delay) => {
        const timerId = setTimeout(() => {
            sprayTimersRef.current = sprayTimersRef.current.filter((id) => id !== timerId);
            fn();
        }, delay);
        sprayTimersRef.current.push(timerId);
        return timerId;
    };

    const clearAttackTimers = () => {
        attackTimersRef.current.forEach((timerId) => clearTimeout(timerId));
        attackTimersRef.current = [];
    };

    const queueAttackTimer = (fn, delay) => {
        const timerId = setTimeout(() => {
            attackTimersRef.current = attackTimersRef.current.filter((id) => id !== timerId);
            fn();
        }, delay);
        attackTimersRef.current.push(timerId);
        return timerId;
    };

    const attackApproachPoint = (target, mePoint, targetPoint) => {
        const attackerStartedLeft = (mePoint?.x ?? targetPoint.x) <= targetPoint.x;
        const targetHalf = avatarStageWidth(target, worldRect) * 0.42;
        const meHalf = avatarStageWidth(me, worldRect) * 0.34;
        const standoff = clamp(targetHalf + meHalf, 44, 92);
        const edgePad = avatarStageEdgePad(me, worldRect);
        const desiredX = targetPoint.x + (attackerStartedLeft ? -standoff : standoff);
        const x = clamp(desiredX, edgePad, STAGE_W - edgePad);
        const y = clamp(targetPoint.y + ATTACK_STANDOFF_Y, 70, STAGE_H - 18);
        return {
            x,
            y,
            facing: targetPoint.x >= x ? "right" : "left",
        };
    };

    const handleAttackTarget = (target) => {
        if (!target || !onAttack || !me || me.dead) return;
        clearAttackTimers();

        const mePoint = getAvatarDisplayPoint(me);
        const targetPoint = getAvatarDisplayPoint(target);
        const attackPoint = attackApproachPoint(target, mePoint, targetPoint);
        const dx = attackPoint.x - (mePoint?.x ?? attackPoint.x);
        const dy = attackPoint.y - (mePoint?.y ?? attackPoint.y);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const creature = avatarCreature(me);
        const travelMs = travelDurationMs(creature, dist);
        const attackDelay = dist <= ATTACK_CLOSE_ENOUGH
            ? 180
            : clamp(travelMs + 120, 360, 2800);
        const travelStance = dist > ATTACK_CLOSE_ENOUGH
            ? pickStance(creature, dist, dy)
            : (restStance || "idle");

        if (onMove) {
            // Reuse normal movement, but keep the travel/default stance alive
            // long enough that it cannot interrupt the queued attack frame.
            onMove(attackPoint.x, attackPoint.y, travelStance, attackDelay + 850, attackPoint.facing);
        }

        queueAttackTimer(() => {
            onAttack(target.user_id);
        }, attackDelay);
    };

    const handleSprayAt = (p) => {
        if (!onPlaceTag) return;
        sprayTimersRef.current.forEach((timerId) => clearTimeout(timerId));
        sprayTimersRef.current = [];

        const tagX = clamp(p.x, 18, STAGE_W - 18);
        const tagY = clamp(p.y, 24, STAGE_H - 18);
        const preferredSprayerX = tagX - SPRAY_STANDOFF_X;
        const sprayerX = clamp(preferredSprayerX, 22, STAGE_W - 22);
        const sprayerY = clamp(tagY + SPRAY_STANDOFF_Y, 70, STAGE_H - 18);
        const facing = tagX >= sprayerX ? "right" : "left";
        const creature = avatarCreature(me);
        const mePoint = me ? getAvatarDisplayPoint(me) : null;
        const dx = sprayerX - (mePoint?.x ?? sprayerX);
        const dy = sprayerY - (mePoint?.y ?? sprayerY);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const travelMs = travelDurationMs(creature, dist);
        const sprayDelay = dist < 10 ? 160 : Math.max(760, Math.min(3200, travelMs + 520));

        if (onMove && me) {
            onMove(sprayerX, sprayerY, pickStance(creature, dist, dy), travelMs, facing);
        }

        queueSprayTimer(() => {
            if (sendWS) sendWS({ type: "stance", stance: "attack" });
            const originX = clamp(sprayerX + (facing === "right" ? 56 : -56), 8, STAGE_W - 8);
            const originY = clamp(sprayerY - 36, 12, STAGE_H - 12);
            const direction = tagX >= originX ? 1 : -1;
            const width = clamp(Math.abs(tagX - originX) + 82, 120, 260);
            setJetAnim({
                frame: 1,
                originX,
                originY,
                targetX: tagX,
                targetY: tagY,
                direction,
                width,
            });
        }, sprayDelay);

        queueSprayTimer(() => {
            onPlaceTag(tagX, tagY);
        }, sprayDelay + 180);

        queueSprayTimer(() => {
            if (sendWS) sendWS({ type: "stance", stance: restStance || "idle" });
        }, sprayDelay + 900);
    };

    const shotFacingForTarget = (target) => {
        const pos = me ? getAvatarDisplayPoint(me) : { x: 300, y: 370 };
        return target?.x < pos.x ? "left" : "right";
    };

    const basketballOrigin = (facingOverride = null) => {
        const pos = me ? getAvatarDisplayPoint(me) : { x: 300, y: 370 };
        const facingName = facingOverride || me?.facing || "right";
        const facing = facingName === "left" ? -1 : 1;
        return {
            x: clamp(pos.x + facing * 28, BASKETBALL_RADIUS + 4, STAGE_W - BASKETBALL_RADIUS - 4),
            y: clamp(pos.y - 58, BASKETBALL_RADIUS + 4, STAGE_H - BASKETBALL_RADIUS - 4),
        };
    };

    const launchBasketball = (target) => {
        if (!isBasketballCourt || !target) return;
        const shotFacing = shotFacingForTarget(target);
        const origin = basketballOrigin(shotFacing);
        const { vx, vy } = basketballShotVector(origin, target);
        const shot = {
            type: "basketball_shot",
            id: `hoop-${myId || "local"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            x: origin.x,
            y: origin.y,
            vx,
            vy,
        };
        if (sendWS) {
            sendWS(shot);
        } else {
            setBasketballs((balls) => [...balls, buildBasketball({ ...shot, user_id: myId })].slice(-MAX_BASKETBALLS));
        }
        if (sendWS && me) {
            const pos = avatarRenderPoint(me);
            sendWS({ type: "move", x: pos.x, y: pos.y, facing: shotFacing });
        }
        if (sendWS) sendWS({ type: "stance", stance: "attack" });
        setTimeout(() => {
            if (sendWS) sendWS({ type: "stance", stance: restStance || "idle" });
        }, 620);
    };

    const handleHoopPointerDown = (e) => {
        if (!isBasketballCourt || !hoopsMode || !stageRef.current) return;
        if (e.button != null && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        stageRef.current.setPointerCapture?.(e.pointerId);
        const target = stagePoint(e.clientX, e.clientY);
        setAimShot({ pointerId: e.pointerId, origin: basketballOrigin(shotFacingForTarget(target)), target });
    };

    const handleHoopPointerMove = (e) => {
        if (!aimShot || aimShot.pointerId !== e.pointerId || !stageRef.current) return;
        e.preventDefault();
        const target = stagePoint(e.clientX, e.clientY);
        setAimShot((aim) => aim ? { ...aim, origin: basketballOrigin(shotFacingForTarget(target)), target } : aim);
    };

    const handleHoopPointerUp = (e) => {
        if (!aimShot || aimShot.pointerId !== e.pointerId || !stageRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        stageRef.current.releasePointerCapture?.(e.pointerId);
        const target = stagePoint(e.clientX, e.clientY);
        launchBasketball(target);
        setAimShot(null);
    };

    const handleHoopPointerCancel = (e) => {
        if (!aimShot || aimShot.pointerId !== e.pointerId) return;
        setAimShot(null);
    };

    const handleClick = (e) => {
        if (!stageRef.current) return;
        const p = stagePoint(e.clientX, e.clientY);
        if (isBasketballCourt && hoopsMode) {
            e.preventDefault();
            return;
        }
        if (spray?.active && onPlaceTag) {
            handleSprayAt(p);
            return;
        }
        const target = targetAtPoint(p);
        if (target) {
            if (killMode && onAttack) {
                handleAttackTarget(target);
            } else if (onClickUser) {
                onClickUser(target);
            }
            return;
        }
        triggerWorldReaction(p);
        if (onMove && me) {
            const x = Math.max(20, Math.min(STAGE_W - 20, p.x));
            const y = Math.max(60, Math.min(STAGE_H - 20, p.y));
            const mePoint = getAvatarDisplayPoint(me);
            const dx = x - (mePoint.x ?? 0);
            const dy = y - (mePoint.y ?? 0);
            const dist = Math.sqrt(dx * dx + dy * dy);
            const creature = avatarCreature(me);
            onMove(x, y, pickStance(creature, dist, dy), travelDurationMs(creature, dist), movementFacing(dx));
        }
    };

    const handleTouch = (e) => {
        if (!stageRef.current) return;
        if (!e.touches?.[0]) return;
        if (isBasketballCourt && hoopsMode) {
            e.preventDefault();
            return;
        }
        const p = stagePoint(e.touches[0].clientX, e.touches[0].clientY);
        if (spray?.active && onPlaceTag) {
            e.preventDefault();
            handleSprayAt(p);
            return;
        }
        const target = targetAtPoint(p);
        if (target) {
            if (killMode && onAttack) {
                handleAttackTarget(target);
            } else if (onClickUser) {
                onClickUser(target);
            }
            return;
        }
        triggerWorldReaction(p);
        if (onMove && me) {
            const x = Math.max(20, Math.min(STAGE_W - 20, p.x));
            const y = Math.max(60, Math.min(STAGE_H - 20, p.y));
            const mePoint = getAvatarDisplayPoint(me);
            const dx = x - (mePoint.x ?? 0);
            const dy = y - (mePoint.y ?? 0);
            const dist = Math.sqrt(dx * dx + dy * dy);
            const creature = avatarCreature(me);
            onMove(x, y, pickStance(creature, dist, dy), travelDurationMs(creature, dist), movementFacing(dx));
        }
    };

    const [hoveringTarget, setHoveringTarget] = useState(false);
    const handleHover = (e) => {
        if (!stageRef.current) return;
        if (isBasketballCourt && hoopsMode) {
            setHoveringTarget(false);
            setHoveringWorldReaction(false);
            return;
        }
        if (spray?.active) {
            setHoveringTarget(false);
            setHoveringWorldReaction(false);
            return;
        }
        const p = stagePoint(e.clientX, e.clientY);
        const overUser = !!targetAtPoint(p);
        const overWorldReaction = !!pickWorldReactionHotspot(room?.theme, p);
        setHoveringTarget(overUser);
        setHoveringWorldReaction(!overUser && overWorldReaction);
    };

    const sorted = useMemo(
        () => [...users].sort((a, b) => avatarRenderPoint(a).y - avatarRenderPoint(b).y),
        [users]
    );

    const wwworldAvatarPoints = useMemo(() => {
        if (room?.theme !== "wwworld") return [];
        return users.map((u) => ({
            id: u.user_id,
            ...avatarRenderPoint(u),
        }));
    }, [room?.theme, users]);

    const recentChatByUser = useMemo(() => {
        const byUser = new Map();
        for (const msg of chatMessages || []) {
            if (!msg || msg.type !== "chat" || msg.is_system || msg.system || !msg.user_id) continue;
            if (msg.user_id === "system") continue;
            byUser.set(msg.user_id, {
                text: msg.text || "",
                ts: msg.ts,
                fullfunk: messageFullfunk(msg),
            });
        }
        return byUser;
    }, [chatMessages]);

    return (
        <div
            ref={stageRef}
            className={`relative w-full h-full overflow-hidden ${
                spray?.active ? "spray-mode" : hoveringTarget
                    ? (killMode ? "attack-hover" : "profile-hover")
                    : hoveringWorldReaction ? "world-reaction-hover"
                    : ""
            }`}
            onClick={handleClick}
            onPointerDown={handleHoopPointerDown}
            onPointerMove={handleHoopPointerMove}
            onPointerUp={handleHoopPointerUp}
            onPointerCancel={handleHoopPointerCancel}
            onTouchStart={handleTouch}
            onMouseMove={handleHover}
            onMouseLeave={() => {
                setHoveringTarget(false);
                setHoveringWorldReaction(false);
            }}
            data-testid="iso-world"
            style={{
                backgroundColor: "#111",
                imageRendering: "pixelated",
                cursor: isBasketballCourt && hoopsMode ? "crosshair" : hoveringWorldReaction ? "help" : undefined,
                touchAction: isBasketballCourt && hoopsMode ? "none" : undefined,
            }}
        >
            {/* Floating kill-mode toggle pill (top-right, always visible) */}
            {onToggleKillMode && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleKillMode(); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    data-testid="kill-mode-pill"
                    title={killMode
                        ? "kill mode ON — clicks attack other avatars"
                        : "kill mode OFF — clicks open profiles"}
                    className="font-pixel"
                    style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        zIndex: 6,
                        padding: "4px 10px",
                        fontSize: 11,
                        letterSpacing: "0.18em",
                        cursor: "pointer",
                        background: killMode ? "#ff003c" : "rgba(0,0,0,0.55)",
                        color: killMode ? "#fff" : "#b3ff00",
                        border: killMode ? "2px solid #ff6ec7" : "2px solid #444",
                        boxShadow: killMode
                            ? "0 0 6px #ff003c, 0 0 14px #ff6ec7"
                            : "0 0 0 1px rgba(0,0,0,0.6)",
                        textShadow: killMode ? "0 0 4px #fff" : "none",
                    }}
                >
                    ⚔ {killMode ? "KILL" : "PEACE"}
                </button>
            )}

            {/* Kill-mode HUD banner (top-center, pulsing red) */}
            {killMode && (
                <div
                    data-testid="kill-mode-banner"
                    className="font-pixel"
                    style={{
                        position: "absolute",
                        top: 8,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "rgba(20,0,4,0.85)",
                        color: "#ff003c",
                        padding: "6px 14px",
                        fontSize: 12,
                        letterSpacing: "0.25em",
                        zIndex: 6,
                        animation: "killmode-pulse 1.1s ease-in-out infinite",
                        textShadow: "0 0 4px #ff003c",
                        pointerEvents: "none",
                        userSelect: "none",
                    }}
                >
                    ⚔ KILL MODE — click to strike
                </div>
            )}

            {isToxicVoid && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setFullVoid((value) => !value);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="font-pixel"
                    data-testid="fullvoid-toggle"
                    title="toggle full black void background"
                    style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        zIndex: 96,
                        padding: "5px 9px",
                        fontSize: 10,
                        letterSpacing: "0.12em",
                        background: fullVoid ? "#000" : "rgba(0,0,0,0.72)",
                        color: fullVoid ? "#b3ff00" : "#ff003c",
                        border: fullVoid ? "2px solid #b3ff00" : "2px solid #ff003c",
                        boxShadow: fullVoid
                            ? "0 0 10px rgba(179,255,0,0.72)"
                            : "0 0 10px rgba(255,0,60,0.62)",
                        textShadow: "0 0 5px currentColor",
                        cursor: "pointer",
                    }}
                >
                    {fullVoid ? "FULLVOID ON" : "FULLVOID"}
                </button>
            )}

            <div
                className="absolute overflow-visible"
                data-testid="iso-world-plane"
                style={{
                    left: worldRect.left,
                    top: worldRect.top,
                    width: worldRect.width || "100%",
                    height: worldRect.height || "100%",
                    backgroundColor: fullVoid ? "#000" : undefined,
                    backgroundImage: fullVoid ? "none" : (room?.bg_url ? `url(${room.bg_url})` : "none"),
                    backgroundSize: "100% 100%",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    imageRendering: "pixelated",
                }}
            >
                <div className="iso-floor" style={{ opacity: room?.bg_url ? 0 : 0.2 }} />
                {room?.theme === "hello" && <MemoHelloLivingScene />}
                {room?.theme === "spiderweb" && <MemoSpiderwebPhase2Scene />}
                {room?.theme === "neoclassick-world" && <MemoNeoclassickPhase2Scene />}
                {room?.theme === "wwworld" && (
                    <MemoWWWorldScene
                        avatarPoints={wwworldAvatarPoints}
                    />
                )}
                {liminal && <MemoLiminalPhase4Scene />}
                {room?.theme === "jungle" && <JungleFog />}
                    {room?.theme === "mars" && <MarsRover stageRect={worldRect} />}

            {/* YouTube communal screen overlay (only in Inspiration Theatre) */}
            {room?.theme === "inspiration-theatre" && (
                <TheatreScreen track={youtubeTrack} accent={accent} sendWS={sendWS} />
            )}

            {/* Emoji-reaction burst layer (chat-driven floating particles) */}
            <MemoEmojiBurst messages={chatMessages} />

            <div
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 88 }}
                data-testid="world-reaction-layer"
            >
                {worldReactions.map((reaction) => (
                    <WorldReaction key={reaction.id} reaction={reaction} />
                ))}
            </div>

            {/* Placed tags live on the world surface; avatars pass over them. */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ mixBlendMode: "screen", zIndex: 42 }}
                data-testid="tag-layer"
            >
                {tags.map((t) => (
                    <PlacedTag key={t.id} tag={t} />
                ))}
            </div>

            {/* Ephemeral spray jet animation (on top of tags, not blended) */}
            {jetAnim && (
                <img
                    src={jetFrameUrl(jetAnim.frame)}
                    alt=""
                    aria-hidden
                    data-testid="spray-jet"
                    style={{
                        position: "absolute",
                        left: `${(((jetAnim.direction || 1) === 1
                            ? jetAnim.originX
                            : jetAnim.originX - (jetAnim.width || 120)) / STAGE_W) * 100}%`,
                        top: `${(jetAnim.originY / STAGE_H) * 100}%`,
                        transform: `translateY(-50%) scaleX(${(jetAnim.direction || 1) === 1 ? 1 : -1})`,
                        transformOrigin: "center",
                        width: `${((jetAnim.width || 120) / STAGE_W) * 100}%`,
                        height: "auto",
                        imageRendering: "pixelated",
                        pointerEvents: "none",
                        opacity: 0.85,
                        mixBlendMode: "screen",
                        zIndex: 75,
                    }}
                />
            )}

            {room && (
                <div
                    className="absolute top-1 left-1 px-1 font-pixel blink"
                    style={{
                        background: "rgba(0,0,0,0.65)",
                        color: accent,
                        fontSize: 10,
                        letterSpacing: 1,
                        pointerEvents: "none",
                        zIndex: 95,
                    }}
                    data-testid="iso-room-tag"
                >
                    {room.theme.toUpperCase().replace(/-/g, "::")}_v1.0
                </div>
            )}

            {spray?.active && (
                <div
                    className="absolute top-1 right-1 px-1 font-pixel"
                    style={{
                        background: "#b3ff00",
                        color: "#000",
                        fontSize: 10,
                        letterSpacing: 1,
                        border: "1px solid #000",
                        pointerEvents: "none",
                        zIndex: 95,
                    }}
                    data-testid="spray-mode-indicator"
                >
                    ※ SPRAY MODE — click to tag ※
                </div>
            )}

            {isBasketballCourt && (
                <>
                    <BasketballHud
                        active={hoopsMode}
                        score={hoopScore}
                        onToggle={(e) => {
                            e.stopPropagation();
                            setHoopsMode((v) => !v);
                            setAimShot(null);
                        }}
                    />
                    {hoopsMode && <BasketballHoopTarget />}
                    {aimShot && <BasketballAim aim={aimShot} />}
                    {swish && <BasketballSwish />}
                    {basketballs.map((ball) => (
                        <Basketball
                            key={ball.id}
                            ball={ball}
                            onScore={handleBasketballScore}
                            onDone={handleBasketballDone}
                        />
                    ))}
                </>
            )}

            {/* Avatars */}
            {sorted.map((u) => {
                const color = hashColor(u.user_id || u.nickname);
                const isMe = u.user_id === myId;
                const spriteDef = u.sprite_id ? SPRITES[u.sprite_id] : null;
                const spriteSize = spriteDef ? SPRITE_RENDER_SIZE[spriteDef.size] : 56;
                const renderAnimId = sanitizeAnimCreature(u.anim_id);
                const avatarBoxSize = avatarCssSize(u);
                const targetPoint = avatarRenderPoint(u);
                const { x: renderX, y: renderY } = getAvatarDisplayPoint(u);
                const creature = avatarCreature(u);
                const remainingDx = targetPoint.x - renderX;
                const remainingDy = targetPoint.y - renderY;
                const remainingDist = Math.hypot(remainingDx, remainingDy);
                const facing = Math.abs(remainingDx) > 1.5
                    ? (remainingDx < 0 ? "left" : "right")
                    : (u.facing === "left" ? "left" : "right");
                const flip = facing === "left";
                const travelStance = remainingDist > 1.25 ? pickStance(creature, remainingDist, remainingDy) : null;
                const rawStance = u.anim_stance || "idle";
                const renderStance = rawStance !== "idle" ? rawStance : (travelStance || rawStance);
                const moving = MOVING_STANCES.has(renderStance);
                const isDash = renderStance === "dash";
                const power = moving ? movementPower(remainingDist, renderStance) : 0;
                const travelLift = Math.round(-2 - power * 4);
                const bobMs = Math.round(clamp(820 - power * 310, 440, 860));
                const trailWidth = Math.round((isDash ? 62 : 38) + power * (isDash ? 38 : 26));
                const trailHeight = Math.round((isDash ? 22 : 14) + power * (isDash ? 12 : 8));
                const trailOpacity = moving ? clamp((isDash ? 0.5 : 0.22) + power * 0.34, 0.18, 0.78) : 0;
                const trailAnchor = flip ? "0%" : "100%";
                const isWeirdbot = isWeirdbotUser(u);
                const liminalDrift = liminalAvatarDrift(u, now, liminal);
                        const displayName = liminalDisplayName(u.nickname, u.user_id, now);
                        const displayX = renderX + liminalDrift.x;
                        const displayY = renderY + liminalDrift.y;
                        const displayCss = stageToAvatarCssPixels({ x: displayX, y: displayY }, worldRect, u);
                        const renderStanceBox = spriteFrameBox(renderAnimId, renderStance, avatarBoxSize.width);
                        const thoughtBubbleWidth = (renderStanceBox?.width || avatarBoxSize.width);
                        const thoughtBubbleHeight = (renderStanceBox?.height || avatarBoxSize.height);
                        const edgeScale = avatarEdgeScale(displayCss.x, worldRect);
                        const liminalCorner = liminalCornerShadow(displayX, displayY, liminal, STAGE_W, STAGE_H);
                        const thoughtBubbleBelow = displayY < 320 || displayCss.y - avatarBoxSize.height - 126 < 6;
                const avatarFilter = [
                    liminalCorner.filter,
                    liminalDrift.filter || "drop-shadow(2px 2px 0 rgba(0,0,0,0.6))",
                ].filter(Boolean).join(" ");
                const avatarOpacity = liminalDrift.opacity * liminalCorner.opacity;
                const latestMessage = [u.last_message, recentChatByUser.get(u.user_id)]
                    .filter((msg) => msg?.text && messageTimeMs(msg))
                    .sort((a, b) => messageTimeMs(b) - messageTimeMs(a))[0];
                const quoteTtl = isWeirdbot ? WEIRDBOT_QUOTE_TTL_MS : QUOTE_TTL_MS;
                const quoteFresh =
                    latestMessage &&
                    latestMessage.ts &&
                    now - messageTimeMs(latestMessage) < quoteTtl
                        ? latestMessage
                        : null;
                const bubbleBelow = displayY < 125;
                const avatarZ = 50 + Math.round((displayY / STAGE_H) * 10);
                return (
                    <div
                        key={u.user_id}
                        ref={(node) => {
                            if (node) avatarNodeRefs.current.set(u.user_id, node);
                            else avatarNodeRefs.current.delete(u.user_id);
                        }}
                        className="absolute avatar-anchor"
                        data-testid="iso-avatar"
                        data-user-id={u.user_id}
                        data-nickname={u.nickname}
                        data-stance={renderStance}
                        data-anim-id={renderAnimId || ""}
                        data-facing={facing}
                        data-liminal-corner-shadow={liminalCorner.strength ? liminalCorner.strength.toFixed(2) : "0"}
                style={{
                    left: 0,
                    top: 0,
                    transform: `translate3d(${displayCss.x}px, ${displayCss.y}px, 0)`,
                    pointerEvents: "none",
                    transition: "none",
                    willChange: "transform",
                            filter: avatarFilter,
                            opacity: avatarOpacity,
                            zIndex: (quoteFresh || u.thought) ? 90 + Math.round((displayY / STAGE_H) * 10) : avatarZ,
                        }}
                    >
                        <div
                            className={`avatar-bob ${moving ? "avatar-moving" : "avatar-idle"} ${liminal ? "liminal-presence" : ""}`}
                            style={{
                                transform: "translate(-50%, -100%)",
                                "--avatar-lift": `${travelLift}px`,
                                "--avatar-bob-ms": `${bobMs}ms`,
                                "--avatar-edge-scale": edgeScale,
                                transition: "none",
                                willChange: "transform",
                            }}
                        >
                        {u.thought && (
                                <ThoughtCloud
                                    text={u.thought}
                                    fullfunk={!!u.thought_fullfunk}
                                    offsetSide="right"
                                    fading={isWeirdbot}
                                    placeBelow={thoughtBubbleBelow}
                                    anchored={isWeirdbot}
                                    avatarWidth={thoughtBubbleWidth}
                                    avatarHeight={thoughtBubbleHeight}
                                />
                        )}
                        {quoteFresh && !u.thought && (
                            <QuoteBubble text={quoteFresh.text} fullfunk={!!quoteFresh.fullfunk} placeBelow={bubbleBelow} />
                        )}

                        <div
                            className="font-pixel text-center"
                            style={{
                                fontSize: 10, color: "#fff",
                                textShadow:
                                    "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
                                marginBottom: 2, whiteSpace: "nowrap",
                            }}
                        >
                            {displayName}
                            {isMe ? " ◄" : ""}
                        </div>

                        <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
                            {u.anim_stance === "hurt" && (
                                <div
                                    aria-hidden
                                    data-testid="hit-flash"
                                    style={{
                                        position: "absolute",
                                        inset: -6,
                                        background: "radial-gradient(circle, rgba(255,40,40,0.55), rgba(255,40,40,0))",
                                        animation: "hitflash 220ms ease-out 1",
                                        pointerEvents: "none",
                                        zIndex: 1,
                                    }}
                                />
                            )}
                            {u.anim_stance === "die" && (
                                <DeathFx />
                            )}
                            {moving && (
                                <div
                                    aria-hidden
                                    data-testid="motion-trail"
                                    style={{
                                        position: "absolute",
                                        bottom: 10,
                                        left: flip ? "58%" : "auto",
                                        right: flip ? "auto" : "58%",
                                        width: trailWidth,
                                        height: trailHeight,
                                        opacity: trailOpacity,
                                        pointerEvents: "none",
                                        zIndex: 0,
                                        borderRadius: 999,
                                        background: [
                                            `radial-gradient(ellipse at ${trailAnchor} 50%, rgba(255,255,255,0.72), rgba(0,255,255,0.26) 42%, rgba(255,0,255,0) 78%)`,
                                            `linear-gradient(${flip ? 90 : 270}deg, rgba(255,255,255,0.52), rgba(0,255,255,0.22), rgba(255,0,255,0))`,
                                            `repeating-linear-gradient(${flip ? 100 : 260}deg, rgba(179,255,0,0.28) 0 2px, rgba(0,0,0,0) 2px 7px)`,
                                        ].join(", "),
                                        transform: `skewX(${flip ? -12 : 12}deg)`,
                                    }}
                                />
                            )}
                            {u.avatar_url ? (
                                <img
                                    alt={displayName}
                                    src={u.avatar_url}
                                    className="pixel-avatar"
                                    style={{
                                        width: 36,
                                        height: 36,
                                        objectFit: "cover",
                                        position: "relative",
                                        zIndex: 1,
                                        transform: flip ? "scaleX(-1)" : "none",
                                    }}
                                />
                            ) : renderAnimId ? (
                                <AnimSprite
                                    creature={renderAnimId}
                                    state={renderStance}
                                    size={88}
                                    fps={fpsForStance(renderStance)}
                                    flip={flip}
                                />
                            ) : spriteDef ? (
                                <div style={{ width: spriteSize }}>
                                    <Sprite id={u.sprite_id} size={spriteSize} flip={flip} />
                                </div>
                            ) : (
                                <div
                                    className="pixel-avatar flex items-center justify-center font-pixel"
                                    style={{
                                        width: 28, height: 36,
                                        background: color, color: "#000", fontSize: 18,
                                    }}
                                >
                                    {u.nickname?.[0]?.toUpperCase() || "?"}
                                </div>
                            )}

                            {/* Floating spray can next to me when in spray mode */}
                            {isMe && spray?.active && (
                                <img
                                    src={canUrl(0)}
                                    alt="spray can"
                                    data-testid="floating-spray-can"
                                    style={{
                                        position: "absolute",
                                        left: "105%",
                                        bottom: 4,
                                        height: 32,
                                        imageRendering: "pixelated",
                                        animation: "bob 0.9s ease-in-out infinite",
                                    }}
                                />
                            )}
                        </div>

                        <div
                            style={{
                                position: "absolute",
                                left: "50%",
                                bottom: -5,
                                transform: "translateX(-50%)",
                                width: 16, height: 4,
                                background: "rgba(0,0,0,0.4)",
                                borderRadius: "50%",
                                pointerEvents: "none",
                            }}
                        />
                        </div>
                    </div>
                );
            })}
            </div>
        </div>
    );
}

function WorldReaction({ reaction }) {
    return (
        <div
            className="world-reaction font-pixel"
            data-testid="world-reaction"
            style={{
                left: `${(reaction.x / STAGE_W) * 100}%`,
                top: `${(reaction.y / STAGE_H) * 100}%`,
                color: reaction.color || "#00ffff",
            }}
        >
            <span className="world-reaction-ring" aria-hidden />
            <span className="world-reaction-ring world-reaction-ring-late" aria-hidden />
            <span className="world-reaction-text">{reaction.text}</span>
        </div>
    );
}

function BasketballHud({ active, score, onToggle }) {
    return (
        <div
            className="absolute font-pixel"
            data-testid="basketball-hud"
            style={{
                top: 22,
                left: 6,
                zIndex: 96,
                display: "flex",
                gap: 4,
                alignItems: "center",
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                className="font-pixel"
                onClick={onToggle}
                data-testid="basketball-mode-toggle"
                title="toggle hoop shots; drag from your avatar toward the hoop"
                style={{
                    padding: "4px 8px",
                    border: active ? "2px solid #fff" : "2px solid #3b2308",
                    background: active ? "#ff8a2a" : "rgba(0,0,0,0.62)",
                    color: active ? "#000" : "#ffd08a",
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    cursor: "pointer",
                    boxShadow: active ? "0 0 10px #ff8a2a" : "2px 2px 0 rgba(0,0,0,0.6)",
                    textShadow: active ? "none" : "1px 1px 0 #000",
                }}
            >
                🏀 {active ? "SHOOT ON" : "SHOOT"}
            </button>
            <div
                className="font-pixel"
                data-testid="basketball-score"
                style={{
                    padding: "4px 7px",
                    background: "#000",
                    color: "#b3ff00",
                    border: "1px solid #ff8a2a",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                }}
            >
                {String(score).padStart(2, "0")}
            </div>
        </div>
    );
}

function BasketballHoopTarget() {
    return (
        <div
            aria-hidden
            data-testid="basketball-hoop-target"
            style={{
                position: "absolute",
                left: `${(BASKETBALL_HOOP.x / STAGE_W) * 100}%`,
                top: `${(BASKETBALL_HOOP.y / STAGE_H) * 100}%`,
                width: `${(BASKETBALL_HOOP.rimWidth / STAGE_W) * 100}%`,
                height: `${(BASKETBALL_HOOP.rimHeight / STAGE_H) * 100}%`,
                transform: "translate(-50%, -50%)",
                border: "2px dashed rgba(255,138,42,0.85)",
                borderRadius: "50%",
                boxShadow: "0 0 10px rgba(255,138,42,0.9), inset 0 0 8px rgba(255,255,255,0.45)",
                pointerEvents: "none",
                zIndex: 86,
            }}
        />
    );
}

function BasketballAim({ aim }) {
    const arcPoints = basketballArcPoints(aim.origin, aim.target, 22);
    const pathPoints = arcPoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    return (
        <>
            <svg
                aria-hidden
                data-testid="basketball-aim-arc"
                viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
                preserveAspectRatio="none"
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    zIndex: 97,
                    overflow: "visible",
                }}
            >
                <polyline
                    points={pathPoints}
                    fill="none"
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth="2.2"
                    strokeDasharray="8 7"
                    strokeLinecap="square"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    style={{
                        filter: "drop-shadow(0 0 4px #ff8a2a)",
                        shapeRendering: "crispEdges",
                    }}
                />
                <polyline
                    points={pathPoints}
                    fill="none"
                    stroke="rgba(255,138,42,0.52)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    style={{ filter: "blur(1px)" }}
                />
            </svg>
            {arcPoints.filter((_, index) => index % 3 === 1).map((point, index) => (
                <div
                    key={`hoop-arc-dot-${index}`}
                    aria-hidden
                    data-testid="basketball-aim-dot"
                    style={{
                        position: "absolute",
                        left: `${(point.x / STAGE_W) * 100}%`,
                        top: `${(point.y / STAGE_H) * 100}%`,
                        width: 5,
                        height: 5,
                        transform: "translate(-50%, -50%)",
                        background: index % 2 ? "#fff" : "#ff8a2a",
                        border: "1px solid rgba(43,19,0,0.8)",
                        boxShadow: "0 0 5px rgba(255,138,42,0.85)",
                        imageRendering: "pixelated",
                        pointerEvents: "none",
                        zIndex: 98,
                    }}
                />
            ))}
            <div
                aria-hidden
                style={{
                    position: "absolute",
                    left: `${(aim.origin.x / STAGE_W) * 100}%`,
                    top: `${(aim.origin.y / STAGE_H) * 100}%`,
                    transform: "translate(-50%, -50%)",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "#f57b22",
                    border: "2px solid #2b1300",
                    boxShadow: "0 0 8px #ff8a2a",
                    pointerEvents: "none",
                    zIndex: 98,
                }}
            />
        </>
    );
}

const Basketball = React.memo(function Basketball({ ball, onScore, onDone }) {
    const rootRef = useRef(null);
    const shadowRef = useRef(null);
    const bodyRef = useRef(null);
    const rafRef = useRef(null);
    const ballRef = useRef(null);
    const doneRef = useRef(false);
    const scoredRef = useRef(false);
    const measureRef = useRef({ width: STAGE_W, height: STAGE_H });
    const size = Math.max(15, Math.min(27, ball.r * 2));

    useLayoutEffect(() => {
        const root = rootRef.current;
        const shadow = shadowRef.current;
        const body = bodyRef.current;
        if (!root || !shadow || !body) return undefined;

        const parent = root.parentElement;
        const measure = () => {
            measureRef.current = {
                width: Math.max(1, parent?.clientWidth || STAGE_W),
                height: Math.max(1, parent?.clientHeight || STAGE_H),
            };
        };
        const applyVisuals = () => {
            const current = ballRef.current;
            if (!current) return;
            const sx = measureRef.current.width / STAGE_W;
            const sy = measureRef.current.height / STAGE_H;
            const x = Math.round(current.x * sx);
            const y = Math.round(current.y * sy);
            const shadowDrop = Math.max(8, (BASKETBALL_FLOOR_Y - current.y) * sy);
            const shadowScale = Math.max(0.35, 1 - Math.abs(BASKETBALL_FLOOR_Y - current.y) / 210);
            const behindFence = !!current.behindFence;

            root.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
            root.style.zIndex = String(behindFence ? 61 : 84 + Math.round((current.y / STAGE_H) * 10));
            root.style.opacity = behindFence ? "0.56" : "1";
            shadow.style.top = `${shadowDrop}px`;
            shadow.style.transform = `translateX(-50%) scale(${shadowScale})`;
            shadow.style.opacity = behindFence ? "0" : "1";
            body.style.transform = `rotate(${current.spin}deg)`;
            body.style.filter = behindFence ? "saturate(0.72) brightness(0.68)" : "none";
            body.style.boxShadow = current.scored
                ? "0 0 9px #fff, 0 0 16px #b3ff00"
                : "1px 2px 0 rgba(0,0,0,0.45)";
        };

        measure();
        ballRef.current = {
            ...ball,
            spin: Number.isFinite(Number(ball.spin)) ? Number(ball.spin) : 0,
            life: Number.isFinite(Number(ball.life)) ? Number(ball.life) : 0,
            bounces: Number.isFinite(Number(ball.bounces)) ? Number(ball.bounces) : 0,
            scored: !!ball.scored,
            behindFence: !!ball.behindFence,
        };
        doneRef.current = false;
        scoredRef.current = !!ball.scored;
        root.style.left = "0px";
        root.style.top = "0px";
        applyVisuals();

        let resizeObserver = null;
        const handleResize = () => {
            measure();
            applyVisuals();
        };
        if (parent && typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(handleResize);
            resizeObserver.observe(parent);
        } else if (typeof window !== "undefined") {
            window.addEventListener("resize", handleResize);
        }

        let last = performance.now();
        const step = (ts) => {
            if (doneRef.current || !ballRef.current) return;
            const dt = Math.min(0.034, Math.max(0.001, (ts - last) / 1000));
            last = ts;

            const current = ballRef.current;
            const prevX = current.x;
            const prevY = current.y;
            let x = current.x + current.vx * dt;
            let y = current.y + current.vy * dt;
            let vx = current.vx * 0.998;
            let vy = current.vy + BASKETBALL_GRAVITY * dt;
            let bounces = current.bounces;
            let scoredFlag = current.scored;

            if (!scoredFlag && basketballScored(prevY, { ...current, x, y, vx, vy })) {
                scoredFlag = true;
                vx *= 0.45;
                vy = Math.max(110, vy * 0.55);
                if (!scoredRef.current) {
                    scoredRef.current = true;
                    onScore?.(current.id);
                }
            }

            if (!scoredFlag) {
                const boardHit = resolveBasketballRectCollision(
                    prevX,
                    prevY,
                    x,
                    y,
                    vx,
                    vy,
                    BASKETBALL_RADIUS,
                    BASKETBALL_BACKBOARD_COLLIDER
                );
                if (boardHit) {
                    x = boardHit.x;
                    y = boardHit.y;
                    vx = boardHit.vx;
                    vy = boardHit.vy;
                    bounces += 1;
                } else {
                    const rimHit = resolveBasketballRectCollision(
                        prevX,
                        prevY,
                        x,
                        y,
                        vx,
                        vy,
                        BASKETBALL_RADIUS,
                        BASKETBALL_RIM_COLLIDER
                    );
                    if (rimHit) {
                        x = rimHit.x;
                        y = rimHit.y;
                        vx = rimHit.vx;
                        vy = rimHit.vy;
                        bounces += 1;
                    }
                }
            }

            if (x < BASKETBALL_RADIUS || x > STAGE_W - BASKETBALL_RADIUS) {
                x = clamp(x, BASKETBALL_RADIUS, STAGE_W - BASKETBALL_RADIUS);
                vx *= -0.68;
                bounces += 1;
            }
            if (y < BASKETBALL_RADIUS) {
                y = BASKETBALL_RADIUS;
                vy = Math.abs(vy) * 0.45;
                bounces += 1;
            }
            if (y > BASKETBALL_FLOOR_Y - BASKETBALL_RADIUS) {
                y = BASKETBALL_FLOOR_Y - BASKETBALL_RADIUS;
                vy = -Math.abs(vy) * 0.62;
                vx *= 0.9;
                bounces += 1;
                if (Math.abs(vy) < 42) vy = 0;
            }

            const life = current.life + dt;
            const speed = Math.abs(vx) + Math.abs(vy);
            const alive = life < 8 && (speed > 12 || y < BASKETBALL_FLOOR_Y - BASKETBALL_RADIUS - 2);
            if (!alive) {
                doneRef.current = true;
                onDone?.(current.id);
                return;
            }

            ballRef.current = {
                ...current,
                x,
                y,
                vx,
                vy,
                bounces,
                life,
                scored: scoredFlag,
                behindFence,
                spin: current.spin + vx * dt * 0.55,
            };
            applyVisuals();
            rafRef.current = requestAnimationFrame(step);
        };

        rafRef.current = requestAnimationFrame(step);
        return () => {
            doneRef.current = true;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            if (resizeObserver) resizeObserver.disconnect();
            else if (typeof window !== "undefined") window.removeEventListener("resize", handleResize);
        };
    }, [ball, onDone, onScore]);

    return (
        <div
            ref={rootRef}
            aria-hidden
            data-testid="basketball-ball"
            style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: "translate3d(0, 0, 0) translate(-50%, -50%)",
                width: size,
                height: size,
                pointerEvents: "none",
                willChange: "transform",
                contain: "layout style",
                zIndex: 84 + Math.round((ball.y / STAGE_H) * 10),
            }}
        >
            <div
                ref={shadowRef}
                style={{
                    position: "absolute",
                    left: "50%",
                    top: `${Math.max(8, BASKETBALL_FLOOR_Y - ball.y)}px`,
                    width: size * 1.25,
                    height: size * 0.28,
                    transform: "translateX(-50%) scale(1)",
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.32)",
                    filter: "blur(1px)",
                }}
            />
            <div
                ref={bodyRef}
                style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    border: "2px solid #2d1300",
                    background: [
                        "radial-gradient(circle at 34% 28%, #ffd18a 0 11%, rgba(255,209,138,0) 12%)",
                        "linear-gradient(90deg, rgba(0,0,0,0) 42%, rgba(61,24,0,0.75) 46%, rgba(61,24,0,0.75) 54%, rgba(0,0,0,0) 58%)",
                        "linear-gradient(18deg, rgba(0,0,0,0) 44%, rgba(61,24,0,0.75) 48%, rgba(61,24,0,0.75) 52%, rgba(0,0,0,0) 56%)",
                        "radial-gradient(circle at 45% 45%, #f7922e 0 52%, #a94112 78%, #5c1c04 100%)",
                    ].join(", "),
                    boxShadow: ball.scored ? "0 0 9px #fff, 0 0 16px #b3ff00" : "1px 2px 0 rgba(0,0,0,0.45)",
                    transform: `rotate(${ball.spin}deg)`,
                    willChange: "transform",
                    imageRendering: "pixelated",
                }}
            />
        </div>
    );
});

function BasketballSwish() {
    return (
        <div
            className="font-pixel"
            data-testid="basketball-swish"
            style={{
                position: "absolute",
                left: `${((BASKETBALL_HOOP.x + 64) / STAGE_W) * 100}%`,
                top: `${((BASKETBALL_HOOP.y - 10) / STAGE_H) * 100}%`,
                transform: "translate(-50%, -50%)",
                color: "#fff",
                background: "rgba(0,0,0,0.72)",
                border: "2px solid #b3ff00",
                padding: "5px 8px",
                fontSize: 12,
                letterSpacing: "0.14em",
                textShadow: "0 0 5px #b3ff00",
                boxShadow: "0 0 14px rgba(179,255,0,0.75)",
                pointerEvents: "none",
                zIndex: 99,
                animation: "hoopSwishPop 1.4s ease-out forwards",
            }}
        >
            SWISH
        </div>
    );
}

function PlacedTag({ tag }) {
    const safeText = String(tag?.tag || "").trim();
    if (!safeText) return null;

    const scale = Number.isFinite(Number(tag?.scale)) ? Number(tag.scale) : 1;
    const x = Number.isFinite(Number(tag?.x)) ? Number(tag.x) : STAGE_W / 2;
    const y = Number.isFinite(Number(tag?.y)) ? Number(tag.y) : STAGE_H / 2;
    const rot = Number.isFinite(Number(tag?.rot)) ? Number(tag.rot) : 0;
    const baseHeight = 64 * scale;
    const customVertical = !!tag?.custom && (x < 135 || x > STAGE_W - 135);
    const xAnchor = customVertical ? (x < STAGE_W / 2 ? "0%" : "-100%") : "-50%";
    const yAnchor = customVertical
        ? (y < 150 ? "0%" : y > STAGE_H - 150 ? "-100%" : "-50%")
        : "-50%";
    const imageUrl = tag?.image_url || tag?.imageUrl || null;
    const renderAsCustom = !!tag?.custom || !isPresetTag(safeText);
    return (
        <div
            data-testid="placed-tag"
            data-tag-name={safeText}
            data-tag-custom={renderAsCustom ? "true" : "false"}
            data-tag-vertical={customVertical ? "true" : "false"}
            style={{
                position: "absolute",
                left: `${(x / STAGE_W) * 100}%`,
                top: `${(y / STAGE_H) * 100}%`,
                transform: `translate(${xAnchor}, ${yAnchor}) rotate(${rot}deg)`,
                opacity: 0.95,
                pointerEvents: "none",
                transformOrigin: customVertical
                    ? (x < STAGE_W / 2 ? "left center" : "right center")
                    : "center",
            }}
            title={`${safeText} by ${tag.nickname || "someone"}`}
        >
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={tag?.image_name || safeText}
                    style={{
                        height: Math.round(baseHeight * 1.45),
                        maxWidth: Math.round(baseHeight * 2.4),
                        width: "auto",
                        imageRendering: "pixelated",
                        display: "block",
                        objectFit: "contain",
                    }}
                    draggable={false}
                />
            ) : renderAsCustom ? (
                <FullfunkText text={safeText} size={Math.round(baseHeight)} vertical={customVertical} />
            ) : (
                <img
                    src={tagImageUrl(safeText)}
                    alt={safeText}
                    style={{
                        height: baseHeight,
                        width: "auto",
                        imageRendering: "pixelated",
                        display: "block",
                    }}
                    draggable={false}
                />
            )}
        </div>
    );
}

function QuoteBubble({ text, fullfunk, placeBelow = false }) {
    const t = text.length > 120 ? text.slice(0, 117) + "..." : text;
    return (
        <div
            className="font-mono-retro"
            data-testid="quote-bubble"
            style={{
                position: "absolute",
                ...(placeBelow ? { top: "calc(100% + 8px)" } : { bottom: "calc(100% + 4px)" }),
                left: "50%",
                transform: "translateX(-50%)",
                background: "#fff",
                color: "#000",
                padding: fullfunk ? "4px 6px" : "3px 7px",
                border: "2px solid #000",
                fontSize: 14,
                lineHeight: 1.15,
                width: "max-content",
                maxWidth: fullfunk ? 260 : 220,
                minWidth: 40,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                textAlign: "center",
                boxShadow: "2px 2px 0 #000",
                pointerEvents: "none",
                zIndex: 8,
            }}
        >
            {fullfunk ? <FullfunkText text={t} size={16} /> : t}
            <span aria-hidden style={{
                position: "absolute", [placeBelow ? "top" : "bottom"]: -7, left: "50%",
                transform: "translateX(-50%)", width: 0, height: 0,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                ...(placeBelow ? { borderBottom: "7px solid #000" } : { borderTop: "7px solid #000" }),
            }} />
            <span aria-hidden style={{
                position: "absolute", [placeBelow ? "top" : "bottom"]: -4, left: "50%",
                transform: "translateX(-50%)", width: 0, height: 0,
                borderLeft: "4px solid transparent",
                borderRight: "4px solid transparent",
                ...(placeBelow ? { borderBottom: "5px solid #fff" } : { borderTop: "5px solid #fff" }),
            }} />
        </div>
    );
}

function pickThoughtBubbleVariant(text, fullfunk = false) {
    const source = String(text || "").trim();
    const len = source.length;
    const lines = Math.max(1, source.split(/\n/).length);
    const words = source.split(/\s+/).filter(Boolean).length;
    const needsLong = len >= (fullfunk ? 34 : 46) || words >= (fullfunk ? 5 : 8) || lines >= 3;
    const needsMedium = len >= (fullfunk ? 16 : 26) || words >= 4 || lines >= 2;

    let pool = [];
    if (needsLong) {
        pool = THOUGHT_BUBBLE_VARIANTS.long;
    } else if (needsMedium) {
        pool = THOUGHT_BUBBLE_VARIANTS.medium;
    } else {
        pool = THOUGHT_BUBBLE_VARIANTS.short;
    }

    if (!pool || pool.length === 0) return THOUGHT_BUBBLE_VARIANTS.long[0];

    let ranked = pool
        .map((variant) => ({
            variant,
            fitScale: thoughtBubbleFitScale(variant, source, fullfunk),
            area: variant.renderW * variant.renderH,
        }))
        .sort((a, b) => {
            const aTight = a.fitScale <= 1.02 ? 0 : 1;
            const bTight = b.fitScale <= 1.02 ? 0 : 1;
            if (aTight !== bTight) return aTight - bTight;
            if (a.fitScale !== b.fitScale) return a.fitScale - b.fitScale;
            return a.area - b.area;
        });

    // If text barely overflows this tier, escalate only when needed to avoid short/mid jumps.
    if ((needsMedium || needsLong) && ranked[0].fitScale > 1.28) {
        const longFallback = THOUGHT_BUBBLE_VARIANTS.long
            .map((variant) => ({
                variant,
                fitScale: thoughtBubbleFitScale(variant, source, fullfunk),
                area: variant.renderW * variant.renderH,
            }))
            .sort((a, b) => {
                const aTight = a.fitScale <= 1.02 ? 0 : 1;
                const bTight = b.fitScale <= 1.02 ? 0 : 1;
                if (aTight !== bTight) return aTight - bTight;
                if (a.fitScale !== b.fitScale) return a.fitScale - b.fitScale;
                return a.area - b.area;
            });
        if (longFallback[0].fitScale < ranked[0].fitScale * 0.93) {
            ranked = longFallback;
        }
    }

    const best = ranked[0];
    if (!best) return THOUGHT_BUBBLE_VARIANTS.long[0];
    return best.variant;
}

function thoughtBubbleFitScale(variant, text, fullfunk = false) {
    const source = String(text || "");
    const scaleX = variant.renderW / variant.w;
    const scaleY = variant.renderH / variant.h;
    const textW = Math.max(1, variant.text.w * scaleX - 6);
    const textH = Math.max(1, variant.text.h * scaleY - 4);
    const avgCharWidth = Math.max(5, variant.fontSize * (fullfunk ? 0.72 : 0.58));
    const charsPerLine = Math.max(1, Math.floor(textW / avgCharWidth));
    const linesNeeded = source.split(/\n/).reduce((total, line) => {
        return total + Math.max(1, Math.ceil(line.length / charsPerLine));
    }, 0);
    const heightNeeded = (linesNeeded * variant.fontSize * (fullfunk ? 1.2 : 1.1)) + 6;
    const longestToken = source.split(/\s+/).reduce((max, word) => Math.max(max, word.length), 0);
    const tokenWidthNeeded = longestToken * avgCharWidth;
    const tokenPressure = Math.max(1, tokenWidthNeeded / Math.max(textW * 1.35, 1));
    const heightPressure = Math.max(1, heightNeeded / Math.max(textH, 1));
    return Math.max(1, heightPressure, tokenPressure);
}

function loadThoughtBubbleImage() {
    if (!thoughtBubbleImagePromise) {
        thoughtBubbleImagePromise = new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = THOUGHT_BUBBLE_SHEET_SRC;
        });
    }
    return thoughtBubbleImagePromise;
}

function getThoughtBubbleCanvas(image, variant) {
    const cacheKey = `${variant.id}:${variant.x},${variant.y},${variant.w},${variant.h}`;
    if (thoughtBubbleCanvasCache.has(cacheKey)) return thoughtBubbleCanvasCache.get(cacheKey);

    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = variant.w;
    frameCanvas.height = variant.h;
    const frameCtx = frameCanvas.getContext("2d", { willReadFrequently: true });
    frameCtx.imageSmoothingEnabled = false;
    frameCtx.clearRect(0, 0, variant.w, variant.h);
    frameCtx.drawImage(image, variant.x, variant.y, variant.w, variant.h, 0, 0, variant.w, variant.h);
    const keyed = clearThoughtBubbleMatte(frameCtx.getImageData(0, 0, variant.w, variant.h));
    frameCtx.putImageData(keyed, 0, 0);
    thoughtBubbleCanvasCache.set(cacheKey, frameCanvas);
    return frameCanvas;
}

function ThoughtBubbleSprite({ variant, text, fullfunk, placeBelow, cloudScale = 1 }) {
    const canvasRef = useRef(null);
    const [failed, setFailed] = useState(false);
    const scaleX = variant.renderW / variant.w;
    const scaleY = variant.renderH / variant.h;
    const textBox = variant.text;
    const textSource = String(text || "");
    const textAreaWidth = Math.max(1, Math.round(textBox.w * scaleX));
    const textAreaHeight = Math.max(1, Math.round(textBox.h * scaleY));
    const textOffsetX = Math.max(0, Math.round(textBox.x * scaleX));
    const scaledTextArea = {
        width: Math.max(1, Math.round(textAreaWidth * cloudScale)),
        height: Math.max(1, Math.round(textAreaHeight * cloudScale)),
    };
    const scaledTextOffsetX = Math.max(0, Math.round(textOffsetX * cloudScale));
    const renderedBubbleHeight = Math.round(variant.renderH * cloudScale);
    const baseTextTop = Math.round(textBox.y * scaleY * cloudScale);
    const bodyBox = variant.body || { y: 0, h: variant.h };
    const flippedBodyCenterY = (variant.h - (bodyBox.y + (bodyBox.h / 2))) * scaleY * cloudScale;
    const textTop = placeBelow
        ? Math.round(clamp(flippedBodyCenterY - (scaledTextArea.height / 2), 0, Math.max(0, renderedBubbleHeight - scaledTextArea.height)))
        : Math.max(0, baseTextTop);

    useEffect(() => {
        let cancelled = false;
        loadThoughtBubbleImage()
            .then((image) => {
                if (cancelled) return;
                const canvas = canvasRef.current;
                const ctx = canvas?.getContext("2d");
                if (!canvas || !ctx) return;
                canvas.width = variant.w;
                canvas.height = variant.h;
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, variant.w, variant.h);
                ctx.drawImage(getThoughtBubbleCanvas(image, variant), 0, 0);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, [variant]);

    if (failed) {
        return (
            <CloudShape>
                <div className="font-mono-retro" style={{ color: "#000", padding: "4px 14px", fontSize: 14, lineHeight: 1.2 }}>
                    {fullfunk ? <FullfunkText text={text} size={16} /> : text}
                </div>
            </CloudShape>
        );
    }

    return (
        <div
            className="thought-bubble-sprite"
            data-testid="thought-bubble-sprite"
            data-variant-id={variant.id}
            style={{
                position: "relative",
                width: Math.round(variant.renderW * cloudScale),
                height: Math.round(variant.renderH * cloudScale),
                imageRendering: "pixelated",
            }}
        >
            <canvas
                ref={canvasRef}
                aria-hidden
                width={variant.w}
                height={variant.h}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    imageRendering: "pixelated",
                    transform: placeBelow ? "scaleY(-1)" : "none",
                    transformOrigin: "center",
                }}
            />
            <div
                className="font-mono-retro"
                style={{
                    position: "absolute",
                    left: `${scaledTextOffsetX}px`,
                    top: textTop,
                    transform: "none",
                    width: scaledTextArea.width,
                    height: scaledTextArea.height,
                    color: "#111",
                    fontSize: variant.fontSize,
                    lineHeight: 1.1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingTop: 1,
                    paddingLeft: 2,
                    paddingRight: 2,
                    boxSizing: "border-box",
                    overflow: "hidden",
                    textAlign: "center",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    imageRendering: "pixelated",
                }}
            >
                {fullfunk ? <FullfunkText text={textSource} size={variant.fontSize + 2} /> : textSource}
            </div>
        </div>
    );
}

function ThoughtCloud({
    text,
    fullfunk,
    offsetSide = "right",
    fading = false,
    placeBelow = false,
    anchored = false,
    avatarSize = 56,
    avatarWidth = avatarSize,
    avatarHeight = avatarSize,
}) {
    const raw = String(text || "");
    const t = raw;
    const variant = pickThoughtBubbleVariant(t, fullfunk);
    const scaleX = variant.renderW / variant.w;
    const cloudScale = Math.max(1, Math.min(2.4, thoughtBubbleFitScale(variant, t, fullfunk)));
    const anchorX = Math.round(variant.tailX * scaleX * cloudScale);
    const sideSign = offsetSide === "left" ? -1 : 1;
    const headSideOffset = Math.round(clamp(avatarWidth * 0.6, 22, 64));
    const headVerticalOffset = Math.round(clamp(avatarHeight * 0.28, 20, 42));
    const belowOffset = Math.round(clamp(avatarHeight * 0.08, 4, 10));
    const transformX = (sideSign * headSideOffset) - anchorX;
    return (
        <div
            data-testid="thought-bubble"
            data-thought-size={variant.id}
            data-thought-tier={variant.tier}
            data-place-below={placeBelow ? "true" : "false"}
            data-offset-side={offsetSide}
            data-anchored={anchored ? "true" : "false"}
            data-head-side-offset={headSideOffset}
            data-tail-anchor-x={anchorX}
            className={fading ? "thought-fading" : ""}
            style={{
                position: "absolute",
                ...(placeBelow ? { top: `calc(100% + ${belowOffset}px)` } : { bottom: `calc(100% - ${headVerticalOffset}px)` }),
                left: "50%",
                transform: `translateX(${transformX}px)`,
                pointerEvents: "none",
                zIndex: 8,
            }}
        >
            <ThoughtBubbleSprite variant={variant} text={t} fullfunk={fullfunk} placeBelow={placeBelow} cloudScale={cloudScale} />
        </div>
    );
}

function CloudShape({ children }) {
    return (
        <div
            style={{
                position: "relative",
                display: "inline-block",
                padding: "11px 18px 13px",
                background: "#fff",
                color: "#000",
                border: "2px solid #000",
                borderRadius: 12,
                boxShadow: "2px 2px 0 #000",
                imageRendering: "pixelated",
                minWidth: 100,
                maxWidth: 280,
            }}
        >
            {children}
        </div>
    );
}

// Per-creature movement speed multiplier (lower = slower).
// Plant is rooted, slime crawls; fairy/ghost float fast.
const SPEED_MULT = {
    fairy: 1.6, ghost: 1.5, bat: 1.45, boo: 1.4,
    cat: 1.2, ape: 1.0, robot: 1.05, frog: 1.1, alien: 1.15,
    skeleton: 0.95, tvhead: 0.95,
    weirdbot: 1.0,
    slime: 0.65,
    plant: 0.4,
};
function travelDurationSec(creature) {
    const m = SPEED_MULT[creature] ?? 1.0;
    // base 1.4s tween; faster creatures finish in ~0.85s, slowest in ~3.5s
    return Math.max(0.4, 1.4 / m);
}

function travelDurationMs(creature, dist = 0) {
    const m = SPEED_MULT[creature] ?? 1.0;
    const speed = 285 * m;
    const distanceMs = (Math.max(0, dist) / speed) * 1000;
    const floorMs = creature === "plant" ? 520 : 240;
    const ceilingMs = creature === "plant" ? 3600 : 2600;
    return Math.round(clamp(distanceMs, floorMs, ceilingMs));
}

function fpsForStance(stance) {
    switch (stance) {
        case "run":  return 12;
        case "walk": return 9;
        case "fly":  case "dive": case "dash": return 10;
        case "float": return 8;
        case "hop":  return 10;
        case "jump": return 10;
        case "attack": case "hurt": case "die": return 8;
        case "talk": case "react": case "glitch": return 7;
        case "split": case "fade": case "scare": case "wiggle": return 5;
        default: return 6;
    }
}

function DeathFx() {
    return (
        <div
            aria-hidden
            data-testid="death-fx"
            style={{
                position: "absolute",
                top: -42,
                left: "50%",
                transform: "translateX(-50%)",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                zIndex: 4,
            }}
        >
            <div
                className="font-pixel"
                style={{
                    fontSize: 18,
                    color: "#ff0033",
                    textShadow:
                        "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
                    animation: "rektPop 1200ms ease-out 1",
                    fontWeight: "bold",
                    letterSpacing: 1,
                }}
            >
                GET REKT 💀
            </div>
        </div>
    );
}

function PixelPuff({ size, driftX = 1, driftY = -1, delay = 0 }) {
    return (
        <div
            aria-hidden
            className="thought-puff"
            style={{
                position: "relative",
                width: size + 4,
                height: size + 4,
                marginTop: 3,
                "--puff-x": `${driftX}px`,
                "--puff-y": `${driftY}px`,
                "--puff-delay": `${delay}s`,
            }}
        >
            <div style={{
                position: "absolute", inset: 0, background: "#000",
                clipPath: "polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)",
            }} />
            <div style={{
                position: "absolute", inset: 2, background: "#fff",
                clipPath: "polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)",
            }} />
        </div>
    );
}

function TheatreScreen({ track, accent, sendWS }) {
    const { leftPct, topPct, widthPct, heightPct } = THEATRE_SCREEN_BBOX;
    const startSeconds = useMemo(() => {
        if (!track?.video_id || !track?.started_ts) return 0;
        return Math.floor(elapsedSinceStart(track.started_ts));
    }, [track?.video_id, track?.started_ts]);
    const iframeRef = useRef(null);

    // YouTube IFrame API requires a "listening" handshake before it sends events back.
    // After the iframe loads, postMessage `event=listening`; the player then emits
    // `onStateChange` events (state=0 means ENDED).
    useEffect(() => {
        if (!track?.video_id) return undefined;
        const onMsg = (ev) => {
            if (typeof ev.data !== "string") return;
            let payload;
            try { payload = JSON.parse(ev.data); } catch { return; }
            if (payload?.event === "onStateChange" && payload.info === 0 && sendWS) {
                // ENDED → advance the queue. Backend will broadcast the next track.
                sendWS({ type: "youtube_next" });
            }
        };
        window.addEventListener("message", onMsg);
        // Tell the player to start firing events
        const tell = () => {
            const win = iframeRef.current?.contentWindow;
            if (!win) return;
            try {
                win.postMessage(JSON.stringify({ event: "listening", id: track.video_id }), "*");
            } catch { /* noop */ }
        };
        const t1 = setTimeout(tell, 800);
        return () => {
            clearTimeout(t1);
            window.removeEventListener("message", onMsg);
        };
    }, [track?.video_id, sendWS]);

    // Drift correction — every 30s, send a seekTo command to the iframe so all viewers
    // converge on (now − started_ts).
    useEffect(() => {
        if (!track?.video_id || !track?.started_ts) return undefined;
        const tick = () => {
            const target = elapsedSinceStart(track.started_ts);
            const win = iframeRef.current?.contentWindow;
            if (!win) return;
            try {
                win.postMessage(JSON.stringify({
                    event: "command", func: "seekTo", args: [target, true],
                }), "*");
                win.postMessage(JSON.stringify({
                    event: "command", func: "playVideo", args: [],
                }), "*");
            } catch { /* noop */ }
        };
        const handle = setInterval(tick, 30000);
        return () => clearInterval(handle);
    }, [track?.video_id, track?.started_ts]);
    return (
        <div
            data-testid="theatre-screen"
            style={{
                position: "absolute",
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                pointerEvents: "auto",
                background: "#000",
                border: `2px solid ${accent}`,
                boxShadow: `0 0 12px ${accent}, inset 0 0 12px rgba(0,0,0,0.7)`,
                overflow: "hidden",
                zIndex: 2,
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {track && track.video_id ? (
                <iframe
                    ref={iframeRef}
                    key={`${track.video_id}-${track.started_ts || 0}`}
                    title={`yt-${track.video_id}`}
                    src={youtubeEmbedUrl(track.video_id, { autoplay: 1, mute: 0, startSeconds })}
                    style={{
                        width: "100%", height: "100%", border: 0,
                        background: "#000",
                    }}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                />
            ) : (
                <div
                    className="font-pixel blink"
                    style={{
                        width: "100%", height: "100%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: accent, fontSize: 14, textAlign: "center",
                        background: "#001100",
                    }}
                >
                    ◉ NO SIGNAL — PASTE A YOUTUBE LINK ◉
                </div>
            )}
        </div>
    );
}
