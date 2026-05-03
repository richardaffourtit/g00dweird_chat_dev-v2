import React, { useEffect, useRef, useState } from "react";

const CANVAS_W = 1536;
const CANVAS_H = 1536;
const BASE = "/scenery/neoclassick_phase2";
const ASSET_VERSION = "neo-phase3-20260430c";
const NEO_SHEET_SRC = `${BASE}/neo_spritesheet.png?v=neo-sheet-20260430b`;
const NEO_ACTION_INTERVAL_MS = 55000;
const SHOW_SMALL_NEO = false;
const NEOCG_BG_SRC = "/worlds/neoclassick-back-nine/hole_1.png?v=neoclassick-back-nine-20260503a";
const MOON_FACE_SRC = `${BASE}/moon_faces.png?v=moon-faces-20260430c`;
const MOON_FACE_CHANGE_MIN_MS = 30000;
const MOON_FACE_CHANGE_RANGE_MS = 30000;
const MOON_FACE_TRANSITION_MS = 2800;

const NEO_SHEET_ACTIONS = {
    idle: { label: "IDLE", x: 118, y: 16, w: 115, h: 104, step: 115, frames: 9, frameMs: 220, renderHeight: 76, holdMs: 3200 },
    walk: { label: "WALK", x: 118, y: 130, w: 115, h: 98, step: 115, frames: 9, frameMs: 125, renderHeight: 78, holdMs: 3600 },
    pray: { label: "PRAY", x: 118, y: 240, w: 115, h: 100, step: 115, frames: 9, frameMs: 170, renderHeight: 78, holdMs: 5200 },
    bless: { label: "BLESS", x: 118, y: 350, w: 115, h: 102, step: 115, frames: 9, frameMs: 145, renderHeight: 82, holdMs: 5000 },
    miracle_light: { label: "MIRACLE LIGHT", x: 118, y: 464, w: 115, h: 104, step: 115, frames: 9, frameMs: 135, renderHeight: 86, holdMs: 5400 },
    heal: { label: "HEAL", x: 118, y: 576, w: 115, h: 98, step: 115, frames: 9, frameMs: 155, renderHeight: 84, holdMs: 5600 },
    water_miracle: { label: "WATER MIRACLE", x: 118, y: 679, w: 115, h: 106, step: 115, frames: 9, frameMs: 145, renderHeight: 86, holdMs: 5600 },
    feed_multitude: { label: "FEED MULTITUDE", x: 118, y: 787, w: 115, h: 96, step: 115, frames: 9, frameMs: 165, renderHeight: 84, holdMs: 5900 },
    teach: { label: "TEACH", x: 118, y: 898, w: 115, h: 94, step: 115, frames: 9, frameMs: 170, renderHeight: 80, holdMs: 5200 },
    ascend: { label: "ASCEND", x: 118, y: 990, w: 115, h: 126, step: 115, frames: 9, frameMs: 145, renderHeight: 88, holdMs: 5400 },
    teleport: { label: "TELEPORT", x: 118, y: 1128, w: 115, h: 104, step: 115, frames: 9, frameMs: 130, renderHeight: 78, holdMs: 4300 },
};

const NEO_RANDOM_ACTIONS = [
    "pray",
    "bless",
    "miracle_light",
    "heal",
    "water_miracle",
    "feed_multitude",
    "teach",
    "ascend",
    "teleport",
];

const NEO_ROUTE = [
    { x: 760, y: 630, z: 36, facing: "right", stance: "idle" },
    { x: 890, y: 706, z: 42, facing: "right", stance: "walk" },
    { x: 1094, y: 846, z: 50, facing: "right", stance: "walk" },
    { x: 1194, y: 902, z: 58, facing: "left", stance: "bless" },
    { x: 1022, y: 982, z: 56, facing: "left", stance: "idle" },
    { x: 744, y: 914, z: 54, facing: "left", stance: "walk" },
    { x: 510, y: 760, z: 46, facing: "left", stance: "walk" },
    { x: 622, y: 652, z: 39, facing: "right", stance: "walk" },
];

const NEO_SHEET_ROUTE = [
    { x: 705, y: 645, z: 38, facing: "right", stance: "idle" },
    { x: 840, y: 735, z: 44, facing: "right", stance: "walk" },
    { x: 1015, y: 820, z: 50, facing: "right", stance: "walk" },
    { x: 1168, y: 792, z: 48, facing: "left", stance: "idle" },
    { x: 1098, y: 690, z: 42, facing: "left", stance: "walk" },
    { x: 902, y: 648, z: 40, facing: "left", stance: "walk" },
];

let neoSheetImagePromise = null;
const neoSheetFrameCache = new Map();
let moonFaceImagePromise = null;
const moonFaceFrameCache = new Map();

const MOON_FACE_LABELS = [
    "WATCHING", "GRIN", "MELT", "WINK", "THIRD EYE", "SMOKE", "DREAM", "DISTORT",
    "TEARS", "STAR BATH", "STATIC", "DIZZY", "DOTS", "BREATHE", "PHASE", "VHS",
    "TRIP", "SPIRAL", "SLEEPLESS", "GLITCH", "ECHO", "FLOAT", "WEIGHTLESS", "CRACKED",
    "LAUGH", "SCREAM", "WHISPER", "SHY", "KISS", "LICK", "BITE", "DEVOUR",
    "BLEED", "CRY STARS", "PSYCHEDELIC", "ACID", "SEE YOU", "BEHIND YOU", "NOT OK", "WRONG",
    "ASCEND", "DESCEND", "COLLAPSE", "OBLIVION", "REBIRTH", "COSMIC", "CONTACT", "UNKNOWN",
];

