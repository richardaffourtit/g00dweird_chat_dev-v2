import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CANVAS_W = 1254;
const CANVAS_H = 1254;
const BASE = "/scenery/hello_phase2";
const ASSET_VERSION = "hello-clouds-keyed-20260429b";
const EDIT_STORAGE_KEY = "gw_hello_scene_edits_v2";

const cloudSprite = (n, width, height) => ({
    src: `/scenery/cloud_${n}.png?v=${ASSET_VERSION}`,
    frameWidth: width,
    frameHeight: height,
    frames: 1,
    frameMs: 1000,
});

const OBJECTS = [
    {
        id: "waterfall_left",
        label: "waterfall",
        sprite: "hello_waterfall_loop_64x128.png",
        frameWidth: 64,
        frameHeight: 128,
        frames: 8,
        frameMs: 75,
        x: 56,
        y: 382,
        z: 18,
    },
    {
        id: "rainbow_shimmer",
        label: "rainbow",
        sprite: "hello_rainbow_shimmer_256x96.png",
        frameWidth: 256,
        frameHeight: 96,
        frames: 12,
        frameMs: 95,
        x: 435,
        y: 135,
        z: 12,
        opacity: 0.55,
        blend: "screen",
    },
    {
        id: "center_heart_pulse",
        label: "heart",
        sprite: "hello_heart_pulse_64.png",
        frameWidth: 64,
        frameHeight: 64,
        frames: 8,
        frameMs: 110,
        x: 610,
        y: 700,
        z: 21,
        opacity: 0.6,
        blend: "screen",
    },
    {
        id: "right_door_glow",
        label: "door glow",
        sprite: "hello_soft_glow_64.png",
        frameWidth: 64,
        frameHeight: 64,
        frames: 10,
        frameMs: 90,
        x: 1125,
        y: 590,
        z: 22,
        opacity: 0.75,
        blend: "screen",
    },
    {
        id: "smile_balloon_sway",
        label: "smile",
        sprite: "hello_smile_balloon_sway_64.png",
        frameWidth: 64,
        frameHeight: 64,
        frames: 12,
        frameMs: 110,
        x: 470,
        y: 112,
        z: 15,
        motion: { type: "bob", amplitudeY: 8, durationSec: 3.5 },
    },
    {
        id: "heart_balloon_sway",
        label: "balloon",
        sprite: "hello_heart_balloon_sway_64.png",
        frameWidth: 64,
        frameHeight: 64,
        frames: 12,
        frameMs: 110,
        x: 330,
        y: 95,
        z: 15,
        motion: { type: "bob", amplitudeY: 10, durationSec: 4.1 },
    },
    {
        id: "bunting_front_wave",
        label: "front flags",
        sprite: "hello_flag_bunting_wave_128x32.png",
        frameWidth: 128,
        frameHeight: 32,
        frames: 8,
        frameMs: 130,
        x: 872,
        y: 948,
        z: 72,
    },
    {
        id: "bunting_left_wave",
        label: "left flags",
        sprite: "hello_flag_bunting_wave_128x32.png",
        frameWidth: 128,
        frameHeight: 32,
        frames: 8,
        frameMs: 130,
        x: 72,
        y: 930,
        z: 72,
    },
    {
        id: "hello_cloud_upper_left",
        label: "cloud upper",
        ...cloudSprite(1, 330, 132),
        x: 115,
        y: 72,
        z: 8,
        opacity: 0.92,
        motion: { type: "drift", fromX: 115, toX: 155, durationSec: 26 },
    },
    {
        id: "hello_cloud_upper_right",
        label: "cloud right",
        ...cloudSprite(2, 315, 121),
        x: 785,
        y: 92,
        z: 8,
        opacity: 0.88,
        motion: { type: "drift", fromX: 785, toX: 725, durationSec: 34 },
    },
    {
        id: "hello_cloud_mid_left",
        label: "cloud left",
        ...cloudSprite(3, 286, 108),
        x: -70,
        y: 424,
        z: 26,
        opacity: 0.86,
        motion: { type: "drift", fromX: -70, toX: 18, durationSec: 31 },
    },
    {
        id: "hello_cloud_low_right",
        label: "cloud low",
        ...cloudSprite(8, 350, 91),
        x: 850,
        y: 1012,
        z: 91,
        opacity: 0.94,
        motion: { type: "drift", fromX: 850, toX: 720, durationSec: 45 },
    },
    {
        id: "hello_cloud_floor",
        label: "cloud floor",
        ...cloudSprite(5, 300, 92),
        x: 120,
        y: 1045,
        z: 92,
        opacity: 0.78,
        motion: { type: "drift", fromX: 120, toX: 280, durationSec: 56 },
    },
];

