import React from "react";
import Win95Window from "./Win95Window";
import { Sprite, SPRITES, SPRITE_IDS } from "../lib/sprites";
import AnimSprite, { ANIM_CREATURES, getAvailableStates, EMOTE_LABELS } from "./AnimSprite";

export const ANIM_DISPLAY_NAMES = {
    teekae: "Tee Kae",
};

export function animDisplayName(id) {
    return ANIM_DISPLAY_NAMES[id] || id;
}

const STATE_LABELS = {
    // user-chosen "emote" stances
    action: "action",
    wiggle: "wiggle",
    split: "split",
    sway: "sway",
    bite: "bite",
    spitseed: "spit",
    fade: "fade",
    scare: "scare",
    talk: "talk",
    think: "think",
    glitch: "glitch",
    // solo-sheet emotes (single-frame poses)
    happy: "happy",
    wonder: "wonder",
    excited: "excited",
    cry: "cry",
    confused: "confused",
    love: "love",
    sleep: "sleep",
    spook: "spook",
    tongue: "tongue",
    mad: "mad",
    peace: "peace",
    dead: "dead",
    surprise: "surprise",
    // auto/locomotion (kept here so labels resolve elsewhere)
    idle: "idle",
    walk: "walk",
    run: "run",
    jump: "jump",
    hop: "hop",
    attack: "attack",
    hurt: "hurt",
    die: "die",
    fly: "fly",
    dive: "dive",
    dash: "dash",
    float: "float",
    idlehang: "hang",
};

const SPRITE_GRID_STYLE = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(74px, 1fr))",
    gap: 6,
};

const SPRITE_TILE_STYLE = {
    minHeight: 82,
    padding: 6,
};

const ANIM_PREVIEW_FRAME = {
    width: 72,
    height: 56,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
};

function previewStateFor(id, active, animStance) {
    if (active) return animStance || "idle";
    const states = getAvailableStates(id);
    return states.find((st) => ["walk", "hop", "float", "wiggle", "fly"].includes(st)) || "idle";
}

// Locomotion / damage / PvP stances are AUTO-driven (by movement / clicking other users).
// Only "emote" stances appear in the picker for user choice.
const AUTO_STATES = new Set([
    "idle", "walk", "run", "hop", "jump",
    "attack", "action", "hurt", "die",
    "fly", "dive", "dash", "float", "idlehang",
]);