const MOON_FACE_ROWS = [96, 288, 480, 674, 860, 1048];
const MOON_FACE_CELL_W = CANVAS_W / 8;
const MOON_FACE_CROP_INSET_X = 6;
const MOON_FACE_CROP_INSET_TOP = 3;
const MOON_FACE_CROP_INSET_BOTTOM = 4;
const MOON_FACE_CROP_H = 146;
const MOON_FACE_EDGE_GUTTER = 2;
const MOON_FACE_CANVAS_SIZE = 156;
const MOON_FACE_INNER_PADDING = 6;

const WATERFALLS = [
    {
        id: "left",
        z: 28,
        hue: "#62f6ff",
        streams: [
            { x: 296, y: 1028, w: 4, h: 134, delay: 0 },
            { x: 301, y: 1029, w: 5, h: 132, delay: -180 },
            { x: 307, y: 1031, w: 4, h: 130, delay: -320 },
            { x: 313, y: 1034, w: 4, h: 126, delay: -90 },
            { x: 319, y: 1040, w: 3, h: 118, delay: -260 },
        ],
    },
    {
        id: "right-blue",
        z: 28,
        hue: "#62f6ff",
        streams: [
            { x: 1345, y: 1090, w: 5, h: 178, delay: -80 },
            { x: 1351, y: 1092, w: 5, h: 176, delay: -260 },
            { x: 1358, y: 1094, w: 4, h: 174, delay: -420 },
            { x: 1365, y: 1098, w: 5, h: 168, delay: -160 },
            { x: 1372, y: 1106, w: 4, h: 158, delay: -340 },
        ],
    },
    {
        id: "right-pink",
        z: 29,
        hue: "#ff6ec7",
        streams: [
            { x: 972, y: 1267, w: 5, h: 190, delay: -110 },
            { x: 980, y: 1269, w: 6, h: 188, delay: -280 },
            { x: 989, y: 1271, w: 5, h: 186, delay: -450 },
            { x: 998, y: 1274, w: 6, h: 180, delay: -210 },
            { x: 1008, y: 1280, w: 5, h: 172, delay: -360 },
            { x: 1018, y: 1290, w: 4, h: 158, delay: -530 },
        ],
    },
];

const EQUALIZER_BARS = [
    { x: 687, y: 150, w: 8, h: 64, color: "#ff6ec7", delay: 0 },
    { x: 701, y: 131, w: 9, h: 84, color: "#62f6ff", delay: -120 },
    { x: 717, y: 108, w: 9, h: 108, color: "#8b5cff", delay: -240 },
    { x: 733, y: 88, w: 10, h: 130, color: "#62f6ff", delay: -360 },
    { x: 751, y: 70, w: 11, h: 150, color: "#69a7ff", delay: -480 },
    { x: 769, y: 88, w: 10, h: 130, color: "#8b5cff", delay: -300 },
    { x: 787, y: 110, w: 9, h: 106, color: "#62f6ff", delay: -180 },
    { x: 805, y: 134, w: 8, h: 82, color: "#ff6ec7", delay: -60 },
    { x: 821, y: 154, w: 7, h: 60, color: "#62f6ff", delay: -420 },
];

const EQUALIZER_BASE_GLOW = { x: 657, y: 174, w: 210, h: 76 };

const HOLOGRAM_PANELS = [
    { id: "left-waveform", x: 335, y: 512, w: 122, h: 44, z: 33, color: "#62f6ff", delay: 0 },
    {
        id: "left-temple-screen",
        x: 604,
        y: 388,
        w: 45,
        h: 48,
        z: 32,
        color: "#62f6ff",
        delay: -260,
        skew: -12,
        yOffset: 0.2,
        borderRadius: "3px 3px 12px 12px",
        transformOrigin: "top center",
    },
    {
        id: "right-temple-screen",
        x: 890,
        y: 390,
        w: 46,
        h: 48,
        z: 32,
        color: "#62f6ff",
        delay: -520,
        skew: 12,
        yOffset: 0.2,
        borderRadius: "3px 3px 12px 12px",
        transformOrigin: "top center",
    },
    { id: "right-mic-sign", x: 1190, y: 594, w: 58, h: 76, z: 34, color: "#b86cff", delay: -180 },
];

const STAR_POINTS = [
    [226, 90, 4], [393, 136, 3], [995, 154, 5], [1370, 130, 4],
    [250, 612, 3], [570, 535, 4], [878, 328, 3], [1288, 582, 4],
];

function pctX(x) {
    return `${(x / CANVAS_W) * 100}%`;
}

function pctY(y) {
    return `${(y / CANVAS_H) * 100}%`;
}