const STARS = [
    { x: 48, y: 54, z: 11, delayMs: 0 },
    { x: 145, y: 72, z: 11, delayMs: 160 },
    { x: 195, y: 186, z: 11, delayMs: 300 },
    { x: 539, y: 96, z: 11, delayMs: 440 },
    { x: 904, y: 50, z: 11, delayMs: 210 },
    { x: 1035, y: 50, z: 11, delayMs: 510 },
    { x: 1160, y: 88, z: 11, delayMs: 630 },
    { x: 864, y: 228, z: 11, delayMs: 350 },
    { x: 754, y: 266, z: 11, delayMs: 700 },
    { x: 1196, y: 151, z: 11, delayMs: 850 },
    { x: 30, y: 200, z: 11, delayMs: 570 },
    { x: 1008, y: 1050, z: 73, delayMs: 920 },
];

function pctX(x) {
    return `${(x / CANVAS_W) * 100}%`;
}

function pctY(y) {
    return `${(y / CANVAS_H) * 100}%`;
}

function stopWorldClick(e) {
    e.preventDefault();
    e.stopPropagation();
}

function swallowWorldPointer(e) {
    e.stopPropagation();
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function cleanEdit(edit) {
    const next = {};
    if (Number.isFinite(edit.x)) next.x = Math.round(clamp(edit.x, -CANVAS_W * 0.45, CANVAS_W * 1.18));
    if (Number.isFinite(edit.y)) next.y = Math.round(clamp(edit.y, -CANVAS_H * 0.25, CANVAS_H * 1.12));
    if (Number.isFinite(edit.scaleX)) next.scaleX = Number(clamp(edit.scaleX, 0.15, 3).toFixed(2));
    if (Number.isFinite(edit.scaleY)) next.scaleY = Number(clamp(edit.scaleY, 0.15, 3).toFixed(2));
    if (Number.isFinite(edit.opacity)) next.opacity = Number(clamp(edit.opacity, 0.1, 1).toFixed(2));
    return next;
}

function loadEdits() {
    if (typeof window === "undefined") return {};
    try {
        const parsed = JSON.parse(window.localStorage.getItem(EDIT_STORAGE_KEY) || "{}");
        if (!parsed || typeof parsed !== "object") return {};
        return Object.fromEntries(
            Object.entries(parsed)
                .filter(([id, edit]) => OBJECTS.some((object) => object.id === id) && edit && typeof edit === "object")
                .map(([id, edit]) => [id, cleanEdit(edit)])
                .filter(([, edit]) => Object.keys(edit).length)
        );
    } catch {
        return {};
    }
}

function storeEdits(edits) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(EDIT_STORAGE_KEY, JSON.stringify(edits));
}

function assetSrc(sprite) {
    return `${BASE}/${sprite}`;
}

