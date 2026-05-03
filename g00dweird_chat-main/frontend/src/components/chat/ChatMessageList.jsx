import React, { useMemo } from "react";
import FullfunkText from "../FullfunkText";
import {
    isLiminalRoom,
    liminalDisplayName,
    liminalMessageStyle,
    liminalOrderMessages,
    useLiminalNow,
    useLiminalPhantomMessage,
} from "../../lib/liminal";

function fmtTime(iso) {
    try {
        return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "";
    }
}

function renderText(m) {
    if (isSystem(m)) return <span>{m.text}</span>;
    if (isFullfunk(m)) return <FullfunkText text={m.text} size={16} testId="fullfunk-chat" />;
    return <span>{m.text}</span>;
}

function isFullfunk(m) {
    return !!(m?.fullfunk || m?.is_fullfunk);
}

function isSystem(m) {
    return !!(m?.system || m?.is_system || m?.user_id === "system");
}

/**
 * Bottom-of-iso-world translucent message overlay. Auto-scrolls via the
 * `listRef` passed in by the parent.
 */
export default function ChatMessageList({
    messages,
    listRef,
    height,
    currentNickname,
    room,
    bottomOffset = 0,
}) {
    const liminal = isLiminalRoom(room);
    const liminalNow = useLiminalNow(liminal, 1200);
    const phantomMessage = useLiminalPhantomMessage(liminal);
    const visibleMessages = useMemo(() => {
        const withPhantom = phantomMessage ? [...messages, phantomMessage] : messages;
        return liminalOrderMessages(withPhantom, liminalNow, liminal);
    }, [liminal, liminalNow, messages, phantomMessage]);

    return (
        <div
            ref={listRef}
            style={{
                position: "absolute",
                left: 0, right: 0, bottom: bottomOffset,
                height,
                overflow: "auto",
                padding: 6,
                background: "rgba(245,245,245,0.58)",
                backdropFilter: "blur(4px) saturate(1.25)",
                WebkitBackdropFilter: "blur(4px) saturate(1.25)",
                borderTop: "2px solid #000",
                boxShadow: "0 -1px 0 #fff inset, 0 -10px 22px rgba(0,0,0,0.18)",
                zIndex: 2,
            }}
            data-testid="chat-messages"
        >
            {visibleMessages.length === 0 && (
                <div
                    style={{ color: "#222", textShadow: "0 0 2px #fff" }}
                    className="font-mono-retro"
                >
                    -- no signal yet. say something weird. --
                </div>
            )}
            {visibleMessages.map((m, i) => {
                const displayName = liminalDisplayName(m.nickname, m.user_id || m.nickname || i, liminalNow);
                return (
                <div
                    key={m.id || `${m.user_id || "sys"}-${m.ts || i}`}
                    className={`font-mono-retro ${isSystem(m) ? "chat-msg-system" : ""}`}
                    data-testid="chat-message"
                    data-liminal-message={m.liminal_phantom ? "phantom" : liminal ? "true" : "false"}
                    style={{
                        wordBreak: "break-word",
                        marginBottom: isFullfunk(m) ? 4 : 0,
                        textShadow: "0 0 3px #fff, 0 0 3px #fff",
                        ...liminalMessageStyle(m, i, liminalNow, liminal),
                    }}
                >
                    <span style={{ color: "#333", fontSize: 14 }}>
                        [{fmtTime(m.ts)}]
                    </span>{" "}
                    {!isSystem(m) && (
                        <span
                            className="font-pixel"
                            style={{
                                color: m.liminal_phantom
                                    ? "#555"
                                    : m.nickname === currentNickname ? "#aa0088" : "#000080",
                                fontSize: 11,
                            }}
                        >
                            {displayName}:
                        </span>
                    )}{" "}
                    {renderText(m)}
                </div>
                );
            })}
        </div>
    );
}
