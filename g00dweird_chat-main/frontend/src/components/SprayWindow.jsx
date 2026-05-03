import React, { useEffect, useRef, useState } from "react";
import Win95Window from "./Win95Window";
import { isPresetTag, TAG_WORDS, tagImageUrl } from "../lib/tags";
import FullfunkText from "./FullfunkText";

/**
 * Spray paint control window.
 * - Pick a preset graffiti tag OR type custom text (rendered as fullfunk glyphs).
 * - When spraying=ON, clicks on the iso world place the selected tag.
 * - Signals parent via onConfigChange({ active, tag, custom, size })
 */
export default function SprayWindow({
    active,
    onToggleActive,
    selectedTag,
    isCustom,
    customText,
    onPickPreset,
    onSetCustom,
    tagSize,
    onSetSize,
    onClearAll,
    onClose,
    initialX = 220,
    initialY = 120,
    requestFocus = 0,
}) {
    const [custom, setCustom] = useState(customText || "");

    useEffect(() => {
        setCustom(customText || "");
    }, [customText]);

    const setCustomSubmit = (e) => {
        e.preventDefault();
        const t = custom.trim().slice(0, 20).toUpperCase();
        if (t) onSetCustom(t);
    };

    return (
        <Win95Window
            title="SprayTool.exe"
            testId="spray-window"
            initialX={initialX}
            initialY={initialY}
            width={720}
            height={690}
            onClose={onClose}
            requestFocus={requestFocus}
            resizable
            minWidth={560}
            minHeight={540}
            icon={<span style={{ color: "#b3ff00" }}>※</span>}
        >
            <div
                className="flex flex-col h-full p-2 gap-2"
                style={{ background: "var(--w95-bg)", minHeight: 0 }}
            >
                <div
                    className="w95-bevel-inset px-2 py-1 font-mono-retro"
                    style={{ fontSize: 15 }}
                >
                    pick a tag, then click the iso world to spray. tags
                    screen-blend onto the scene.
                </div>

                <div className="flex items-center gap-2">
                    <button
                        className={`w95-button ${active ? "active" : ""}`}
                        onClick={onToggleActive}
                        data-testid="spray-toggle"
                        style={{
                            flex: 1,
                            background: active ? "#b3ff00" : undefined,
                            fontWeight: "bold",
                        }}
                    >
                        {active ? "◉ SPRAYING" : "○ spray off"}
                    </button>
                    <button
                        className="w95-button"
                        onClick={onClearAll}
                        data-testid="spray-clear"
                        title="Clear all tags in this room"
                    >
                        ✗ clear
                    </button>
                </div>

                {/* size slider */}
                <div className="w95-bevel-inset p-2 flex items-center gap-2">
                    <span className="font-pixel" style={{ fontSize: 10 }}>
                        SIZE
                    </span>
                    <input
                        type="range"
                        min="0.6"
                        max="2.5"
                        step="0.1"
                        value={tagSize}
                        onChange={(e) => onSetSize(parseFloat(e.target.value))}
                        style={{ flex: 1 }}
                        data-testid="spray-size"
                    />
                    <span
                        className="font-mono-retro"
                        style={{ fontSize: 14, width: 36, textAlign: "right" }}
                    >
                        {tagSize.toFixed(1)}x
                    </span>
                </div>

                {/* custom text form */}
                <form
                    onSubmit={setCustomSubmit}
                    className="flex gap-1 items-center w95-bevel-inset p-2"
                    data-testid="spray-custom-form"
                >
                    <span className="font-pixel" style={{ fontSize: 10 }}>
                        CUSTOM
                    </span>
                    <input
                        className="w95-input flex-1"
                        value={custom}
                        onChange={(e) => setCustom(e.target.value.toUpperCase())}
                        maxLength={20}
                        placeholder="type a tag..."
                        data-testid="spray-custom-input"
                    />
                    <button
                        className="w95-button"
                        type="submit"
                        data-testid="spray-custom-set"
                    >
                        set
                    </button>
                </form>

                {/* preset tags grid */}
                <div
                    className="w95-bevel-inset flex-1"
                    style={{ overflow: "auto", background: "#000", minHeight: 360 }}
                    data-testid="spray-presets"
                >
                    <div
                        className="font-pixel px-2 py-1"
                        style={{
                            background: "#000080",
                            color: "#fff",
                            fontSize: 10,
                            position: "sticky",
                            top: 0,
                        }}
                    >
                        PRESET TAGS [{TAG_WORDS.length}]
                    </div>
                    <div
                        className="p-2"
                        style={{
                            background: "#000",
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
                            gap: 8,
                            alignItems: "stretch",
                        }}
                    >
                        {TAG_WORDS.map((w) => (
                            <button
                                key={w}
                                onClick={() => onPickPreset(w)}
                                className="flex flex-col items-center justify-center p-1"
                                data-testid={`spray-preset-${w}`}
                                style={{
                                    background: "#000",
                                    border:
                                        !isCustom && selectedTag === w
                                            ? "2px solid #ff00ff"
                                            : "2px solid #333",
                                    minHeight: 76,
                                    cursor: "pointer",
                                    overflow: "hidden",
                                }}
                            >
                                <img
                                    src={tagImageUrl(w)}
                                    alt={w}
                                    style={{
                                        maxWidth: "100%",
                                        maxHeight: 54,
                                        imageRendering: "pixelated",
                                        objectFit: "contain",
                                    }}
                                    draggable={false}
                                />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Preview of currently selected tag */}
                <div
                    className="w95-bevel-inset p-2 flex items-center gap-2"
                    style={{ background: "#000", minHeight: 48 }}
                    data-testid="spray-selection"
                >
                    <span className="font-pixel" style={{ fontSize: 9, color: "#ff00ff" }}>
                        SEL:
                    </span>
                    {isCustom || !isPresetTag(selectedTag || "GOOD") ? (
                        <FullfunkText text={selectedTag || "—"} size={20} />
                    ) : (
                        <img
                            src={tagImageUrl(selectedTag || "GOOD")}
                            alt={selectedTag}
                            style={{ height: 36, imageRendering: "pixelated" }}
                            draggable={false}
                        />
                    )}
                    <span
                        className="font-pixel ml-auto"
                        style={{ fontSize: 9, color: "#888" }}
                    >
                        {isCustom ? "custom fullfunk" : "preset"}
                    </span>
                </div>
            </div>
        </Win95Window>
    );
}
