import React from "react";

/**
 * Top-of-chat horizontal scrollable button row shown only on mobile.
 */
export default function MobileActionBar({
    users,
    showUsers,
    onToggleUsers,
    spray,
    killMode = false,
    onToggleKillMode,
    onOpenWorlds,
    onOpenSprite,
    onOpenSpray,
    onOpenJukebox,
    onOpenVideo,
    onCopyInvite,
}) {
    const btnStyle = { fontSize: 14, padding: "2px 6px", whiteSpace: "nowrap" };
    return (
        <div
            className="flex gap-1 overflow-x-auto"
            style={{ padding: 2, flex: "0 0 auto" }}
            data-testid="mobile-actions"
        >
            <button
                className={`w95-button ${showUsers ? "active" : ""}`}
                style={btnStyle}
                onClick={onToggleUsers}
                data-testid="m-toggle-users"
            >
                ☻ {users.length}
            </button>
            <button className="w95-button" style={btnStyle} onClick={onOpenWorlds} data-testid="m-worlds">
                ◈ Worlds
            </button>
            <button className="w95-button" style={btnStyle} onClick={onOpenSprite} data-testid="m-sprite">
                ☻ Sprites
            </button>
            <button
                className="w95-button"
                style={{ ...btnStyle, background: spray?.active ? "#b3ff00" : undefined }}
                onClick={onOpenSpray}
                data-testid="m-spray"
            >
                ※ Spray
            </button>
            <button
                className="w95-button"
                style={{
                    ...btnStyle,
                    background: killMode ? "#ff003c" : undefined,
                    color: killMode ? "#fff" : undefined,
                    fontWeight: killMode ? "bold" : "normal",
                }}
                onClick={onToggleKillMode}
                data-testid="m-kill-mode"
                title={killMode ? "kill mode ON" : "kill mode OFF"}
            >
                ⚔ {killMode ? "ON" : "OFF"}
            </button>
            <button className="w95-button" style={btnStyle} onClick={onOpenJukebox} data-testid="m-jukebox">
                ♪
            </button>
            <button className="w95-button" style={btnStyle} onClick={onOpenVideo} data-testid="m-video">
                ▶
            </button>
            <button className="w95-button" style={btnStyle} onClick={onCopyInvite} data-testid="m-share">
                ⛓
            </button>
        </div>
    );
}
