import React, { useEffect, useState } from "react";

const CANVAS_W = 1254;
const CANVAS_H = 1254;
const BASE = "/scenery/spiderweb_phase2";
const ASSET_VERSION = "keyed-20260429";
const SPIDER_SPRITE_META_SRC = `${BASE}/spider_spritesheet.json?v=cardinal-20260501`;

const OBJECTS = [
    {
        id: "web_shimmer_origin",
        sprite: "web_shimmer_128.png",
        frameWidth: 128,
        frameHeight: 128,
        frames: 8,
        frameMs: 120,
        x: 0,
        y: 0,
        z: 10,
        opacity: 0.7,
        blend: "screen",
    },
    {
        id: "web_shimmer_upper_right",
        sprite: "web_shimmer_128.png",
        frameWidth: 128,
        frameHeight: 128,
        frames: 8,
        frameMs: 120,
        x: 1038,
        y: 122,
        z: 10,
        opacity: 0.55,
        blend: "screen",
        delayMs: 320,
    },
    {
        id: "particle_fall_left",
        sprite: "particle_fall_128.png",
        frameWidth: 128,
        frameHeight: 128,
        frames: 8,
        frameMs: 140,
        x: 96,
        y: 36,
        z: 5,
        opacity: 0.42,
        blend: "screen",
        motion: { type: "fall", distanceY: 48, durationSec: 5.8 },
    },
    {
        id: "particle_fall_mid",
        sprite: "particle_fall_128.png",
        frameWidth: 128,
        frameHeight: 128,
        frames: 8,
        frameMs: 140,
        x: 570,
        y: 82,
        z: 5,
        opacity: 0.34,
        blend: "screen",
        delayMs: 260,
        motion: { type: "fall", distanceY: 62, durationSec: 6.8 },
    },
    {
        id: "particle_fall_right",
        sprite: "particle_fall_128.png",
        frameWidth: 128,
        frameHeight: 128,
        frames: 8,
        frameMs: 140,
        x: 1020,
        y: 230,
        z: 5,
        opacity: 0.36,
        blend: "screen",
        delayMs: 520,
        motion: { type: "fall", distanceY: 56, durationSec: 6.2 },
    },
    {
        id: "lanterns",
        sprite: "lantern_flicker_64.png",
        frameWidth: 64,
        frameHeight: 64,
        frames: 8,
        frameMs: 90,
        x: 900,
        y: 200,
        z: 20,
        opacity: 0.86,
        blend: "screen",
    },
    {
        id: "lantern_low_left",
        sprite: "lantern_flicker_64.png",
        frameWidth: 64,
        frameHeight: 64,
        frames: 8,
        frameMs: 90,
        x: 220,
        y: 742,
        z: 20,
        opacity: 0.56,
        blend: "screen",
        delayMs: 160,
    },
    {
        id: "center_rune",
        sprite: "rune_pulse_64.png",
        frameWidth: 64,
        frameHeight: 64,
        frames: 8,
        frameMs: 100,
        x: 900,
        y: 600,
        z: 25,
        opacity: 0.86,
        blend: "screen",
    },
    {
        id: "rune_floor_center",
        sprite: "rune_pulse_64.png",
        frameWidth: 64,
        frameHeight: 64,
        frames: 8,
        frameMs: 100,
        x: 596,
        y: 626,
        z: 24,
        opacity: 0.38,
        blend: "screen",
        delayMs: 420,
    },
];

const SPIDERS = [
    {
        id: "upper_left_crawler",
        direction: "east",
        x: 136,
        y: 288,
        size: 58,
        z: 28,
        frameMs: 120,
        opacity: 0.72,
        motion: { dx: 118, dy: -18, durationSec: 10.5 },
    },
    {
        id: "ceiling_dropper",
        direction: "south",
        x: 704,
        y: 112,
        size: 48,
        z: 28,
        frameMs: 115,
        delayMs: 420,
        opacity: 0.64,
        motion: { dx: 4, dy: 96, durationSec: 8.8 },
    },
    {
        id: "right_wall_scuttle",
        direction: "west",
        x: 1018,
        y: 436,
        size: 62,
        z: 29,
        frameMs: 110,
        delayMs: 880,
        opacity: 0.7,
        motion: { dx: -132, dy: 42, durationSec: 11.4 },
    },
    {
        id: "low_web_walker",
        direction: "north",
        x: 468,
        y: 850,
        size: 54,
        z: 29,
        frameMs: 125,
        delayMs: 260,
        opacity: 0.58,
        motion: { dx: 92, dy: -24, durationSec: 9.6 },
    },
];