export default function SpritePicker({
    selectedSpriteId,
    animId,
    animStance = "idle",
    onPickSprite,
    onPickAnim,
    onPickStance,
    onClearCustom,
    onClose,
    initialX = 180,
    initialY = 120,
    requestFocus = 0,
}) {
    const staticGroups = { ghost: [], alien: [], ape: [] };
    SPRITE_IDS.forEach((id) => {
        const s = SPRITES[id];
        if (staticGroups[s.kind]) staticGroups[s.kind].push(id);
    });

    return (
        <Win95Window
            title="SpritePicker.exe"
            testId="sprite-picker"
            initialX={initialX}
            initialY={initialY}
            width={540}
            height={560}
            onClose={onClose}
            resizable
            minWidth={390}
            minHeight={430}
            requestFocus={requestFocus}
            icon={<span style={{ color: "#ff00ff" }}>☻</span>}
        >
            <div
                className="flex flex-col h-full p-2 gap-2"
                style={{ background: "var(--w95-bg)", overflow: "auto" }}
            >
                <div
                    className="w95-bevel-inset px-2 py-1 font-mono-retro"
                    style={{ fontSize: 15 }}
                >
                    pick a pixel body. your choice goes live in the iso world
                    for everyone.
                </div>

                {/* Emote picker (user-chosen poses; locomotion auto-driven by movement) */}
                {animId && (
                    <div
                        className="w95-bevel-inset p-2"
                        style={{ background: "#fff", position: "sticky", top: 0, zIndex: 5 }}
                        data-testid="stance-picker"
                    >
                        <div
                            className="font-pixel mb-1 flex items-center justify-between"
                            style={{ fontSize: 10, color: "#000080" }}
                        >
                            <span>POSES FOR <b>{animDisplayName(animId).toUpperCase()}</b></span>
                            <span style={{ color: "#999" }}>movement → walk/run auto</span>
                        </div>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(58px, 1fr))",
                                gap: 4,
                            }}
                        >
                            {getAvailableStates(animId)
                                .filter((st) => !AUTO_STATES.has(st))
                                .map((st) => (
                                <button
                                    key={st}
                                    className={`w95-button ${animStance === st ? "active" : ""}`}
                                    style={{
                                        background:
                                            animStance === st ? "#ffff99" : undefined,
                                        fontWeight:
                                            animStance === st ? "bold" : "normal",
                                    }}
                                    onClick={() => onPickStance(st)}
                                    data-testid={`stance-${st}`}
                                >
                                    {EMOTE_LABELS[animId]?.[st] || STATE_LABELS[st] || st}
                                </button>
                            ))}
                            <button
                                className="w95-button"
                                onClick={() => onPickStance("idle")}
                                data-testid="stance-idle"
                                title="reset to idle"
                            >
                                ◯ idle
                            </button>
                        </div>
                        <div
                            className="font-pixel mt-2"
                            style={{ fontSize: 9, color: "#555" }}
                        >
                            emotes pop immediately. movement and attacks happen in the world.
                        </div>
                    </div>
                )}

                {/* Animated sprites */}
                <div>
                    <div
                        className="font-pixel px-1 py-0.5"
                        style={{
                            background: "#000080", color: "#fff",
                            fontSize: 10, marginBottom: 4,
                        }}
                    >
                        ▣ ANIMATED (new!)
                    </div>
                    <div style={SPRITE_GRID_STYLE}>
                        {ANIM_CREATURES.map((id) => {
                            const active = animId === id;
                            const previewState = previewStateFor(id, active, animStance);
                            const displayName = animDisplayName(id);
                            return (
                                <button
                                    key={id}
                                    className="w95-bevel flex flex-col items-center p-2"
                                    style={{
                                        ...SPRITE_TILE_STYLE,
                                        background: active ? "#ffff99" : "#fff",
                                        outline: active ? "2px solid #b3ff00" : "none",
                                    }}
                                    onClick={() => onPickAnim(id)}
                                    data-testid={`anim-pick-${id}`}
                                    title={displayName}
                                >
                                    <div style={ANIM_PREVIEW_FRAME}>
                                        <AnimSprite
                                            creature={id}
                                            state={previewState}
                                            size={50}
                                            frameWidth={72}
                                            frameHeight={56}
                                            fps={active && animStance !== "idle" ? 4 : 6}
                                            alt={`${displayName}-${previewState}`}
                                        />
                                    </div>
                                    <span
                                        className="font-pixel mt-1"
                                        style={{ fontSize: 10, color: "#000" }}
                                    >
                                        {displayName}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Static SVG sprites */}
                {Object.entries(staticGroups).map(([kind, ids]) => (
                    <div key={kind}>
                        <div
                            className="font-pixel px-1 py-0.5"
                            style={{
                                background: "#000080", color: "#fff",
                                fontSize: 10, marginBottom: 4,
                            }}
                        >
                            ▣ {kind.toUpperCase()} (static)
                        </div>
                        <div style={SPRITE_GRID_STYLE}>
                            {ids.map((id) => {
                                const s = SPRITES[id];
                                const active = !animId && selectedSpriteId === id;
                                return (
                                    <button
                                        key={id}
                                    className="w95-bevel flex flex-col items-center p-2"
                                    style={{
                                        ...SPRITE_TILE_STYLE,
                                        background: active ? "#ffff99" : "#fff",
                                        outline: active ? "2px solid #ff00ff" : "none",
                                    }}
                                        onClick={() => onPickSprite(id)}
                                        data-testid={`sprite-pick-${id}`}
                                        title={s.label}
                                    >
                                        <Sprite
                                            id={id}
                                            size={s.size === "sm" ? 38 : s.size === "md" ? 48 : 58}
                                        />
                                        <span
                                            className="font-pixel mt-1"
                                            style={{ fontSize: 9, color: "#000" }}
                                        >
                                            {s.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}

                <div className="flex justify-between items-center pt-1">
                    <button
                        className="w95-button"
                        onClick={onClearCustom}
                        data-testid="sprite-clear-custom"
                        title="Drop uploaded avatar, keep current sprite"
                    >
                        ↻ reset to sprite
                    </button>
                    <button
                        className="w95-button"
                        onClick={onClose}
                        data-testid="sprite-close"
                    >
                        Close
                    </button>
                </div>
                <div
                    className="font-pixel"
                    style={{ fontSize: 9, color: "#555" }}
                >
                    uploaded avatars override sprites. animated overrides static.
                </div>
            </div>
        </Win95Window>
    );
}