export default function NeoclassickPhase2Scene({ backgroundSrc = NEOCG_BG_SRC } = {}) {
    const [step, setStep] = useState(0);
    const [sheetStep, setSheetStep] = useState(0);
    const [sheetAction, setSheetAction] = useState(null);

    useEffect(() => {
        const id = setInterval(() => {
            setStep((value) => (value + 1) % NEO_ROUTE.length);
        }, 5400);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (sheetAction) return undefined;
        const id = setInterval(() => {
            setSheetStep((value) => (value + 1) % NEO_SHEET_ROUTE.length);
        }, 7800);
        return () => clearInterval(id);
    }, [sheetAction]);

    useEffect(() => {
        const timeouts = [];
        const runAction = () => {
            const action = NEO_RANDOM_ACTIONS[Math.floor(Math.random() * NEO_RANDOM_ACTIONS.length)] || "bless";
            const def = NEO_SHEET_ACTIONS[action] || NEO_SHEET_ACTIONS.idle;
            setSheetAction(action);
            if (action === "teleport") {
                timeouts.push(window.setTimeout(() => {
                    setSheetStep((value) => (value + 2 + Math.floor(Math.random() * 3)) % NEO_SHEET_ROUTE.length);
                }, Math.max(900, def.holdMs * 0.58)));
            }
            timeouts.push(window.setTimeout(() => {
                setSheetAction(null);
            }, def.holdMs));
        };

        const id = window.setInterval(runAction, NEO_ACTION_INTERVAL_MS);
        return () => {
            window.clearInterval(id);
            timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
        };
    }, []);

    const point = NEO_ROUTE[step];
    const sheetPoint = NEO_SHEET_ROUTE[sheetStep];
    const sheetActionName = sheetAction || sheetPoint.stance || "idle";

    return (
        <div className="absolute inset-0 pointer-events-none" data-testid="neoclassick-phase2-scene" aria-hidden>
            <style>{`
                @keyframes neo-galaxy-swirl {
                    to { transform: rotate(360deg) scale(1.02); }
                }
                @keyframes neo-nebula-drift {
                    0%, 100% { transform: translate3d(0,0,0) scale(1); opacity: 0.28; }
                    50% { transform: translate3d(-14px,8px,0) scale(1.04); opacity: 0.46; }
                }
                @keyframes neo-moon-float {
                    0%, 100% { transform: translate(-50%, -50%) translate3d(0,0,0); }
                    50% { transform: translate(-50%, -50%) translate3d(-6px,5px,0); }
                }
                @keyframes neo-moon-aura {
                    0%, 100% { opacity: 0.42; transform: translate(-50%, -50%) scale(0.92); }
                    50% { opacity: 0.78; transform: translate(-50%, -50%) scale(1.08); }
                }
                @keyframes neo-star-twinkle {
                    0%, 100% { opacity: 0.18; transform: scale(0.7); }
                    45% { opacity: 0.9; transform: scale(1.35); }
                }
                @keyframes neo-eq-pulse {
                    0%, 100% { transform: scaleY(0.54); opacity: 0.38; }
                    45% { transform: scaleY(1); opacity: 0.86; }
                    70% { transform: scaleY(0.74); opacity: 0.56; }
                }
                @keyframes neo-record-spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes neo-neon-flicker {
                    0%, 100% { opacity: 0.78; filter: drop-shadow(0 0 4px #b86cff); }
                    18% { opacity: 0.48; }
                    21% { opacity: 0.95; filter: drop-shadow(0 0 10px #ff6ec7); }
                    54% { opacity: 0.7; }
                    56% { opacity: 0.98; }
                }
                @keyframes neo-waterfall {
                    from { background-position-y: 0; }
                    to { background-position-y: 54px; }
                }
                @keyframes neo-waterfall-segment {
                    0% { transform: translateY(-22px); opacity: 0.18; }
                    35% { opacity: 0.72; }
                    100% { transform: translateY(24px); opacity: 0.24; }
                }
                @keyframes neo-hologram-scan {
                    0% { transform: translateY(-110%); opacity: 0; }
                    28% { opacity: 0.85; }
                    100% { transform: translateY(120%); opacity: 0; }
                }
                @keyframes neo-hologram-flicker {
                    0%, 100% { opacity: 0.2; }
                    14% { opacity: 0.52; }
                    16% { opacity: 0.28; }
                    44% { opacity: 0.62; }
                    48% { opacity: 0.36; }
                    70% { opacity: 0.55; }
                }
                @keyframes neo-portal-pulse {
                    0%, 100% { opacity: 0.28; transform: translate(-50%, -50%) scale(0.96); }
                    50% { opacity: 0.68; transform: translate(-50%, -50%) scale(1.05); }
                }
                @keyframes neo-tree-sway {
                    0%, 100% { transform: translateX(0) rotate(-1deg); }
                    50% { transform: translateX(4px) rotate(1deg); }
                }
                @keyframes neo-resident-breathe {
                    0%, 100% { transform: translate(-50%, -100%) translateY(0); }
                    50% { transform: translate(-50%, -100%) translateY(-3px); }
                }
                @keyframes neo-sheet-presence {
                    0%, 100% { transform: translate(-50%, -100%) translateY(0); }
                    50% { transform: translate(-50%, -100%) translateY(-2px); }
                }
                @keyframes neo-sheet-glow {
                    0%, 100% { opacity: 0.62; transform: translate(-50%, -50%) scale(0.92); }
                    50% { opacity: 0.98; transform: translate(-50%, -50%) scale(1.05); }
                }
            `}</style>

            <CosmicMotion backgroundSrc={backgroundSrc} />
            <MoonFaceOrb />
            <EqualizerHolograms />
            {HOLOGRAM_PANELS.map((panel) => (
                <HologramPanel key={panel.id} panel={panel} />
            ))}

            <div
                data-testid="neoclassick-record-spin"
                style={{
                    position: "absolute",
                    left: pctX(765),
                    top: pctY(722),
                    width: pctX(76),
                    aspectRatio: "1 / 1",
                    zIndex: 25,
                    borderRadius: "50%",
                    border: "3px solid rgba(247,221,255,0.36)",
                    background:
                        "radial-gradient(circle, rgba(255,255,255,0.72) 0 7%, rgba(0,0,0,0) 8% 28%, rgba(139,92,255,0.62) 29% 32%, rgba(0,0,0,0) 33% 58%, rgba(98,246,255,0.46) 59% 62%, rgba(0,0,0,0) 63%)",
                    mixBlendMode: "screen",
                    opacity: 0.62,
                    animation: "neo-record-spin 3.8s linear infinite",
                    transformOrigin: "center",
                }}
            />

            <div
                data-testid="neoclassick-neon-sign"
                style={{
                    position: "absolute",
                    left: pctX(705),
                    top: pctY(245),
                    zIndex: 32,
                    width: pctX(64),
                    height: pctY(64),
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(247,221,255,0.42), rgba(184,108,255,0.22) 42%, rgba(0,0,0,0) 70%)",
                    boxShadow: "0 0 18px rgba(184,108,255,0.48)",
                    mixBlendMode: "screen",
                    animation: "neo-neon-flicker 4.4s steps(5, end) infinite",
                }}
            />

            {WATERFALLS.map((fall) => (
                <WaterfallFlow key={fall.id} fall={fall} />
            ))}
            <PortalGlow x={1188} y={810} size={112} />
            <PortalGlow x={1320} y={972} size={86} hot />
            <TreeSway x={506} y={392} w={84} h={116} />
            <TreeSway x={1086} y={842} w={100} h={92} />

            {SHOW_SMALL_NEO && (
                <div
                    data-testid="neo-ambient-sprite"
                    data-version="sliced-v1"
                    style={{
                        position: "absolute",
                        left: pctX(point.x),
                        top: pctY(point.y),
                        zIndex: point.z,
                        transition: "left 5.2s cubic-bezier(.22,.78,.3,1), top 5.2s cubic-bezier(.22,.78,.3,1)",
                        animation: "neo-resident-breathe 1.9s ease-in-out infinite",
                        filter: "drop-shadow(0 0 5px rgba(139,92,255,0.9)) drop-shadow(0 0 12px rgba(98,246,255,0.55))",
                    }}
                >
                    <NeoSprite state={point.stance} flip={point.facing === "left"} />
                </div>
            )}

            <div
                data-testid="neo-spritesheet-resident"
                data-version="spritesheet-v2"
                data-action={sheetActionName}
                style={{
                    position: "absolute",
                    left: pctX(sheetPoint.x),
                    top: pctY(sheetPoint.y),
                    zIndex: sheetPoint.z,
                    transition: sheetAction ? "none" : "left 7.4s cubic-bezier(.22,.78,.3,1), top 7.4s cubic-bezier(.22,.78,.3,1)",
                    animation: "neo-sheet-presence 2.4s ease-in-out infinite",
                    filter: "drop-shadow(0 0 5px rgba(255,192,64,0.72)) drop-shadow(0 0 13px rgba(184,108,255,0.46))",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        top: "46%",
                        width: sheetActionName === "ascend" ? 82 : 58,
                        height: sheetActionName === "ascend" ? 106 : 72,
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(255,214,91,0.34), rgba(184,108,255,0.16) 45%, rgba(0,0,0,0) 74%)",
                        mixBlendMode: "screen",
                        animation: "neo-sheet-glow 2.2s ease-in-out infinite",
                    }}
                />
                <NeoSheetSprite action={sheetActionName} flip={sheetPoint.facing === "left"} />
            </div>
        </div>
    );
}