const DADDY_LONGLEGS_ROUTE_MS = 6200;
const DADDY_LONGLEGS_SWARM_MS = 18600;
const DADDY_LONGLEGS_ROUTE = [
    { x: 620, y: 614, direction: "south", size: 128, z: 38 },
    { x: 624, y: 366, direction: "north", size: 116, z: 34 },
    { x: 866, y: 514, direction: "east", size: 122, z: 36 },
    { x: 880, y: 884, direction: "south", size: 132, z: 42 },
    { x: 608, y: 1032, direction: "west", size: 126, z: 45 },
    { x: 304, y: 776, direction: "west", size: 118, z: 40 },
    { x: 230, y: 312, direction: "north", size: 108, z: 32 },
    { x: 486, y: 484, direction: "east", size: 120, z: 35 },
];

const DADDY_LONGLEGS_PATTERNS = [
    { id: "few", count: 3 },
    { id: "restless", count: 6 },
    { id: "infestation", count: 15 },
    { id: "aftershock", count: 5 },
    { id: "crowded-corners", count: 10 },
    { id: "quiet", count: 2 },
];

const DADDY_LONGLEGS_INSTANCES = [
    { id: "resident", routeOffset: 0, xJitter: 0, yJitter: 0, sizeScale: 1.0, zOffset: 0, moveScale: 1.0, opacity: 1 },
    { id: "low-left", routeOffset: 5, xJitter: -40, yJitter: 34, sizeScale: 0.72, zOffset: -2, moveScale: 0.86, opacity: 0.78 },
    { id: "ceiling-small", routeOffset: 1, xJitter: -18, yJitter: -62, sizeScale: 0.58, zOffset: -5, moveScale: 1.2, opacity: 0.62 },
    { id: "right-rail", routeOffset: 2, xJitter: 56, yJitter: -12, sizeScale: 0.84, zOffset: 1, moveScale: 0.95, opacity: 0.82 },
    { id: "floor-heavy", routeOffset: 3, xJitter: 34, yJitter: 70, sizeScale: 1.16, zOffset: 4, moveScale: 1.08, opacity: 0.9 },
    { id: "tiny-west", routeOffset: 6, xJitter: -70, yJitter: -22, sizeScale: 0.5, zOffset: -4, moveScale: 0.78, opacity: 0.58 },
    { id: "mid-echo", routeOffset: 7, xJitter: 42, yJitter: 20, sizeScale: 0.68, zOffset: 0, moveScale: 1.34, opacity: 0.7 },
    { id: "big-south", routeOffset: 4, xJitter: -28, yJitter: 92, sizeScale: 1.28, zOffset: 7, moveScale: 1.14, opacity: 0.86 },
    { id: "wall-peeker", routeOffset: 2, xJitter: 110, yJitter: -70, sizeScale: 0.44, zOffset: -6, moveScale: 0.72, opacity: 0.5 },
    { id: "altar-cross", routeOffset: 0, xJitter: -86, yJitter: -10, sizeScale: 0.62, zOffset: -1, moveScale: 1.42, opacity: 0.66 },
    { id: "lantern-walker", routeOffset: 1, xJitter: 72, yJitter: -38, sizeScale: 0.76, zOffset: 2, moveScale: 1.0, opacity: 0.72 },
    { id: "lower-thread", routeOffset: 4, xJitter: 84, yJitter: 18, sizeScale: 0.56, zOffset: 3, moveScale: 0.82, opacity: 0.54 },
    { id: "upper-thread", routeOffset: 6, xJitter: -42, yJitter: -88, sizeScale: 0.48, zOffset: -7, moveScale: 1.18, opacity: 0.5 },
    { id: "door-huge", routeOffset: 3, xJitter: 128, yJitter: 52, sizeScale: 1.38, zOffset: 8, moveScale: 1.26, opacity: 0.78 },
    { id: "table-slink", routeOffset: 7, xJitter: -112, yJitter: 44, sizeScale: 0.64, zOffset: 1, moveScale: 0.9, opacity: 0.64 },
];

function pctX(x) {
    return `${(x / CANVAS_W) * 100}%`;
}

function pctY(y) {
    return `${(y / CANVAS_H) * 100}%`;
}

function useSpriteSheetMeta(src) {
    const [meta, setMeta] = useState(null);

    useEffect(() => {
        let cancelled = false;
        fetch(src)
            .then((res) => {
                if (!res.ok) throw new Error(`sprite metadata failed: ${res.status}`);
                return res.json();
            })
            .then((data) => {
                if (!cancelled) setMeta(data);
            })
            .catch(() => {
                if (!cancelled) setMeta(null);
            });
        return () => {
            cancelled = true;
        };
    }, [src]);

    return meta;
}

function directionRow(sheet, direction) {
    return sheet?.directions?.[direction]?.row ?? 0;
}

function spriteSheetImage(sheet) {
    return sheet?.renderImage || sheet?.image;
}