export default function HelloLivingScene() {
    const sceneRef = useRef(null);
    const [heartHot, setHeartHot] = useState(false);
    const [doorPulse, setDoorPulse] = useState(false);
    const [sparkles, setSparkles] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [selectedId, setSelectedId] = useState(OBJECTS[0]?.id || "");
    const [edits, setEdits] = useState(loadEdits);
    const [drag, setDrag] = useState(null);
    const timers = useRef([]);

    const objectMap = useMemo(() => new Map(OBJECTS.map((object) => [object.id, object])), []);
    const selectedObject = objectMap.get(selectedId) || OBJECTS[0];
    const selectedEdit = selectedObject ? edits[selectedObject.id] || {} : {};

    useEffect(() => () => timers.current.forEach((timer) => clearTimeout(timer)), []);

    useEffect(() => {
        storeEdits(edits);
    }, [edits]);

    const clientToCanvas = useCallback((event) => {
        const rect = sceneRef.current?.getBoundingClientRect();
        if (!rect?.width || !rect?.height) return null;
        return {
            x: ((event.clientX - rect.left) / rect.width) * CANVAS_W,
            y: ((event.clientY - rect.top) / rect.height) * CANVAS_H,
        };
    }, []);

    const updateObjectEdit = useCallback((id, patch) => {
        const object = objectMap.get(id);
        if (!object) return;
        setEdits((old) => ({
            ...old,
            [id]: cleanEdit({
                x: old[id]?.x ?? object.x,
                y: old[id]?.y ?? object.y,
                scaleX: old[id]?.scaleX ?? object.scaleX ?? 1,
                scaleY: old[id]?.scaleY ?? object.scaleY ?? 1,
                opacity: old[id]?.opacity ?? object.opacity ?? 1,
                ...patch,
            }),
        }));
    }, [objectMap]);

    useEffect(() => {
        if (!drag) return undefined;

        const onPointerMove = (event) => {
            const point = clientToCanvas(event);
            if (!point) return;
            event.preventDefault();
            updateObjectEdit(drag.id, {
                x: clamp(point.x - drag.offsetX, -CANVAS_W * 0.45, CANVAS_W * 1.18),
                y: clamp(point.y - drag.offsetY, -CANVAS_H * 0.25, CANVAS_H * 1.12),
            });
        };

        const onPointerUp = () => setDrag(null);
        window.addEventListener("pointermove", onPointerMove, { passive: false });
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
        return () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerUp);
        };
    }, [clientToCanvas, drag, updateObjectEdit]);

    const getDisplayObject = (object) => {
        const edit = edits[object.id];
        return {
            ...object,
            x: edit?.x ?? object.x,
            y: edit?.y ?? object.y,
            scaleX: edit?.scaleX ?? object.scaleX ?? 1,
            scaleY: edit?.scaleY ?? object.scaleY ?? 1,
            opacity: edit?.opacity ?? object.opacity,
            edited: Boolean(edit),
        };
    };

    const resetObjectEdit = (id) => {
        setEdits((old) => {
            const next = { ...old };
            delete next[id];
            return next;
        });
    };

    const onObjectPointerDown = (event, object) => {
        if (!editMode) return;
        stopWorldClick(event);
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setSelectedId(object.id);
        const point = clientToCanvas(event);
        if (!point) return;
        setDrag({
            id: object.id,
            offsetX: point.x - object.x,
            offsetY: point.y - object.y,
        });
    };

    const playDoorGlowPulse = (e) => {
        stopWorldClick(e);
        setDoorPulse(true);
        const timer = setTimeout(() => setDoorPulse(false), 1200);
        timers.current.push(timer);
    };

    const spawnSparkles = (e) => {
        stopWorldClick(e);
        const born = Date.now();
        const next = [0, 1, 2].map((i) => ({
            id: `${born}-${i}`,
            x: 54 + (i * 24) + Math.round(Math.random() * 18),
            y: 350 + (i * 34) + Math.round(Math.random() * 18),
            z: 74,
            delayMs: i * 90,
        }));
        setSparkles((old) => [...old, ...next]);
        const timer = setTimeout(() => {
            setSparkles((old) => old.filter((sparkle) => !next.some((item) => item.id === sparkle.id)));
        }, 1400);
        timers.current.push(timer);
    };

    return (
        <>
        <div
            ref={sceneRef}
            className="absolute inset-0"
            data-testid="hello-living-scene"
            style={{ pointerEvents: editMode ? "auto" : "none" }}
        >
            <style>{`
                @keyframes hello-phase2-strip {
                    to { transform: translateX(var(--hello-frame-shift)); }
                }
                @keyframes hello-phase2-bob {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(var(--hello-bob-y)); }
                }
                @keyframes hello-phase2-drift {
                    from { left: var(--hello-drift-from); }
                    to { left: var(--hello-drift-to); }
                }
                @keyframes hello-phase2-sparkle-pop {
                    0% { opacity: 0; transform: scale(0.4) rotate(0deg); }
                    15% { opacity: 1; }
                    75% { opacity: 1; }
                    100% { opacity: 0; transform: scale(1.35) rotate(18deg); }
                }
                @media (prefers-reduced-motion: reduce) {
                    [data-hello-phase2-animated="true"] {
                        animation-duration: 1ms !important;
                        animation-iteration-count: 1 !important;
                    }
                }
            `}</style>

            {OBJECTS.map((object) => {
                const displayObject = getDisplayObject(object);
                return (
                    <SceneObject
                        key={object.id}
                        object={displayObject}
                        editMode={editMode}
                        selected={selectedId === object.id}
                        heartHot={heartHot}
                        doorPulse={doorPulse}
                        onPointerDown={onObjectPointerDown}
                    />
                );
            })}

            {STARS.map((star, i) => (
                <Star key={i} {...star} />
            ))}

            {sparkles.map((sparkle) => (
                <Star key={sparkle.id} {...sparkle} temporary />
            ))}

        </div>

        {!editMode && (
            <>
                <Hitbox
                    label="hello door glow"
                    box={[1085, 535, 1220, 760]}
                    onClick={playDoorGlowPulse}
                />
                <Hitbox
                    label="hello heart pulse"
                    box={[500, 610, 780, 790]}
                    onMouseEnter={() => setHeartHot(true)}
                    onMouseLeave={() => setHeartHot(false)}
                />
                <Hitbox
                    label="hello waterfall sparkles"
                    box={[30, 330, 130, 520]}
                    onClick={spawnSparkles}
                />
            </>
        )}

        <button
            type="button"
            data-testid="hello-editor-toggle"
            aria-pressed={editMode}
            onPointerDown={swallowWorldPointer}
            onClick={(event) => {
                stopWorldClick(event);
                setEditMode((value) => !value);
            }}
            style={{
                position: "absolute",
                right: "96px",
                top: 8,
                zIndex: 120,
                pointerEvents: "auto",
                padding: "4px 7px",
                border: "2px solid #f4f4f4",
                borderRightColor: "#262626",
                borderBottomColor: "#262626",
                background: editMode ? "#d7ff35" : "#d8d8d8",
                color: "#00106f",
                fontSize: 10,
                lineHeight: 1,
                letterSpacing: "1px",
                textTransform: "uppercase",
                boxShadow: "1px 1px 0 #000",
                cursor: "pointer",
            }}
        >
            {editMode ? "done" : "edit"}
        </button>

        {editMode && selectedObject && (
            <HelloEditorPanel
                object={selectedObject}
                edit={selectedEdit}
                onSelect={setSelectedId}
                onChange={(patch) => updateObjectEdit(selectedObject.id, patch)}
                onReset={() => resetObjectEdit(selectedObject.id)}
                onResetAll={() => setEdits({})}
            />
        )}
        </>
    );
}