function CosmicMotion({ backgroundSrc = NEOCG_BG_SRC }) {
    return (
        <>
                <div
                    data-testid="neoclassick-galaxy-swirl"
                    style={{
                        position: "absolute",
                        left: pctX(168),
                        top: pctY(80),
                        width: pctX(250),
                        height: pctX(250),
                        zIndex: 4,
                        borderRadius: "50%",
                        backgroundImage: `url(${backgroundSrc})`,
                        backgroundRepeat: "no-repeat",
                        backgroundSize: `${CANVAS_W}px ${CANVAS_H}px`,
                        backgroundPosition: "-168px -80px",
                        imageRendering: "pixelated",
                        mixBlendMode: "screen",
                        opacity: 0.26,
                        filter: "blur(0.8px)",
                        animation: "neo-galaxy-swirl 28s linear infinite",
                        pointerEvents: "none",
                    }}
                />
            <div
                data-testid="neoclassick-nebula-drift"
                style={{
                    position: "absolute",
                    left: pctX(958),
                    top: pctY(74),
                    width: pctX(240),
                    height: pctY(210),
                    zIndex: 4,
                    background:
                        "radial-gradient(circle at 55% 36%, rgba(255,110,199,0.54), rgba(184,108,255,0.24) 30%, rgba(0,0,0,0) 66%)",
                    mixBlendMode: "screen",
                    animation: "neo-nebula-drift 17s ease-in-out infinite",
                }}
            />
            {STAR_POINTS.map(([x, y, size], index) => (
                <span
                    key={`${x}-${y}`}
                    data-testid="neoclassick-star-twinkle"
                    style={{
                        position: "absolute",
                        left: pctX(x),
                        top: pctY(y),
                        width: size,
                        height: size,
                        zIndex: 5,
                        background: "#fff",
                        boxShadow: "0 0 8px #62f6ff, 0 0 14px #ff6ec7",
                        clipPath: "polygon(50% 0,60% 38%,100% 50%,60% 62%,50% 100%,40% 62%,0 50%,40% 38%)",
                        opacity: 0.5,
                        animation: `neo-star-twinkle ${2.3 + index * 0.22}s steps(4, end) infinite`,
                        animationDelay: `${index * -0.31}s`,
                    }}
                />
            ))}
        </>
    );
}

