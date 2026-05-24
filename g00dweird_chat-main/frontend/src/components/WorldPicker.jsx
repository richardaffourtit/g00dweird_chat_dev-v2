import React from "react";
import Win95Window from "./Win95Window";
import { fileUrl } from "../lib/api";

const WORLD_ICON_URLS = {
    heaven: "/assets/world-icons/heaven.png",
    mars: "/assets/world-icons/mars.png",
    "inspiration-theatre": "/assets/world-icons/inspiration-theatre.png",
    wwworld: "/assets/world-icons/wwworld.png",
    "neoclassick-world": "/assets/world-icons/neoclassick-world.png",
    "basketball-court": "/assets/world-icons/basketball-court.png",
    "toxic-void": "/assets/world-icons/toxic-void.png",
    jello: "/assets/world-icons/jello.png",
    "regular-cafe": "/assets/world-icons/regular-cafe.png",
    hello: "/assets/world-icons/hello.png",
    "food-court": "/assets/world-icons/food-court.png",
    spiderweb: "/assets/world-icons/spiderweb.png",
};

const WORLD_ROW_HEIGHT = 96;
const WORLD_ROW_GAP = 4;
const WORLD_PICKER_CHROME_HEIGHT = 104;
const WORLD_PICKER_MIN_HEIGHT = 360;
const WORLD_PICKER_FALLBACK_HEIGHT = 560;
const DESKTOP_BOTTOM_GAP = 42;

function useViewportHeight() {
    const [height, setHeight] = React.useState(() => (
        typeof window !== "undefined" ? window.innerHeight : 0
    ));

    React.useEffect(() => {
        const onResize = () => setHeight(window.innerHeight);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    return height;
}

function getWorldPickerHeight(roomCount, initialY, viewportHeight) {
    if (!viewportHeight) return WORLD_PICKER_FALLBACK_HEIGHT;

    const rows = Math.max(1, roomCount);
    const fullListHeight = rows * WORLD_ROW_HEIGHT + (rows - 1) * WORLD_ROW_GAP;
    const desiredHeight = fullListHeight + WORLD_PICKER_CHROME_HEIGHT;
    const availableHeight = Math.max(WORLD_PICKER_MIN_HEIGHT, viewportHeight - initialY - DESKTOP_BOTTOM_GAP);

    return Math.max(WORLD_PICKER_MIN_HEIGHT, Math.min(desiredHeight, availableHeight));
}

function pickWorldIconUrl(room) {
    if (!room) return "";
    if (room.icon_url) return fileUrl(room.icon_url);
    if (room.iconPath) return room.iconPath;
    if (room.icon) return fileUrl(room.icon);
    return room.bg_url ? fileUrl(room.bg_url) : "";
}

function WorldIcon({ room }) {
    const [failed, setFailed] = React.useState(false);
    const cleanedIconUrl = WORLD_ICON_URLS[room?.theme || room?.id];
    const iconUrl = cleanedIconUrl || pickWorldIconUrl(room);
    const fallback = room?.id ? room.id.toUpperCase().slice(0, 2) : "??";

    if (failed || !iconUrl) {
        return (
            <div
                aria-hidden
                title={room?.name || ""}
                style={{
                    width: 72,
                    height: 72,
                    flex: "0 0 72px",
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
                width: 72,
                height: 72,
                flex: "0 0 72px",
                objectFit: cleanedIconUrl ? "contain" : "cover",
                objectPosition: "center",
                border: cleanedIconUrl ? 0 : "2px solid #fff",
                background: cleanedIconUrl ? "transparent" : "#111",
                imageRendering: "pixelated",
                filter: cleanedIconUrl ? "drop-shadow(2px 2px 0 rgba(0,0,0,0.45))" : undefined,
                boxShadow: cleanedIconUrl ? "none" : "inset 1px 1px 0 #000",
            }}
        />
    );
}

export default function WorldPicker({ rooms, activeRoomId, onPick, onClose, initialX = 60, initialY = 280, requestFocus = 0 }) {
    const viewportHeight = useViewportHeight();
    const initialHeight = getWorldPickerHeight(rooms.length, initialY, viewportHeight);

    return (
        <Win95Window
            title="Worlds.exe"
            testId="world-picker"
            initialX={initialX}
            initialY={initialY}
            width={460}
            height={initialHeight}
            resizable
            minWidth={380}
            minHeight={300}
            onClose={onClose}
            requestFocus={requestFocus}
            icon={<span style={{ color: "#ff00ff" }}>◈</span>}
        >
            <div
                className="p-2"
                style={{
                    background: "var(--w95-bg)",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                }}
            >
                <div
                    className="font-pixel px-2 py-1"
                    style={{ background: "#000080", color: "#fff", fontSize: 10 }}
                >
                    CHOOSE A PIXEL WORLD
                </div>
                <div
                    className="w95-bevel-inset mt-2"
                    style={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: "auto",
                        overflowX: "hidden",
                        padding: 4,
                        background: "#d8d8d8",
                    }}
                >
                    <ul className="flex flex-col gap-1">
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
                                        minHeight: 84,
                                    }}
                                >
                                    <div
                                        className="px-2 py-1"
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            minHeight: 84,
                                        }}
                                    >
                                        <WorldIcon room={r} />
                                        <div style={{ minWidth: 0, flex: 1, paddingRight: r.id === activeRoomId ? 74 : 0 }}>
                                            <span className="font-pixel" style={{ fontSize: 11 }}>
                                                {r.name}
                                            </span>
                                            <div
                                                className="font-mono-retro"
                                                style={{
                                                    fontSize: 17,
                                                    lineHeight: 1.05,
                                                    opacity: 0.82,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {r.tagline}
                                            </div>
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
                </div>
                <div className="font-pixel mt-2" style={{ fontSize: 9, color: "#555", lineHeight: 1.4, flex: "0 0 auto" }}>
                    each world has its own chat. vibes shift between portals.
                </div>
            </div>
        </Win95Window>
    );
}
