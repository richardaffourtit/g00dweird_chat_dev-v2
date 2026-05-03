import React from "react";
import Win95Window from "./Win95Window";

export default function WorldPicker({ rooms, activeRoomId, onPick, onClose, initialX = 60, initialY = 280, requestFocus = 0 }) {
    return (
        <Win95Window
            title="Worlds.exe"
            testId="world-picker"
            initialX={initialX}
            initialY={initialY}
            width={360}
            onClose={onClose}
            requestFocus={requestFocus}
            icon={<span style={{ color: "#ff00ff" }}>◈</span>}
        >
            <div className="p-2" style={{ background: "var(--w95-bg)" }}>
                <div
                    className="font-pixel px-2 py-1"
                    style={{ background: "#000080", color: "#fff", fontSize: 10 }}
                >
                    CHOOSE A PIXEL WORLD
                </div>
                <ul className="mt-2 flex flex-col gap-1">
                    {rooms.map((r) => (
                        <li key={r.id}>
                            <button
                                className="w95-button w-full text-left flex justify-between items-center"
                                onClick={() => onPick(r)}
                                data-testid={`world-pick-${r.id}`}
                                style={{
                                    background: r.id === activeRoomId ? "#000080" : undefined,
                                    color: r.id === activeRoomId ? "#fff" : undefined,
                                }}
                            >
                                <span>
                                    <span className="font-pixel" style={{ fontSize: 11 }}>
                                        {r.name}
                                    </span>
                                    <span aria-hidden style={{ margin: "0 6px", opacity: 0.55 }}>
                                        -
                                    </span>
                                    <span className="font-mono-retro" style={{ fontSize: 16, opacity: 0.8 }}>
                                        {r.tagline}
                                    </span>
                                </span>
                                {r.id === activeRoomId && (
                                    <span className="font-pixel" style={{ fontSize: 10 }}>
                                        ◄ ACTIVE
                                    </span>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="font-pixel mt-3" style={{ fontSize: 9, color: "#555", lineHeight: 1.4 }}>
                    each world has its own chat. vibes shift between portals.
                </div>
            </div>
        </Win95Window>
    );
}