function loadMoonFaceImage() {
    if (!moonFaceImagePromise) {
        moonFaceImagePromise = new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = MOON_FACE_SRC;
        });
    }
    return moonFaceImagePromise;
}

function getMoonFaceDef(index) {
    const safeIndex = ((index % MOON_FACE_LABELS.length) + MOON_FACE_LABELS.length) % MOON_FACE_LABELS.length;
    const row = Math.floor(safeIndex / 8);
    const col = safeIndex % 8;
    const cellLeft = Math.round(col * MOON_FACE_CELL_W);
    const cellRight = Math.round((col + 1) * MOON_FACE_CELL_W);
    return {
        index: safeIndex,
        label: MOON_FACE_LABELS[safeIndex],
        x: cellLeft + MOON_FACE_CROP_INSET_X,
        y: MOON_FACE_ROWS[row] + MOON_FACE_CROP_INSET_TOP,
        w: Math.max(1, cellRight - cellLeft - MOON_FACE_CROP_INSET_X * 2),
        h: Math.max(1, MOON_FACE_CROP_H - MOON_FACE_CROP_INSET_TOP - MOON_FACE_CROP_INSET_BOTTOM),
    };
}

function getMoonFaceCanvas(image, index) {
    const def = getMoonFaceDef(index);
    const key = `moon:clean-crop-v3:${def.index}`;
    if (moonFaceFrameCache.has(key)) return moonFaceFrameCache.get(key);

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = def.w;
    sourceCanvas.height = def.h;
    const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    sourceCtx.imageSmoothingEnabled = false;
    sourceCtx.clearRect(0, 0, def.w, def.h);
    sourceCtx.drawImage(image, def.x, def.y, def.w, def.h, 0, 0, def.w, def.h);
    const keyed = matteRedToTransparent(
        sourceCtx.getImageData(0, 0, def.w, def.h),
        { redTolerance: "moon" }
    );
    clearImageDataEdgeGutter(keyed, MOON_FACE_EDGE_GUTTER);
    sourceCtx.putImageData(keyed, 0, 0);

    const bounds = getOpaqueBounds(keyed) || { x: 0, y: 0, w: def.w, h: def.h };
    const maxDraw = MOON_FACE_CANVAS_SIZE - MOON_FACE_INNER_PADDING * 2;
    const scale = Math.min(maxDraw / bounds.w, maxDraw / bounds.h, 1.18);
    const drawW = Math.max(1, Math.round(bounds.w * scale));
    const drawH = Math.max(1, Math.round(bounds.h * scale));
    const drawX = Math.round((MOON_FACE_CANVAS_SIZE - drawW) / 2);
    const drawY = Math.round((MOON_FACE_CANVAS_SIZE - drawH) / 2);

    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = MOON_FACE_CANVAS_SIZE;
    frameCanvas.height = MOON_FACE_CANVAS_SIZE;
    const frameCtx = frameCanvas.getContext("2d", { willReadFrequently: true });
    frameCtx.imageSmoothingEnabled = false;
    frameCtx.clearRect(0, 0, MOON_FACE_CANVAS_SIZE, MOON_FACE_CANVAS_SIZE);
    frameCtx.drawImage(
        sourceCanvas,
        bounds.x,
        bounds.y,
        bounds.w,
        bounds.h,
        drawX,
        drawY,
        drawW,
        drawH
    );
    moonFaceFrameCache.set(key, frameCanvas);
    return frameCanvas;
}

function getOpaqueBounds(imageData) {
    const { data, width, height } = imageData;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha <= 16) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }

    if (maxX < minX || maxY < minY) return null;
    return {
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
    };
}

function clearImageDataEdgeGutter(imageData, gutter) {
    if (!gutter) return imageData;
    const { data, width, height } = imageData;
    const safeGutter = Math.max(0, Math.min(gutter, Math.floor(Math.min(width, height) / 2)));
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (
                x >= safeGutter &&
                y >= safeGutter &&
                x < width - safeGutter &&
                y < height - safeGutter
            ) {
                continue;
            }
            data[(y * width + x) * 4 + 3] = 0;
        }
    }
    return imageData;
}

function drawMoonFace(ctx, image, index, alpha, pulse = 0) {
    const frame = getMoonFaceCanvas(image, index);
    const scale = 1 + pulse * 0.04;
    const width = Math.round(MOON_FACE_CANVAS_SIZE * scale);
    const height = Math.round(MOON_FACE_CANVAS_SIZE * scale);
    const x = Math.round((MOON_FACE_CANVAS_SIZE - width) / 2);
    const y = Math.round((MOON_FACE_CANVAS_SIZE - height) / 2);
    ctx.globalAlpha = alpha;
    ctx.drawImage(frame, x, y, width, height);
    ctx.globalAlpha = 1;
}