function SceneObject({ object, editMode, selected, heartHot, doorPulse, onPointerDown }) {
    const duration = object.frameMs * object.frames * (
        object.id === "center_heart_pulse" && heartHot ? 0.58 : 1
    );
    const opacity = object.id === "center_heart_pulse" && heartHot
        ? 0.95
        : object.id === "right_door_glow" && doorPulse
            ? 1
            : object.opacity ?? 1;
    const filter = object.id === "right_door_glow" && doorPulse
        ? "drop-shadow(0 0 10px #fff) drop-shadow(0 0 18px #ff6ec7)"
        : undefined;
    const motion = editMode || object.edited ? null : object.motion;
    const motionStyle = {};
    let motionAnimation = "";

    if (motion?.type === "bob") {
        motionStyle["--hello-bob-y"] = `${motion.amplitudeY}px`;
        motionAnimation = `hello-phase2-bob ${motion.durationSec}s ease-in-out infinite`;
    } else if (motion?.type === "drift") {
        motionStyle.left = pctX(motion.fromX);
        motionStyle["--hello-drift-from"] = pctX(motion.fromX);
        motionStyle["--hello-drift-to"] = pctX(motion.toX);
        motionAnimation = `hello-phase2-drift ${motion.durationSec}s linear infinite alternate`;
    }

    return (
        <div
            data-testid={`hello-scene-object-${object.id}`}
            data-hello-phase2-animated="true"
            onPointerDown={(event) => onPointerDown(event, object)}
            style={{
                position: "absolute",
                left: pctX(object.x),
                top: pctY(object.y),
                width: `${(object.frameWidth / CANVAS_W) * 100}%`,
                height: `${(object.frameHeight / CANVAS_H) * 100}%`,
                zIndex: object.z,
                opacity,
                mixBlendMode: object.blend || "normal",
                pointerEvents: editMode ? "auto" : "none",
                cursor: editMode ? "move" : undefined,
                animation: motionAnimation || undefined,
                filter,
                willChange: motion ? "left, transform" : "auto",
                outline: editMode && selected ? "2px solid #d7ff35" : editMode ? "1px dashed rgba(0, 255, 255, 0.7)" : undefined,
                outlineOffset: 2,
                touchAction: "none",
                ...motionStyle,
            }}
        >
            {editMode && (
                <span
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        left: -2,
                        top: -15,
                        color: selected ? "#d7ff35" : "#00ffff",
                        fontSize: 9,
                        lineHeight: 1,
                        textShadow: "1px 1px 0 #000",
                        whiteSpace: "nowrap",
                    }}
                >
                    {object.label || object.id}
                </span>
            )}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    transform: `scale(${object.scaleX || 1}, ${object.scaleY || 1})`,
                    transformOrigin: "center center",
                }}
            >
                <SpriteView object={object} duration={duration} />
            </div>
        </div>
    );
}

