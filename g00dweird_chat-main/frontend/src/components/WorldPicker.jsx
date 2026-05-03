import React from "react";
import Win95Window from "./Win95Window";
import { fileUrl } from "../lib/api";

function pickWorldIconUrl(room) {
    if (!room) return "";
    if (room.icon_url) return fileUrl(room.icon_url);
    if (room.iconPath) return room.iconPath;
    if (room.icon) return fileUrl(room.icon);
    return room.bg_url ? fileUrl(room.bg_url) : "";
}

function WorldIcon({ room }) {
    const [failed, setFailed] = React.useState(false);
    const iconUrl = pickWorldIconUrl(room);
    const fallback = room?.id ? room.id.toUpperCase().slice(0, 2) : "??";
    if (failed || !iconUrl) {
        return (
            <div
                aria-hidden
                title={room?.name || ""}
                style={{
                    width: 48,
                    height: 48,
                    border: "2px solid #fff",
                    imageRendering: "pixelated",
                    background: "#000",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "monospace",
                    fontSize: 9,
                    fontWeight: "bold",
                    boxShadow: "inset 1px 1px 0 #444",
                }}
            >
                {fallback}
            </div>
        );
    }
    return (
        <img
            alt={`${room?.name || "world"} icon`}
            src={iconUrl}
            onError={() => setFailed(true)}
            style={{
                width: 48,
                height: 48,
                objectFit: "cover",
                objectPosition: "center",
                border: "2px solid #fff",
                background: "#111",
                imageRendering: "pixelated",
                boxShadow: "inset 1px 1px 0 #000",
            }}
        />
    );
}

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
                                className="w95-button w-full text-left p-0 overflow-hidden"
                                onClick={() => onPick(r)}
                                data-testid={`world-pick-${r.id}`}
                                style={{
                                    background: r.id === activeRoomId ? "#000080" : undefined,
                                    color: r.id === activeRoomId ? "#fff" : undefined,
                                    position: "relative",
                                }}
                            >
                                <div className="px-2 py-1">
                                    <div>
                                        <span className="font-pixel" style={{ fontSize: 11 }}>
                                            {r.name}
                                        </span>
                                        <span aria-hidden style={{ margin: "0 6px", opacity: 0.55 }}>
                                            -
                                        </span>
                                        <span className="font-mono-retro" style={{ fontSize: 16, opacity: 0.8 }}>
                                            {r.tagline}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2">
                                        <WorldIcon room={r} />
                                        <span
                                            aria-hidden
                                            style={{ height: 1, flex: 1, background: "#8883" }}
                                        />
                                    </div>
                                </div>
                                {r.id === activeRoomId && (
                                    <span
                                        className="font-pixel"
                                        style={{ fontSize: 10, position: "absolute", right: 8, top: 8 }}
                                    >
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