function MoonFaceOrb() {
    const canvasRef = useRef(null);
    const [faceLabel, setFaceLabel] = useState(MOON_FACE_LABELS[0]);

    useEffect(() => {
        let cancelled = false;
        let rafId = null;
        let timeoutId = null;
        let currentFace = 0;
        let nextFace = 1;
        let transitionStart = 0;
        let isTransitioning = false;

        const pickNextFace = () => {
            let picked = Math.floor(Math.random() * MOON_FACE_LABELS.length);
            if (picked === currentFace) picked = (picked + 7) % MOON_FACE_LABELS.length;
            nextFace = picked;
            transitionStart = performance.now();
            isTransitioning = true;
        };

        const scheduleNextFace = () => {
            const delay = MOON_FACE_CHANGE_MIN_MS + Math.random() * MOON_FACE_CHANGE_RANGE_MS;
            timeoutId = window.setTimeout(pickNextFace, delay);
        };

        loadMoonFaceImage().then((image) => {
            if (cancelled) return;
            const draw = (now) => {
                const canvas = canvasRef.current;
                const ctx = canvas?.getContext("2d");
                if (!ctx || !canvas) return;
                if (canvas.width !== MOON_FACE_CANVAS_SIZE) canvas.width = MOON_FACE_CANVAS_SIZE;
                if (canvas.height !== MOON_FACE_CANVAS_SIZE) canvas.height = MOON_FACE_CANVAS_SIZE;
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, MOON_FACE_CANVAS_SIZE, MOON_FACE_CANVAS_SIZE);

                if (isTransitioning) {
                    const t = Math.min(1, (now - transitionStart) / MOON_FACE_TRANSITION_MS);
                    const eased = 0.5 - Math.cos(t * Math.PI) / 2;
                    drawMoonFace(ctx, image, currentFace, 1 - eased, eased);
                    drawMoonFace(ctx, image, nextFace, eased, 1 - eased);
                    if (t >= 1) {
                        currentFace = nextFace;
                        setFaceLabel(MOON_FACE_LABELS[currentFace]);
                        isTransitioning = false;
                        scheduleNextFace();
                    }
                } else {
                    drawMoonFace(ctx, image, currentFace, 1, 0);
                }

                if (!cancelled) rafId = window.requestAnimationFrame(draw);
            };

            setFaceLabel(MOON_FACE_LABELS[currentFace]);
            scheduleNextFace();
            rafId = window.requestAnimationFrame(draw);
        });

        return () => {
            cancelled = true;
            if (rafId) window.cancelAnimationFrame(rafId);
            if (timeoutId) window.clearTimeout(timeoutId);
        };
    }, []);

    return (
        <div
            data-testid="neoclassick-moon-face"
            data-face={faceLabel}
            title={`Moon face: ${faceLabel}`}
            style={{
                position: "absolute",
                left: pctX(1238),
                top: pctY(236),
                width: pctX(122),
                height: pctY(122),
                zIndex: 10,
                animation: "neo-moon-float 12s ease-in-out infinite",
                filter: "drop-shadow(0 0 8px rgba(255,225,130,0.8)) drop-shadow(0 0 20px rgba(184,108,255,0.42))",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: "118%",
                    height: "118%",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(255,231,159,0.34), rgba(184,108,255,0.18) 48%, rgba(0,0,0,0) 72%)",
                    mixBlendMode: "screen",
                    animation: "neo-moon-aura 5.8s ease-in-out infinite",
                }}
            />
            <canvas
                ref={canvasRef}
                width={MOON_FACE_CANVAS_SIZE}
                height={MOON_FACE_CANVAS_SIZE}
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    display: "block",
                    imageRendering: "pixelated",
                }}
            />
        </div>
    );
}

function EqualizerHolograms() {
    return (
        <div data-testid="neoclassick-equalizer" aria-hidden>
            <span
                data-testid="neoclassick-equalizer-base-glow"
                style={{
                    position: "absolute",
                    left: pctX(EQUALIZER_BASE_GLOW.x),
                    top: pctY(EQUALIZER_BASE_GLOW.y),
                    width: pctX(EQUALIZER_BASE_GLOW.w),
                    height: pctY(EQUALIZER_BASE_GLOW.h),
                    zIndex: 21,
                    borderRadius: "50%",
                    background: "radial-gradient(ellipse at 50% 56%, rgba(255,255,255,0.34), rgba(98,246,255,0.34) 28%, rgba(184,108,255,0.18) 58%, rgba(0,0,0,0) 74%)",
                    boxShadow: "0 0 10px rgba(98,246,255,0.34), 0 0 18px rgba(184,108,255,0.22)",
                    clipPath: "ellipse(48% 43% at 50% 58%)",
                    mixBlendMode: "screen",
                    opacity: 0.52,
                }}
            />
            {EQUALIZER_BARS.map((bar, index) => (
                <span
                    key={`${bar.x}-${bar.y}`}
                    data-testid="neoclassick-equalizer-bar"
                    style={{
                        position: "absolute",
                        left: pctX(bar.x),
                        top: pctY(bar.y),
                        width: pctX(bar.w),
                        height: pctY(bar.h),
                        zIndex: 22,
                        overflow: "hidden",
                        borderRadius: "999px 999px 8px 8px",
                        background: `linear-gradient(180deg, ${bar.color}20, ${bar.color}68 40%, rgba(255,255,255,0.34) 84%, rgba(255,255,255,0.08))`,
                        boxShadow: `0 0 6px ${bar.color}88, inset 0 -8px 9px rgba(255,255,255,0.12)`,
                        mixBlendMode: "screen",
                        opacity: 0.7,
                        transformOrigin: "center bottom",
                        animation: `neo-eq-pulse ${0.92 + index * 0.04}s steps(5, end) infinite`,
                        animationDelay: `${bar.delay}ms`,
                    }}
                >
                    <i
                        style={{
                            position: "absolute",
                            inset: "0 1px",
                            background: "repeating-linear-gradient(180deg, rgba(255,255,255,0.82) 0 2px, rgba(255,255,255,0) 2px 7px)",
                            opacity: 0.42,
                        }}
                    />
                </span>
            ))}
        </div>
    );
}