function SpriteView({ object, duration, delayMs = 0 }) {
    const steps = Math.max(1, object.frames - 1);

    return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <img
                src={object.src || assetSrc(object.sprite)}
                alt=""
                draggable={false}
                data-hello-phase2-animated="true"
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: `${object.frames * 100}%`,
                    height: "100%",
                    maxWidth: "none",
                    imageRendering: "pixelated",
                    animation: object.frames > 1
                        ? `hello-phase2-strip ${duration}ms steps(${steps}) ${delayMs ? `-${delayMs}ms` : "0ms"} infinite`
                        : undefined,
                    "--hello-frame-shift": `${(-100 * (object.frames - 1)) / object.frames}%`,
                }}
            />
        </div>
    );
}

function Star({ x, y, z, delayMs = 0, temporary = false }) {
    const object = {
        id: "star",
        sprite: "hello_star_twinkle_32.png",
        frameWidth: 32,
        frameHeight: 32,
        frames: 8,
        frameMs: 90,
    };
    return (
        <div
            data-testid={temporary ? "hello-sparkle" : "hello-star"}
            data-hello-phase2-animated="true"
            style={{
                position: "absolute",
                left: pctX(x),
                top: pctY(y),
                width: `${(object.frameWidth / CANVAS_W) * 100}%`,
                height: `${(object.frameHeight / CANVAS_H) * 100}%`,
                zIndex: z,
                opacity: 0.9,
                mixBlendMode: "screen",
                pointerEvents: "none",
                animation: temporary
                    ? `hello-phase2-sparkle-pop 1200ms ease-out ${delayMs}ms 1 both`
                    : undefined,
            }}
        >
            <SpriteView object={object} duration={object.frameMs * object.frames} delayMs={delayMs} />
        </div>
    );
}

