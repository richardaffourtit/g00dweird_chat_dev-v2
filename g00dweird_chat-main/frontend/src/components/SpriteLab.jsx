import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Save, RefreshCw, Eye, EyeOff } from "lucide-react";
import { getSpriteDescriptor, listSprites, rebuildSprite, saveSpriteOverrides } from "../lib/api";
import "./SpriteLab.css";

const ZOOMS = [1, 2, 4, 8];
const HANDLE_SIZE = 10;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function frameOverrideFromDescriptor(frame) {
    return {
        bbox: { ...(frame?.bbox || { x: 0, y: 0, w: 1, h: 1 }) },
        pivot: { ...(frame?.pivot || { x: 0.5, y: 0.85 }) },
        disabled: false,
    };
}

function checkerStyle() {
    return {
        backgroundColor: "#d7d7d7",
        backgroundImage:
            "linear-gradient(45deg, #aaa 25%, transparent 25%), linear-gradient(-45deg, #aaa 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #aaa 75%), linear-gradient(-45deg, transparent 75%, #aaa 75%)",
        backgroundSize: "16px 16px",
        backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
    };
}

export default function SpriteLab() {
    const [sprites, setSprites] = useState([]);
    const [selectedId, setSelectedId] = useState("");
    const [descriptor, setDescriptor] = useState(null);
    const [frameIndex, setFrameIndex] = useState(0);
    const [zoom, setZoom] = useState(4);
    const [showRed, setShowRed] = useState(true);
    const [onion, setOnion] = useState(true);
    const [overrides, setOverrides] = useState({});
    const [status, setStatus] = useState("");
    const stageRef = useRef(null);
    const dragRef = useRef(null);

    useEffect(() => {
        let alive = true;
        listSprites()
            .then((items) => {
                if (!alive) return;
                setSprites(items);
                setSelectedId((current) => current || items[0]?.id || "");
            })
            .catch((error) => setStatus(error.message));
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        if (!selectedId) return;
        let alive = true;
        getSpriteDescriptor(selectedId)
            .then((data) => {
                if (!alive) return;
                setDescriptor(data);
                setFrameIndex(0);
                setOverrides({});
                setStatus("");
            })
            .catch((error) => setStatus(error.message));
        return () => {
            alive = false;
        };
    }, [selectedId]);

    const frame = descriptor?.frames?.[frameIndex];
    const current = useMemo(() => {
        if (!frame) return null;
        return overrides[frameIndex] || frameOverrideFromDescriptor(frame);
    }, [frame, frameIndex, overrides]);

    const frameCount = descriptor?.frameCount || 0;
    const sourceRect = frame?.sourceRect || { x: 0, y: 0, w: descriptor?.frameWidth || 1, h: descriptor?.frameHeight || 1 };
    const previewW = Math.max(1, (descriptor?.frameWidth || sourceRect.w) * zoom);
    const previewH = Math.max(1, (descriptor?.frameHeight || sourceRect.h) * zoom);

    function patchFrame(patch) {
        setOverrides((prev) => ({
            ...prev,
            [frameIndex]: {
                ...frameOverrideFromDescriptor(frame),
                ...(prev[frameIndex] || {}),
                ...patch,
                bbox: { ...frameOverrideFromDescriptor(frame).bbox, ...(prev[frameIndex]?.bbox || {}), ...(patch.bbox || {}) },
                pivot: { ...frameOverrideFromDescriptor(frame).pivot, ...(prev[frameIndex]?.pivot || {}), ...(patch.pivot || {}) },
            },
        }));
    }

    function setBBoxValue(key, value) {
        const bbox = { ...current.bbox, [key]: Number(value) || 0 };
        bbox.w = Math.max(1, bbox.w);
        bbox.h = Math.max(1, bbox.h);
        patchFrame({ bbox });
    }

    function setPivotValue(key, value) {
        patchFrame({ pivot: { ...current.pivot, [key]: clamp(Number(value), 0, 1) } });
    }

    function beginDrag(kind, event) {
        event.preventDefault();
        dragRef.current = {
            kind,
            startX: event.clientX,
            startY: event.clientY,
            bbox: { ...current.bbox },
            pivot: { ...current.pivot },
        };
        window.addEventListener("mousemove", onDrag);
        window.addEventListener("mouseup", endDrag, { once: true });
    }

    function onDrag(event) {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = Math.round((event.clientX - drag.startX) / zoom);
        const dy = Math.round((event.clientY - drag.startY) / zoom);
        if (drag.kind === "pivot") {
            patchFrame({
                pivot: {
                    x: clamp(drag.pivot.x + dx / Math.max(1, descriptor?.frameWidth || sourceRect.w), 0, 1),
                    y: clamp(drag.pivot.y + dy / Math.max(1, descriptor?.frameHeight || sourceRect.h), 0, 1),
                },
            });
            return;
        }
        const box = { ...drag.bbox };
        if (drag.kind.includes("move")) {
            box.x = drag.bbox.x + dx;
            box.y = drag.bbox.y + dy;
        }
        if (drag.kind.includes("e")) box.w = Math.max(1, drag.bbox.w + dx);
        if (drag.kind.includes("s")) box.h = Math.max(1, drag.bbox.h + dy);
        if (drag.kind.includes("w")) {
            box.x = drag.bbox.x + dx;
            box.w = Math.max(1, drag.bbox.w - dx);
        }
        if (drag.kind.includes("n")) {
            box.y = drag.bbox.y + dy;
            box.h = Math.max(1, drag.bbox.h - dy);
        }
        patchFrame({ bbox: box });
    }

    function endDrag() {
        dragRef.current = null;
        window.removeEventListener("mousemove", onDrag);
    }

    async function save() {
        if (!descriptor) return;
        setStatus("saving overrides...");
        await saveSpriteOverrides(descriptor.id, Object.fromEntries(Object.entries(overrides).map(([key, value]) => [key, value])), descriptor.source);
        setStatus("saved overrides");
    }

    async function rebuild() {
        if (!descriptor) return;
        setStatus("rebuilding cleaned sprites...");
        await rebuildSprite(descriptor.id);
        const next = await getSpriteDescriptor(descriptor.id);
        setDescriptor(next);
        setStatus("rebuilt cleaned sprites");
    }

    function resetFrame() {
        setOverrides((prev) => {
            const next = { ...prev };
            delete next[frameIndex];
            return next;
        });
    }

    if (!descriptor && !selectedId) {
        return <main className="sprite-lab"><div className="sprite-lab-empty">No cleaned sprites found. Run npm run sprites.</div></main>;
    }

    return (
        <main className="sprite-lab">
            <aside className="sprite-lab-sidebar">
                <div className="sprite-lab-title">Sprite Lab</div>
                <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                    {sprites.map((item) => (
                        <option key={item.id} value={item.id}>{item.id}</option>
                    ))}
                </select>
                <div className="sprite-list">
                    {sprites.map((item) => (
                        <button key={item.id} className={item.id === selectedId ? "active" : ""} onClick={() => setSelectedId(item.id)}>
                            <span>{item.id}</span>
                            {item.warnings?.length ? <b>{item.warnings.length}</b> : null}
                        </button>
                    ))}
                </div>
            </aside>

            <section className="sprite-lab-main">
                <header className="sprite-lab-toolbar">
                    <div>
                        <strong>{descriptor?.id || "loading"}</strong>
                        <span>{descriptor?.source}</span>
                    </div>
                    <div className="tool-buttons">
                        <button onClick={() => setShowRed((value) => !value)} title="Toggle red background visibility">
                            {showRed ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button className={onion ? "active" : ""} onClick={() => setOnion((value) => !value)}>onion</button>
                        {ZOOMS.map((value) => (
                            <button key={value} className={zoom === value ? "active" : ""} onClick={() => setZoom(value)}>{value}x</button>
                        ))}
                        <button onClick={save} title="Save overrides"><Save size={16} /></button>
                        <button onClick={rebuild} title="Export cleaned"><RefreshCw size={16} /></button>
                    </div>
                </header>

                <div className="sprite-lab-content">
                    <div className="preview-column">
                        <h2>Original</h2>
                        <div className={`image-preview ${showRed ? "show-red" : ""}`} style={checkerStyle()}>
                            {descriptor?.originalImageUrl && <img src={descriptor.originalImageUrl} alt="" />}
                        </div>
                        <h2>Cleaned</h2>
                        <div className="image-preview" style={checkerStyle()}>
                            {descriptor?.cleanedImageUrl && <img src={descriptor.cleanedImageUrl} alt="" />}
                        </div>
                    </div>

                    <div className="editor-column">
                        <div className="frame-grid">
                            {descriptor?.frames?.map((item) => (
                                <button key={item.index} className={item.index === frameIndex ? "active" : ""} onClick={() => setFrameIndex(item.index)}>
                                    <span>{item.index}</span>
                                    {item.warnings?.length ? <b>!</b> : null}
                                </button>
                            ))}
                        </div>

                        <div className="stage-wrap" style={{ width: previewW, height: previewH, ...checkerStyle() }}>
                            <div
                                ref={stageRef}
                                className={`sprite-stage ${showRed ? "red-visible" : ""}`}
                                style={{ width: previewW, height: previewH }}
                            >
                                {onion && frameIndex > 0 && (
                                    <img
                                        className="onion prev"
                                        src={descriptor.cleanedImageUrl}
                                        alt=""
                                        style={{
                                            width: descriptor.frameWidth * frameCount * zoom,
                                            height: descriptor.frameHeight * zoom,
                                            transform: `translateX(${-(frameIndex - 1) * descriptor.frameWidth * zoom}px)`,
                                        }}
                                    />
                                )}
                                {descriptor?.cleanedImageUrl && (
                                    <img
                                        className="current-frame"
                                        src={descriptor.cleanedImageUrl}
                                        alt=""
                                        style={{
                                            width: descriptor.frameWidth * frameCount * zoom,
                                            height: descriptor.frameHeight * zoom,
                                            transform: `translateX(${-frameIndex * descriptor.frameWidth * zoom}px)`,
                                        }}
                                    />
                                )}
                                {onion && frameIndex < frameCount - 1 && (
                                    <img
                                        className="onion next"
                                        src={descriptor.cleanedImageUrl}
                                        alt=""
                                        style={{
                                            width: descriptor.frameWidth * frameCount * zoom,
                                            height: descriptor.frameHeight * zoom,
                                            transform: `translateX(${-(frameIndex + 1) * descriptor.frameWidth * zoom}px)`,
                                        }}
                                    />
                                )}
                                {current && (
                                    <>
                                        <div
                                            className="bbox"
                                            onMouseDown={(event) => beginDrag("move", event)}
                                            style={{
                                                left: current.bbox.x * zoom,
                                                top: current.bbox.y * zoom,
                                                width: current.bbox.w * zoom,
                                                height: current.bbox.h * zoom,
                                            }}
                                        />
                                        {["nw", "ne", "sw", "se"].map((handle) => (
                                            <button
                                                key={handle}
                                                className={`bbox-handle ${handle}`}
                                                onMouseDown={(event) => beginDrag(handle, event)}
                                                style={{
                                                    left: (current.bbox.x + (handle.includes("e") ? current.bbox.w : 0)) * zoom - HANDLE_SIZE / 2,
                                                    top: (current.bbox.y + (handle.includes("s") ? current.bbox.h : 0)) * zoom - HANDLE_SIZE / 2,
                                                }}
                                                aria-label={`${handle} resize`}
                                            />
                                        ))}
                                        <button
                                            className="pivot"
                                            onMouseDown={(event) => beginDrag("pivot", event)}
                                            style={{
                                                left: current.pivot.x * (descriptor?.frameWidth || sourceRect.w) * zoom - HANDLE_SIZE / 2,
                                                top: current.pivot.y * (descriptor?.frameHeight || sourceRect.h) * zoom - HANDLE_SIZE / 2,
                                            }}
                                            aria-label="pivot"
                                        />
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="scrubber">
                            <button onClick={() => setFrameIndex((value) => Math.max(0, value - 1))}><ChevronLeft size={16} /></button>
                            <input type="range" min="0" max={Math.max(0, frameCount - 1)} value={frameIndex} onChange={(event) => setFrameIndex(Number(event.target.value))} />
                            <button onClick={() => setFrameIndex((value) => Math.min(frameCount - 1, value + 1))}><ChevronRight size={16} /></button>
                        </div>
                    </div>

                    <aside className="inspector">
                        <h2>Frame {frameIndex}</h2>
                        <div className="warning-box">
                            <div>visible pixels: {frame?.visiblePixels ?? 0}</div>
                            <div>duplicate: {frame?.duplicateOf ?? "none"}</div>
                            <div>warnings: {frame?.warnings?.join(", ") || "none"}</div>
                        </div>
                        {["x", "y", "w", "h"].map((key) => (
                            <label key={key}>
                                bbox {key}
                                <input type="number" value={current?.bbox?.[key] ?? 0} onChange={(event) => setBBoxValue(key, event.target.value)} />
                            </label>
                        ))}
                        {["x", "y"].map((key) => (
                            <label key={key}>
                                pivot {key}
                                <input type="number" min="0" max="1" step="0.01" value={current?.pivot?.[key] ?? 0} onChange={(event) => setPivotValue(key, event.target.value)} />
                            </label>
                        ))}
                        <button onClick={resetFrame}><RotateCcw size={16} /> reset frame</button>
                        <button onClick={() => setOverrides({})}><RotateCcw size={16} /> reset sheet</button>
                        <button onClick={rebuild}><RefreshCw size={16} /> export cleaned</button>
                        <div className="sprite-status">{status}</div>
                    </aside>
                </div>
            </section>
        </main>
    );
}