function HologramPanel({ panel }) {
    const skewStyle = panel.skew ? {
        transform: `skewX(${panel.skew}deg)`,
        transformOrigin: panel.transformOrigin || "center center",
        top: `calc(${pctY(panel.y)} + ${pctY(panel.h * (panel.yOffset || 0))})`,
    } : {};

    return (
        <div
            data-testid={`neoclassick-hologram-panel-${panel.id}`}
            style={{
                position: "absolute",
                left: pctX(panel.x),
                top: pctY(panel.y),
                width: pctX(panel.w),
                height: pctY(panel.h),
                zIndex: panel.z,
                overflow: "hidden",
                borderRadius: panel.borderRadius || "2px",
                background: `linear-gradient(90deg, rgba(0,0,0,0), ${panel.color}28 50%, rgba(0,0,0,0))`,
                boxShadow: `inset 0 0 8px ${panel.color}44, 0 0 9px ${panel.color}33`,
                mixBlendMode: "screen",
                opacity: 0.45,
                animation: "neo-hologram-flicker 3.7s steps(5, end) infinite",
                animationDelay: `${panel.delay}ms`,
                ...skewStyle,
            }}
        >
            <span
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: "38%",
                    top: 0,
                    background: `linear-gradient(180deg, rgba(255,255,255,0), ${panel.color}dd, rgba(255,255,255,0))`,
                    animation: "neo-hologram-scan 1.8s steps(9, end) infinite",
                    animationDelay: `${panel.delay}ms`,
                }}
            />
            <span
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "repeating-linear-gradient(180deg, rgba(255,255,255,0.12) 0 1px, rgba(255,255,255,0) 1px 6px)",
                    opacity: 0.65,
                }}
            />
        </div>
    );
}

function WaterfallFlow({ fall }) {
    const segmentHeight = 34;
    return (
        <>
            {fall.streams.map((stream, streamIndex) => (
                <div
                    key={`${fall.id}-${stream.x}`}
                    data-testid={`neoclassick-waterfall-flow-${fall.id}`}
                    style={{
                        position: "absolute",
                        left: pctX(stream.x),
                        top: pctY(stream.y),
                        width: pctX(stream.w),
                        height: pctY(stream.h),
                        zIndex: fall.z,
                        overflow: "hidden",
                        borderRadius: 3,
                        background: `linear-gradient(180deg, rgba(255,255,255,0.12), ${fall.hue}24 45%, rgba(255,255,255,0.08))`,
                        boxShadow: `0 0 8px ${fall.hue}66`,
                        mixBlendMode: "screen",
                        opacity: 0.74,
                    }}
                >
                    {Array.from({ length: Math.ceil(stream.h / segmentHeight) + 2 }).map((_, segmentIndex) => (
                        <span
                            key={segmentIndex}
                            style={{
                                position: "absolute",
                                left: 0,
                                top: segmentIndex * segmentHeight - segmentHeight,
                                width: "100%",
                                height: segmentHeight,
                                background:
                                    `linear-gradient(180deg, rgba(255,255,255,0) 0 12%, rgba(255,255,255,0.6) 24%, ${fall.hue}d8 40%, rgba(255,255,255,0.18) 58%, rgba(255,255,255,0) 82%)`,
                                animation: "neo-waterfall-segment 760ms steps(5, end) infinite",
                                animationDelay: `${stream.delay - streamIndex * 45 - segmentIndex * 34}ms`,
                            }}
                        />
                    ))}
                </div>
            ))}
        </>
    );
}