function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function daddyLonglegsPoint(instance, step) {
    const routePoint = DADDY_LONGLEGS_ROUTE[(step + instance.routeOffset) % DADDY_LONGLEGS_ROUTE.length];
    return {
        ...routePoint,
        id: instance.id,
        x: clampNumber(routePoint.x + instance.xJitter, 80, CANVAS_W - 70),
        y: clampNumber(routePoint.y + instance.yJitter, 110, CANVAS_H - 70),
        size: clampNumber(Math.round(routePoint.size * instance.sizeScale), 54, 182),
        z: routePoint.z + instance.zOffset,
        moveMs: Math.round((DADDY_LONGLEGS_ROUTE_MS - 900) * instance.moveScale),
        opacity: instance.opacity,
    };
}

export default function SpiderwebPhase2Scene() {
    const spiderSheet = useSpriteSheetMeta(SPIDER_SPRITE_META_SRC);
    const [daddyStep, setDaddyStep] = useState(0);
    const [swarmPhase, setSwarmPhase] = useState(
        () => Math.floor(Date.now() / DADDY_LONGLEGS_SWARM_MS) % DADDY_LONGLEGS_PATTERNS.length
    );

    useEffect(() => {
        const id = window.setInterval(() => {
            setDaddyStep((value) => (value + 1) % DADDY_LONGLEGS_ROUTE.length);
        }, DADDY_LONGLEGS_ROUTE_MS);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        const id = window.setInterval(() => {
            setSwarmPhase((value) => (value + 1) % DADDY_LONGLEGS_PATTERNS.length);
        }, DADDY_LONGLEGS_SWARM_MS);
        return () => window.clearInterval(id);
    }, []);

    const daddyPattern = DADDY_LONGLEGS_PATTERNS[swarmPhase % DADDY_LONGLEGS_PATTERNS.length];
    const daddyInstances = DADDY_LONGLEGS_INSTANCES.slice(0, daddyPattern.count);

    return (
        <div
            className="absolute inset-0 pointer-events-none"
            data-testid="spiderweb-phase2-scene"
            data-daddy-longlegs-pattern={daddyPattern.id}
            data-daddy-longlegs-count={daddyInstances.length}
        >
            <style>{`
                @keyframes spiderweb-phase2-strip {
                    to { transform: translateX(var(--spiderweb-frame-shift)); }
                }
                @keyframes spiderweb-phase2-fall {
                    0% { transform: translate3d(0, var(--spiderweb-fall-start), 0); opacity: 0; }
                    18% { opacity: var(--spiderweb-opacity); }
                    72% { opacity: var(--spiderweb-opacity); }
                    100% { transform: translate3d(0, var(--spiderweb-fall-end), 0); opacity: 0; }
                }
                @keyframes spiderweb-spider-crawl {
                    0%, 100% { transform: translate3d(0, 0, 0); }
                    50% { transform: translate3d(var(--spiderweb-spider-dx), var(--spiderweb-spider-dy), 0); }
                }
                @keyframes spiderweb-sprite-steps {
                    to { background-position-x: 100%; }
                }
                @keyframes spiderweb-daddy-presence {
                    0%, 100% { transform: translate(-50%, -72%) translateY(0); }
                    50% { transform: translate(-50%, -72%) translateY(-3px); }
                }
                @media (prefers-reduced-motion: reduce) {
                    [data-spiderweb-phase2-animated="true"] {
                        animation-duration: 1ms !important;
                        animation-iteration-count: 1 !important;
                    }
                }
            `}</style>

            {OBJECTS.map((object) => (
                <SceneObject key={object.id} object={object} />
            ))}
            {spiderSheet && SPIDERS.map((spider) => (
                <SpiderCrawler key={spider.id} spider={spider} sheet={spiderSheet} />
            ))}
            {spiderSheet && daddyInstances.map((instance) => (
                <DaddyLonglegsResident
                    key={instance.id}
                    point={daddyLonglegsPoint(instance, daddyStep)}
                    sheet={spiderSheet}
                />
            ))}
        </div>
    );
}

function SceneObject({ object }) {
    const duration = object.frameMs * object.frames;
    const motion = object.motion;
    const motionStyle = {};
    let motionAnimation = "";

    if (motion?.type === "fall") {
        motionStyle["--spiderweb-fall-start"] = `-${pctY(motion.distanceY)}`;
        motionStyle["--spiderweb-fall-end"] = pctY(motion.distanceY);
        motionAnimation = `spiderweb-phase2-fall ${motion.durationSec}s linear infinite`;
    }

    return (
        <div
            data-testid={`spiderweb-scene-object-${object.id}`}
            data-spiderweb-phase2-animated="true"
            style={{
                position: "absolute",
                left: pctX(object.x),
                top: pctY(object.y),
                width: `${(object.frameWidth / CANVAS_W) * 100}%`,
                height: `${(object.frameHeight / CANVAS_H) * 100}%`,
                zIndex: object.z,
                opacity: object.opacity ?? 1,
                "--spiderweb-opacity": object.opacity ?? 1,
                mixBlendMode: object.blend || "normal",
                pointerEvents: "none",
                animation: motionAnimation || undefined,
                willChange: motion ? "transform, opacity" : "auto",
                ...motionStyle,
            }}
        >
            <SpriteStrip object={object} duration={duration} />
        </div>
    );
}

