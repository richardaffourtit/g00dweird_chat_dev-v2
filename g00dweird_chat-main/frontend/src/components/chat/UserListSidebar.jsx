import React from "react";
import { isLiminalRoom, liminalDisplayName, useLiminalNow } from "../../lib/liminal";

/**
 * Right-rail sidebar inside ChatWindow:
 * – User list with clickable links to /u/<nickname>
 * – Action buttons (Jukebox, Video, Sprites, Spray, Worlds, Share)
 */
export default function UserListSidebar({
    users,
    currentUser,
    room,
    spray,
    killMode = false,
    onToggleKillMode,
    onOpenJukebox,
    onOpenVideo,
    onOpenSprite,
    onOpenSpray,
    onOpenWorlds,
    onCopyInvite,
}) {
    const liminal = isLiminalRoom(room);
    const liminalNow = useLiminalNow(liminal, 2400);

    return (
        <>
            <div className="w95-bevel-inset flex-1" style={{ overflow: "auto", minHeight: 100 }}>
                <div
                    className="font-pixel px-2 py-1"
                    style={{ background: "#000080", color: "#fff", fontSize: 10 }}
                >
                    USERS [{users.length}]
                </div>
                <ul data-testid="user-list" className="font-mono-retro" style={{ padding: 4 }}>
                    {users.map((u) => {
                        const displayName = liminalDisplayName(u.nickname, u.user_id, liminalNow);
                        return (
                        <li
                            key={u.user_id}
                            className="flex items-center gap-1 py-0.5"
                            style={{
                                fontSize: 18,
                                lineHeight: 1.1,
                                opacity: liminal && u.user_id !== currentUser.user_id
                                    ? 0.88 + ((u.user_id.length + Math.floor(liminalNow / 5000)) % 3) * 0.04
                                    : 1,
                                transition: "opacity 900ms ease",
                            }}
                            data-testid="user-list-item"
                        >
                            <span
                                className="inline-block"
                                style={{
                                    width: 10, height: 10,
                                    background: u.user_id === currentUser.user_id ? "#ff00ff" : "#00aa00",
                                    border: "1px solid #000",
                                }}
                            />
                            <a
                                href={`/u/${encodeURIComponent(u.nickname)}?u=${encodeURIComponent(u.user_id)}`}
                                target="_blank"
                                rel="noreferrer"
                                title={`open ${u.nickname}'s profile`}
                                data-testid={`user-list-link-${u.nickname}`}
                                style={{
                                    fontWeight: u.user_id === currentUser.user_id ? "bold" : "normal",
                                    color: u.user_id === currentUser.user_id ? "#aa0088" : "#000",
                                    textDecoration: "none",
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                            >
                                {displayName}
                                {u.kill_mode ? (
                                    <span
                                        title="hostile — kill mode is ON"
                                        style={{ color: "#ff003c", marginLeft: 4 }}
                                        data-testid={`user-hostile-${u.nickname}`}
                                    >
                                        ⚔
                                    </span>
                                ) : null}
                                {u.thought ? " 💭" : ""}
                            </a>
                        </li>
                        );
                    })}
                </ul>
            </div>
            <div className="mt-1 flex flex-col gap-1">
                <button className="w95-button" onClick={onOpenJukebox} data-testid="open-jukebox">
                    ♪ Jukebox
                </button>
                <button className="w95-button" onClick={onOpenVideo} data-testid="open-video">
                    ▶ Video Wall
                </button>
                <button className="w95-button" onClick={onOpenSprite} data-testid="open-sprite">
                    ☻ Sprites
                </button>
                <button
                    className={`w95-button ${spray?.active ? "active" : ""}`}
                    onClick={onOpenSpray}
                    data-testid="open-spray"
                    style={{
                        background: spray?.active ? "#b3ff00" : undefined,
                        fontWeight: spray?.active ? "bold" : "normal",
                    }}
                >
                    ※ Spray {spray?.active ? "(ON)" : ""}
                </button>
                <button
                    className={`w95-button ${killMode ? "active" : ""}`}
                    onClick={onToggleKillMode}
                    data-testid="toggle-kill-mode"
                    title={killMode
                        ? "kill mode ON — clicks attack other avatars"
                        : "kill mode OFF — clicks open profiles"}
                    style={{
                        background: killMode ? "#ff003c" : undefined,
                        color: killMode ? "#fff" : undefined,
                        fontWeight: killMode ? "bold" : "normal",
                        textShadow: killMode ? "0 0 4px #ff6ec7" : "none",
                    }}
                >
                    ⚔ Kill Mode {killMode ? "(ON)" : ""}
                </button>
                <button className="w95-button" onClick={onOpenWorlds} data-testid="open-worlds">
                    ◈ Worlds
                </button>
                <button className="w95-button" onClick={onCopyInvite} data-testid="copy-invite">
                    ⛓ Share Room
                </button>
            </div>
            <div className="mt-1 px-1 py-1 font-pixel" style={{ fontSize: 9, color: "#555", lineHeight: 1.3 }}>
                room: {room.name}<br />tap iso to move.
            </div>
        </>
    );
}
