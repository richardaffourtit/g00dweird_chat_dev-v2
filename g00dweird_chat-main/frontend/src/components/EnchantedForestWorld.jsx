import React, { useEffect, useMemo, useRef, useState } from "react";
import AnimSprite, { pickTravelStance, sanitizeAnimCreature } from "./AnimSprite";
import {
    ENCHANTED_FOREST_AVATAR_FRAME,
    ENCHANTED_FOREST_WORLD,
    constrainWorldCamera,
    forestAvatarStyleFromMaps,
    movementVectorFromKeys,
    resolveForestMove,
} from "../lib/enchantedForestWorld";

const DEPTH_BANDS = [
    { id: "ridge", min: 0.58, max: 0.74, zIndex: 610, opacity: 0.48 },
    { id: "canopy", min: 0.74, max: 1, zIndex: 730, opacity: 0.78 },
];

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function windowSize() {
    if (typeof window === "undefined") return { width: 1280, height: 720 };
    return {
        width: window.innerWidth || 1280,
        height: window.innerHeight || 720,
    };
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Could not load ${src}`));
        img.src = src;
    });
}

function luminance(r, g, b) {
    return ((r * 0.2126) + (g * 0.7152) + (b * 0.0722)) / 255;
}

function imageToPixels(image) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
        canvas,
        ctx,
        width: canvas.width,
        height: canvas.height,
        data: ctx.getImageData(0, 0, canvas.width, canvas.height),
    };
}

function createSamplerFromPixels(pixels, mode = "light") {
    return (point) => {
        const x = clamp(Math.round(point.x), 0, pixels.width - 1);
        const y = clamp(Math.round(point.y), 0, pixels.height - 1);
        const index = (y * pixels.width + x) * 4;
        const value = luminance(
            pixels.data.data[index],
            pixels.data.data[index + 1],
            pixels.data.data[index + 2]
        );
        return mode === "darkness" ? clamp(1 - value, 0, 1) : value;
    };
}

function smoothStep(edge0, edge1, value) {
    const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

async function createMapSamplers() {
    const [depthImage, shadowImage] = await Promise.all([
        loadImage(ENCHANTED_FOREST_WORLD.assets.depth),
        loadImage(ENCHANTED_FOREST_WORLD.assets.shadow),
    ]);
    const depthPixels = imageToPixels(depthImage);
    const shadowPixels = imageToPixels(shadowImage);
    const depthSample = createSamplerFromPixels(depthPixels, "light");
    const shadowSample = createSamplerFromPixels(shadowPixels, "darkness");

    return (point) => ({
        depth: depthSample(point),
        shadow: shadowSample(point),
    });
}

async function createDepthBandLayers() {
    const [forestImage, depthImage] = await Promise.all([
        loadImage(ENCHANTED_FOREST_WORLD.assets.forest),
        loadImage(ENCHANTED_FOREST_WORLD.assets.depth),
    ]);
    const forestPixels = imageToPixels(forestImage);
    const depthPixels = imageToPixels(depthImage);
    const layers = [];

    for (const band of DEPTH_BANDS) {
        const bandPixels = new ImageData(
            new Uint8ClampedArray(forestPixels.data.data),
            forestPixels.width,
            forestPixels.height
        );
        const source = bandPixels.data;
        const depthData = depthPixels.data.data;
        const feather = 0.065;

        for (let index = 0; index < source.length; index += 4) {
            const depth = luminance(depthData[index], depthData[index + 1], depthData[index + 2]);
            const enter = smoothStep(band.min, band.min + feather, depth);
            const exit = 1 - smoothStep(band.max - feather, band.max, depth);
            const alpha = clamp(enter * exit * band.opacity, 0, 1);
            source[index + 3] = Math.round(source[index + 3] * alpha);
        }

        const canvas = document.createElement("canvas");
        canvas.width = forestPixels.width;
        canvas.height = forestPixels.height;
        canvas.getContext("2d").putImageData(bandPixels, 0, 0);
        layers.push({
            id: band.id,
            src: canvas.toDataURL("image/png"),
            zIndex: band.zIndex,
        });
    }

    return layers;
}

function initialCreature() {
    if (typeof window === "undefined") return "fairy";
    try {
        return sanitizeAnimCreature(window.localStorage.getItem("gw_anim")) || "fairy";
    } catch {
        return "fairy";
    }
}

export default function EnchantedForestWorld() {
    const keysRef = useRef(new Set());
    const positionRef = useRef({ ...ENCHANTED_FOREST_WORLD.avatarStart });
    const samplerRef = useRef(null);
    const animationRef = useRef(null);
    const lastFrameRef = useRef(0);
    const [viewport, setViewport] = useState(() => windowSize());
    const [position, setPosition] = useState(() => ({ ...ENCHANTED_FOREST_WORLD.avatarStart }));
    const [moving, setMoving] = useState(false);
    const [direction, setDirection] = useState("S");
    const [facing, setFacing] = useState("right");
    const [mapReady, setMapReady] = useState(false);
    const [depthLayers, setDepthLayers] = useState([]);
    const [creature] = useState(initialCreature);

    useEffect(() => {
        let alive = true;
        createMapSamplers()
            .then((sampler) => {
                if (!alive) return;
                samplerRef.current = sampler;
                setMapReady(true);
            })
            .catch(() => {
                if (!alive) return;
                samplerRef.current = null;
                setMapReady(false);
            });
        createDepthBandLayers()
            .then((layers) => {
                if (alive) setDepthLayers(layers);
            })
            .catch(() => {
                if (alive) setDepthLayers([]);
            });
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        const handleResize = () => setViewport(windowSize());
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        const isMovementKey = (key) => {
            const k = String(key).toLowerCase();
            return [
                "arrowup", "arrowdown", "arrowleft", "arrowright",
                "w", "a", "s", "d", "q", "e", "z", "c",
            ].includes(k);
        };
        const onKeyDown = (event) => {
            if (!isMovementKey(event.key)) return;
            event.preventDefault();
            keysRef.current.add(String(event.key).toLowerCase());
        };
        const onKeyUp = (event) => {
            if (!isMovementKey(event.key)) return;
            event.preventDefault();
            keysRef.current.delete(String(event.key).toLowerCase());
        };
        const onBlur = () => keysRef.current.clear();

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("blur", onBlur);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("blur", onBlur);
        };
    }, []);

    useEffect(() => {
        const sample = (point) => (
            samplerRef.current
                ? samplerRef.current(point)
                : { depth: 0.46, shadow: 0.08 }
        );

        const tick = (timestamp) => {
            const lastFrame = lastFrameRef.current || timestamp;
            lastFrameRef.current = timestamp;
            const dt = clamp((timestamp - lastFrame) / 1000, 0, 0.045);
            const vector = movementVectorFromKeys(keysRef.current);

            if (vector.label && dt > 0) {
                const current = positionRef.current;
                const desired = {
                    x: current.x + vector.x * ENCHANTED_FOREST_WORLD.speed * dt,
                    y: current.y + vector.y * ENCHANTED_FOREST_WORLD.speed * dt,
                };
                const next = resolveForestMove(current, desired, sample, ENCHANTED_FOREST_WORLD);
                const movedDistance = Math.hypot(next.x - current.x, next.y - current.y);

                if (movedDistance > 0.01) {
                    positionRef.current = {
                        x: Math.round(next.x * 100) / 100,
                        y: Math.round(next.y * 100) / 100,
                    };
                    setPosition(positionRef.current);
                    setDirection(vector.label);
                    if (vector.x < -0.01) setFacing("left");
                    if (vector.x > 0.01) setFacing("right");
                }
                setMoving(movedDistance > 0.01);
            } else {
                setMoving(false);
            }

            animationRef.current = requestAnimationFrame(tick);
        };

        animationRef.current = requestAnimationFrame(tick);
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, []);

    const samples = useMemo(() => (
        samplerRef.current
            ? samplerRef.current(position)
            : { depth: 0.46, shadow: 0.08 }
    ), [position, mapReady]);
    const avatarStyle = useMemo(
        () => forestAvatarStyleFromMaps(samples, { zBase: 360 }),
        [samples]
    );
    const camera = useMemo(
        () => constrainWorldCamera(position, viewport, ENCHANTED_FOREST_WORLD, ENCHANTED_FOREST_WORLD.zoom),
        [position, viewport]
    );
    const stance = moving
        ? pickTravelStance(creature, 155, direction.includes("N") || direction.includes("S") ? 112 : 0)
        : "idle";

    return (
        <main
            className="enchanted-forest-v2"
            data-testid="enchanted-forest-world"
            data-map-ready={mapReady ? "true" : "false"}
            data-direction={direction}
        >
            <div
                className="forest-v2-camera"
                data-testid="forest-v2-camera"
                style={{
                    width: ENCHANTED_FOREST_WORLD.width,
                    height: ENCHANTED_FOREST_WORLD.height,
                    transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${ENCHANTED_FOREST_WORLD.zoom})`,
                }}
            >
                <img
                    className="forest-v2-base"
                    src={ENCHANTED_FOREST_WORLD.assets.forest}
                    alt=""
                    aria-hidden
                    draggable={false}
                />
                <img
                    className="forest-v2-shadow-map"
                    src={ENCHANTED_FOREST_WORLD.assets.shadow}
                    alt=""
                    aria-hidden
                    draggable={false}
                />
                {depthLayers.map((layer) => (
                    <img
                        key={layer.id}
                        className="forest-v2-depth-band"
                        src={layer.src}
                        alt=""
                        aria-hidden
                        draggable={false}
                        style={{ zIndex: layer.zIndex }}
                    />
                ))}

                <div
                    className="forest-v2-avatar-anchor"
                    data-testid="forest-v2-avatar"
                    data-stance={stance}
                    data-facing={facing}
                    style={{
                        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                        zIndex: avatarStyle.zIndex,
                    }}
                >
                    <div
                        className="forest-v2-avatar-shadow"
                        style={{
                            opacity: avatarStyle.shadowOpacity,
                            transform: `translate3d(-50%, -50%, 0) scale(${avatarStyle.shadowScale})`,
                        }}
                    />
                    <div
                        className={`forest-v2-avatar-body ${moving ? "is-moving" : ""}`}
                        style={{
                            "--forest-avatar-lift": `${avatarStyle.lift}px`,
                            "--forest-avatar-scale": avatarStyle.scale,
                            "--forest-avatar-width": `${ENCHANTED_FOREST_AVATAR_FRAME.width}px`,
                            "--forest-avatar-height": `${ENCHANTED_FOREST_AVATAR_FRAME.height}px`,
                            filter: avatarStyle.filter,
                        }}
                    >
                        <AnimSprite
                            creature={creature}
                            state={stance}
                            size={ENCHANTED_FOREST_AVATAR_FRAME.height}
                            frameWidth={ENCHANTED_FOREST_AVATAR_FRAME.width}
                            frameHeight={ENCHANTED_FOREST_AVATAR_FRAME.height}
                            fps={moving ? 10 : 6}
                            flip={facing === "left"}
                            alt=""
                        />
                    </div>
                </div>
            </div>
        </main>
    );
}