function PortalGlow({ x, y, size, hot = false }) {
    const color = hot ? "#ffb84d" : "#b86cff";
    return (
        <div
            data-testid="neoclassick-portal-glow"
            style={{
                position: "absolute",
                left: pctX(x),
                top: pctY(y),
                width: pctX(size),
                aspectRatio: "1 / 1",
                zIndex: 31,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${color}66, ${color}22 36%, rgba(0,0,0,0) 70%)`,
                mixBlendMode: "screen",
                animation: "neo-portal-pulse 3.8s ease-in-out infinite",
            }}
        />
    );
}

function TreeSway({ x, y, w, h }) {
    return (
        <div
            data-testid="neoclassick-tree-sway"
            style={{
                position: "absolute",
                left: pctX(x),
                top: pctY(y),
                width: pctX(w),
                height: pctY(h),
                zIndex: 34,
                borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(255,110,199,0.28), rgba(184,108,255,0.1) 46%, rgba(0,0,0,0) 72%)",
                mixBlendMode: "screen",
                transformOrigin: "50% 92%",
                animation: "neo-tree-sway 5.8s ease-in-out infinite",
            }}
        />
    );
}

function NeoSprite({ state, flip }) {
    const frames = state === "bless" ? 3 : state === "walk" ? 6 : 3;
    const [frame, setFrame] = useState(0);

    useEffect(() => {
        setFrame(0);
    }, [state]);

    useEffect(() => {
        const id = setInterval(() => {
            setFrame((value) => (value + 1) % frames);
        }, state === "bless" ? 190 : state === "walk" ? 135 : 260);
        return () => clearInterval(id);
    }, [frames, state]);

    return (
        <img
            src={`${BASE}/neo_${state}_${frame}.png?v=${ASSET_VERSION}`}
            alt="Neo"
            draggable={false}
            data-testid="neo-ambient-frame"
            style={{
                height: 70,
                width: "auto",
                display: "block",
                imageRendering: "pixelated",
                transform: flip ? "scaleX(-1)" : "none",
                transformOrigin: "center bottom",
            }}
        />
    );
}

function loadNeoSheetImage() {
    if (!neoSheetImagePromise) {
        neoSheetImagePromise = new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = NEO_SHEET_SRC;
        });
    }
    return neoSheetImagePromise;
}

function matteRedToTransparent(imageData, options = {}) {
    const { data, width, height } = imageData;
    const moonTolerance = options.redTolerance === "moon";
    const seen = new Uint8Array(width * height);
    const stack = [];
    const isMatte = (i) => {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (moonTolerance) {
            return r >= 82 && g <= 124 && b <= 124 && r > g * 1.22 && r > b * 1.22;
        }
        return r >= 150 && g <= 110 && b <= 110 && r > g * 1.55 && r > b * 1.55;
    };
    const add = (x, y) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const index = y * width + x;
        if (seen[index]) return;
        const dataIndex = index * 4;
        if (!isMatte(dataIndex)) return;
        seen[index] = 1;
        stack.push(index);
    };

    for (let x = 0; x < width; x++) {
        add(x, 0);
        add(x, height - 1);
    }
    for (let y = 1; y < height - 1; y++) {
        add(0, y);
        add(width - 1, y);
    }

    while (stack.length) {
        const index = stack.pop();
        const x = index % width;
        const y = Math.floor(index / width);
        data[index * 4 + 3] = 0;
        add(x + 1, y);
        add(x - 1, y);
        add(x, y + 1);
        add(x, y - 1);
    }

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const index = y * width + x;
            if (seen[index]) continue;
            const dataIndex = index * 4;
            if (!isMatte(dataIndex)) continue;
            if (
                seen[index - 1] ||
                seen[index + 1] ||
                seen[index - width] ||
                seen[index + width]
            ) {
                data[dataIndex + 3] = moonTolerance ? 0 : Math.min(data[dataIndex + 3], 72);
            }
        }
    }
    return imageData;
}

function getNeoFrameCanvas(image, action, frameIndex) {
    const def = NEO_SHEET_ACTIONS[action] || NEO_SHEET_ACTIONS.idle;
    const index = frameIndex % def.frames;
    const key = `${action}:${index}`;
    if (neoSheetFrameCache.has(key)) return neoSheetFrameCache.get(key);

    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = def.w;
    frameCanvas.height = def.h;
    const frameCtx = frameCanvas.getContext("2d", { willReadFrequently: true });
    frameCtx.imageSmoothingEnabled = false;
    frameCtx.clearRect(0, 0, def.w, def.h);
    frameCtx.drawImage(
        image,
        def.x + index * def.step,
        def.y,
        def.w,
        def.h,
        0,
        0,
        def.w,
        def.h
    );
    const keyed = matteRedToTransparent(frameCtx.getImageData(0, 0, def.w, def.h));
    frameCtx.putImageData(keyed, 0, 0);
    neoSheetFrameCache.set(key, frameCanvas);
    return frameCanvas;
}

function NeoSheetSprite({ action, flip }) {
    const canvasRef = useRef(null);
    const def = NEO_SHEET_ACTIONS[action] || NEO_SHEET_ACTIONS.idle;
    const displayWidth = Math.round((def.w / def.h) * def.renderHeight);

    useEffect(() => {
        let cancelled = false;
        let frame = 0;
        let intervalId = null;

        const drawFrame = (image) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.width = def.w;
            canvas.height = def.h;
            const ctx = canvas.getContext("2d");
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, def.w, def.h);
            ctx.drawImage(getNeoFrameCanvas(image, action, frame), 0, 0);
            frame = (frame + 1) % def.frames;
        };

        loadNeoSheetImage()
            .then((image) => {
                if (cancelled) return;
                drawFrame(image);
                intervalId = window.setInterval(() => drawFrame(image), def.frameMs);
            })
            .catch(() => {
                const canvas = canvasRef.current;
                const ctx = canvas?.getContext("2d");
                if (!ctx || !canvas) return;
                canvas.width = 70;
                canvas.height = 70;
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, 70, 70);
            });

        return () => {
            cancelled = true;
            if (intervalId) window.clearInterval(intervalId);
        };
    }, [action, def.frameMs, def.frames, def.h, def.w]);

    return (
        <canvas
            ref={canvasRef}
            width={def.w}
            height={def.h}
            data-testid="neo-spritesheet-frame"
            data-neo-action={action}
            title={def.label}
            style={{
                width: displayWidth,
                height: def.renderHeight,
                display: "block",
                imageRendering: "pixelated",
                transform: flip ? "scaleX(-1)" : "none",
                transformOrigin: "center bottom",
            }}
        />
    );
}