function SpriteStrip({ object, duration }) {
    return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <img
                src={`${BASE}/${object.sprite}?v=${ASSET_VERSION}`}
                alt=""
                draggable={false}
                data-spiderweb-phase2-animated="true"
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: `${object.frames * 100}%`,
                    height: "100%",
                    maxWidth: "none",
                    imageRendering: "pixelated",
                    animation: `spiderweb-phase2-strip ${duration}ms steps(${object.frames - 1}) infinite`,
                    animationDelay: object.delayMs ? `-${object.delayMs}ms` : undefined,
                    "--spiderweb-frame-shift": `${(-100 * (object.frames - 1)) / object.frames}%`,
                }}
            />
        </div>
    );
}

function SpiderCrawler({ spider, sheet }) {
    const size = spider.size || Math.round(sheet.frameWidth * (sheet.scale || 1));

    return (
        <div
            data-testid={`spiderweb-spider-${spider.id}`}
            data-sprite-sheet-id={sheet.id}
            data-sprite-direction={spider.direction}
            data-spiderweb-phase2-animated="true"
            style={{
                position: "absolute",
                left: pctX(spider.x),
                top: pctY(spider.y),
                width: pctX(size),
                height: pctY(size),
                zIndex: spider.z,
                opacity: spider.opacity ?? 1,
                pointerEvents: "none",
                animation: `spiderweb-spider-crawl ${spider.motion.durationSec}s ease-in-out infinite`,
                animationDelay: spider.delayMs ? `-${spider.delayMs}ms` : undefined,
                "--spiderweb-spider-dx": pctX(spider.motion.dx),
                "--spiderweb-spider-dy": pctY(spider.motion.dy),
                filter: "drop-shadow(1px 2px 0 rgba(0,0,0,0.45))",
                willChange: "transform",
            }}
        >
            <SpriteSheetActor actor={spider} sheet={sheet} />
        </div>
    );
}

function DaddyLonglegsResident({ point, sheet }) {
    const size = point.size || 124;
    const actor = {
        direction: point.direction,
        fps: 7,
    };

    return (
        <div
            data-testid="spiderweb-daddy-longlegs"
            data-daddy-id={point.id}
            data-sprite-sheet-id={sheet.id}
            data-sprite-direction={point.direction}
            data-spiderweb-phase2-animated="true"
            style={{
                position: "absolute",
                left: pctX(point.x),
                top: pctY(point.y),
                width: pctX(size),
                height: pctY(size),
                zIndex: point.z,
                opacity: point.opacity ?? 1,
                pointerEvents: "none",
                transition: `left ${point.moveMs}ms cubic-bezier(.22,.78,.3,1), top ${point.moveMs}ms cubic-bezier(.22,.78,.3,1), width 900ms steps(4, end), height 900ms steps(4, end), opacity 1200ms steps(4, end)`,
                animation: "spiderweb-daddy-presence 2.6s ease-in-out infinite",
                filter: "drop-shadow(2px 3px 0 rgba(0,0,0,0.62))",
                willChange: "left, top, transform, opacity",
            }}
        >
            <SpriteSheetActor actor={actor} sheet={sheet} />
        </div>
    );
}

function SpriteSheetActor({ actor, sheet }) {
    const frameCount = Math.max(1, sheet.frameCount || 1);
    const rows = Math.max(1, sheet.rows || 1);
    const fps = actor.fps || sheet.fps || 8;
    const durationMs = (frameCount / fps) * 1000;
    const rowIndex = directionRow(sheet, actor.direction);
    const stepCount = Math.max(1, frameCount - 1);
    const frameShift = `${(-100 * (frameCount - 1)) / frameCount}%`;

    return (
        <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <img
                src={`${spriteSheetImage(sheet)}?v=cardinal-20260501`}
                alt=""
                draggable={false}
                data-spiderweb-phase2-animated="true"
                style={{
                    position: "absolute",
                    top: `${-100 * rowIndex}%`,
                    left: 0,
                    width: `${frameCount * 100}%`,
                    height: `${rows * 100}%`,
                    maxWidth: "none",
                    imageRendering: "pixelated",
                    animation: `spiderweb-phase2-strip ${durationMs}ms steps(${stepCount}) ${sheet.loop === false ? 1 : "infinite"}`,
                    animationDelay: actor.delayMs ? `-${actor.delayMs}ms` : undefined,
                    "--spiderweb-frame-shift": frameShift,
                }}
            />
        </div>
    );
}