function HelloEditorPanel({ object, edit, onSelect, onChange, onReset, onResetAll }) {
    const value = {
        x: edit.x ?? object.x,
        y: edit.y ?? object.y,
        scaleX: edit.scaleX ?? object.scaleX ?? 1,
        scaleY: edit.scaleY ?? object.scaleY ?? 1,
        opacity: edit.opacity ?? object.opacity ?? 1,
    };

    const setNumber = (field, nextValue) => {
        const number = Number(nextValue);
        if (!Number.isFinite(number)) return;
        const bounded = field === "opacity"
            ? clamp(number, 0.1, 1)
            : field === "scaleX" || field === "scaleY"
                ? clamp(number, 0.15, 3)
                : clamp(number, -800, 1800);
        onChange({ [field]: bounded });
    };

    return (
        <div
            data-testid="hello-scene-editor"
            onPointerDown={swallowWorldPointer}
            onClick={swallowWorldPointer}
            style={{
                position: "absolute",
                right: "96px",
                top: 38,
                zIndex: 121,
                pointerEvents: "auto",
                width: "min(330px, 46%)",
                minWidth: 230,
                padding: 8,
                border: "2px solid #f4f4f4",
                borderRightColor: "#252525",
                borderBottomColor: "#252525",
                background: "rgba(214, 214, 214, 0.96)",
                color: "#050505",
                boxShadow: "2px 2px 0 rgba(0, 0, 0, 0.7)",
                fontSize: 10,
                lineHeight: 1.2,
            }}
        >
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 7 }}>
                <select
                    value={object.id}
                    onChange={(event) => onSelect(event.target.value)}
                    aria-label="Hello scene sprite"
                    style={{
                        flex: 1,
                        minWidth: 0,
                        height: 22,
                        border: "2px solid #252525",
                        borderRightColor: "#f4f4f4",
                        borderBottomColor: "#f4f4f4",
                        background: "#fff",
                        font: "inherit",
                    }}
                >
                    {OBJECTS.map((item) => (
                        <option key={item.id} value={item.id}>{item.label || item.id}</option>
                    ))}
                </select>
                <button type="button" onClick={onReset} style={buttonStyle}>reset</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 7 }}>
                <EditorNumber label="X" value={value.x} onChange={(next) => setNumber("x", next)} step={1} />
                <EditorNumber label="Y" value={value.y} onChange={(next) => setNumber("y", next)} step={1} />
                <EditorNumber label="W" value={value.scaleX} onChange={(next) => setNumber("scaleX", next)} step={0.05} />
                <EditorNumber label="H" value={value.scaleY} onChange={(next) => setNumber("scaleY", next)} step={0.05} />
            </div>

            <label style={{ display: "grid", gap: 3, marginTop: 8 }}>
                <span style={{ color: "#00106f", letterSpacing: "1px", textTransform: "uppercase" }}>opacity</span>
                <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={value.opacity}
                    onChange={(event) => setNumber("opacity", event.target.value)}
                />
            </label>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
                <span style={{ color: "#00106f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {object.label || object.id}
                </span>
                <button type="button" onClick={onResetAll} style={buttonStyle}>reset all</button>
            </div>
        </div>
    );
}

const buttonStyle = {
    border: "2px solid #f4f4f4",
    borderRightColor: "#252525",
    borderBottomColor: "#252525",
    background: "#d8d8d8",
    color: "#050505",
    padding: "3px 6px",
    font: "inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
};

function EditorNumber({ label, value, onChange, step }) {
    return (
        <label style={{ display: "grid", gap: 3 }}>
            <span style={{ color: "#00106f", letterSpacing: "1px", textTransform: "uppercase" }}>{label}</span>
            <input
                type="number"
                value={value}
                step={step}
                onChange={(event) => onChange(event.target.value)}
                style={{
                    width: "100%",
                    minWidth: 0,
                    height: 24,
                    border: "2px solid #252525",
                    borderRightColor: "#f4f4f4",
                    borderBottomColor: "#f4f4f4",
                    background: "#fff",
                    color: "#050505",
                    padding: "2px 4px",
                    font: "inherit",
                }}
            />
        </label>
    );
}

function Hitbox({ box, label, ...handlers }) {
    const [x1, y1, x2, y2] = box;
    return (
        <button
            type="button"
            aria-label={label}
            tabIndex={-1}
            className="absolute"
            {...handlers}
            style={{
                left: pctX(x1),
                top: pctY(y1),
                width: pctX(x2 - x1),
                height: pctY(y2 - y1),
                border: 0,
                padding: 0,
                margin: 0,
                background: "transparent",
                opacity: 0,
                zIndex: 96,
                pointerEvents: "auto",
                cursor: "crosshair",
            }}
        />
    );
}
