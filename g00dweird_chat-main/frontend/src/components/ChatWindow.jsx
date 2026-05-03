import React, { useEffect, useRef, useState } from "react";
import Win95Window from "./Win95Window";
import IsoWorld from "./IsoWorld";
import UserListSidebar from "./chat/UserListSidebar";
import ChatMessageList from "./chat/ChatMessageList";
import ChatInputBar from "./chat/ChatInputBar";
import MobileActionBar from "./chat/MobileActionBar";
import { isLiminalRoom, useLiminalPhantomTyping } from "../lib/liminal";

function useIsMobile(bp = 640) {
    const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth < bp);
    useEffect(() => {
        const on = () => setM(window.innerWidth < bp);
        window.addEventListener("resize", on);
        return () => window.removeEventListener("resize", on);
    }, [bp]);
    return m;
}

const DEFAULT_CHAT_HEIGHT = 130;
const MIN_CHAT = 60;
const MAX_CHAT = 400;

const ICON_COL_W = 108;     // matches the desktop icons column (~96 + margin)
const DESKTOP_TOP_GAP = 75;
const DESKTOP_RIGHT_GAP = 75;
const DESKTOP_BOTTOM_GAP = 75;
const TASKBAR_H = 34;
const DESKTOP_SIDEBAR_W = 200;
const DESKTOP_BODY_PAD = 4;
const DESKTOP_BODY_GAP = 4;
const DESKTOP_TITLEBAR_H = 24;
const CHAT_RESIZE_BAR_H = 10;
const TYPING_INDICATOR_H = 18;
const CHAT_INPUT_H = 34;
const CHAT_COMPOSE_OVERLAY_H = TYPING_INDICATOR_H + CHAT_INPUT_H + 8;
const MIN_WORLD_VIEW = 320;

function computeBounds(mobile) {
    if (typeof window === "undefined") return { x: 120, y: 40, w: 860, h: 620 };
    if (mobile) return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
    const y = DESKTOP_TOP_GAP;
    const maxW = Math.max(560, window.innerWidth - ICON_COL_W - DESKTOP_RIGHT_GAP);
    const maxH = Math.max(420, window.innerHeight - y - DESKTOP_BOTTOM_GAP - TASKBAR_H);
    const horizontalChrome = (DESKTOP_BODY_PAD * 2) + DESKTOP_BODY_GAP + DESKTOP_SIDEBAR_W;
    const verticalChrome = DESKTOP_TITLEBAR_H + (DESKTOP_BODY_PAD * 2);
    const worldView = Math.max(
        MIN_WORLD_VIEW,
        Math.min(maxW - horizontalChrome, maxH - verticalChrome)
    );
    const w = Math.max(560, Math.min(maxW, Math.round(worldView + horizontalChrome)));
    const h = Math.max(420, Math.min(maxH, Math.round(worldView + verticalChrome)));
    const x = Math.max(ICON_COL_W, window.innerWidth - DESKTOP_RIGHT_GAP - w);
    return { x, y, w, h };
}

function useChatBounds(mobile) {
    const [b, setB] = useState(() => computeBounds(mobile));
    useEffect(() => {
        const on = () => setB(computeBounds(mobile));
        window.addEventListener("resize", on);
        return () => window.removeEventListener("resize", on);
    }, [mobile]);
    return b;
}

export default function ChatWindow({
    user,
    room,
    users,
    messages,
    connected,
    typingUsers = {},
    tags = [],
    basketballShots = [],
    spray = null,
    onPlaceTag,
    send,
    onOpenJukebox,
    onOpenVideo,
    onOpenSprite,
    onOpenSpray,
    onOpenWorlds,
    onCopyInvite,
    onClose,
    youtubeTrack = null,
    restStance = "idle",
    requestFocus = 0,
}) {
    const mobile = useIsMobile();
    const bounds = useChatBounds(mobile);
    const [text, setText] = useState("");
    const [showEmotes, setShowEmotes] = useState(false);
    const [showUsers, setShowUsers] = useState(false);
    const [fullfunk, setFullfunk] = useState(false);
    const [chatH, setChatH] = useState(DEFAULT_CHAT_HEIGHT);
    const [resizing, setResizing] = useState(false);
    const [killMode, setKillMode] = useState(() => {
        try { return localStorage.getItem("g00d_kill_mode") === "1"; }
        catch { return false; }
    });
    const liminal = isLiminalRoom(room);
    const phantomTypingLabel = useLiminalPhantomTyping(liminal);
    const listRef = useRef(null);
    const typingTimerRef = useRef(null);
    const isTypingRef = useRef(false);
    const stanceRevertRef = useRef(null);
    const startRef = useRef({ y: 0, h: DEFAULT_CHAT_HEIGHT });

    // Push kill-mode to peers whenever it changes (and on first connect after
    // a refresh so other users see the persisted hostile flag).
    useEffect(() => {
        if (!connected) return;
        send({ type: "kill_mode", on: killMode });
        try { localStorage.setItem("g00d_kill_mode", killMode ? "1" : "0"); } catch { /* ignore */ }
    }, [killMode, connected, send]);

    // Autoscroll on new messages
    useEffect(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [messages]);

    // Resize drag (mouse + touch)
    useEffect(() => {
        if (!resizing) return undefined;
        const onMove = (e) => {
            const clientY = e.touches ? e.touches[0]?.clientY : e.clientY;
            if (clientY == null) return;
            const dy = startRef.current.y - clientY;
            setChatH(Math.max(MIN_CHAT, Math.min(MAX_CHAT, startRef.current.h + dy)));
        };
        const onUp = () => setResizing(false);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("touchend", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            window.removeEventListener("touchmove", onMove);
            window.removeEventListener("touchend", onUp);
        };
    }, [resizing]);

    useEffect(() => () => {
        if (stanceRevertRef.current) clearTimeout(stanceRevertRef.current);
    }, []);

    const startResize = (e) => {
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        startRef.current = { y, h: chatH };
        setResizing(true);
        e.preventDefault();
    };

    const signalTyping = (on) => {
        if (on === isTypingRef.current) return;
        isTypingRef.current = on;
        send({ type: "typing", typing: on });
    };

    const onChange = (e) => {
        const v = e.target.value;
        setText(v);
        if (v.length > 0) {
            signalTyping(true);
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(() => signalTyping(false), 2000);
        } else {
            signalTyping(false);
        }
    };

    const submit = (e) => {
        e.preventDefault();
        const t = text.trim();
        if (!t) return;
        send({ type: "chat", text: t, fullfunk });
        setText("");
        setShowEmotes(false);
        signalTyping(false);
    };

    const handleMove = (x, y, stance = null, travelMs = null, facing = null) => {
        // NOTE: send move FIRST, then stance — original order. Inverting these
        // (stance first, move second) caused the dash/float stance to never
        // appear in client state during testing — likely a state-batching
        // ordering quirk on the WS broadcast roundtrip.
        send({ type: "move", x, y, facing });
        if (stance) send({ type: "stance", stance });
        if (stanceRevertRef.current) clearTimeout(stanceRevertRef.current);
        // Hold the travel stance until the avatar finishes its CSS tween
        // (+400ms breathing room), so float/dash/run play through the full
        // move instead of cutting back to idle mid-flight.
        const holdMs = Math.max(900, (travelMs || 1200) + 400);
        stanceRevertRef.current = setTimeout(() => {
            send({ type: "stance", stance: restStance || "idle" });
            stanceRevertRef.current = null;
        }, holdMs);
    };

    const handleAttack = (targetId) => {
        if (!targetId) return;
        send({ type: "attack", target_id: targetId });
    };

    const handleClickUser = (target) => {
        if (!target) return;
        const url = `/u/${encodeURIComponent(target.nickname)}?u=${encodeURIComponent(target.user_id)}`;
        window.open(url, "_blank", "noopener,noreferrer");
    };

    const toggleKillMode = () => setKillMode((v) => !v);

    const typingNames = Object.keys(typingUsers)
        .filter((n) => n !== user.nickname)
        .slice(0, 3);
    if (phantomTypingLabel && !typingNames.includes(phantomTypingLabel)) {
        typingNames.push(phantomTypingLabel);
    }
    const typingLabel = typingNames.join(", ");

    const sidebar = (
        <UserListSidebar
            users={users}
            currentUser={user}
            room={room}
            spray={spray}
            killMode={killMode}
            onToggleKillMode={toggleKillMode}
            onOpenJukebox={onOpenJukebox}
            onOpenVideo={onOpenVideo}
            onOpenSprite={onOpenSprite}
            onOpenSpray={onOpenSpray}
            onOpenWorlds={onOpenWorlds}
            onCopyInvite={onCopyInvite}
        />
    );

    return (
        <Win95Window
            title={`g00dweird chat - [ ${room.name} ]`}
            testId="chat-window"
            initialX={bounds.x}
            initialY={bounds.y}
            width={bounds.w}
            height={bounds.h}
            onClose={onClose}
            requestFocus={requestFocus}
            resizable
            minWidth={560}
            minHeight={420}
            icon={
                <span
                    style={{
                        display: "inline-block",
                        width: 14, height: 14,
                        background: "#ffff00",
                        border: "1px solid #000",
                    }}
                />
            }
        >
            <div
                className="flex"
                style={{
                    height: "100%",
                    background: "var(--w95-bg)",
                    padding: 4,
                    gap: 4,
                    flexDirection: mobile ? "column" : "row",
                }}
            >
                {mobile && (
                    <MobileActionBar
                        users={users}
                        showUsers={showUsers}
                        onToggleUsers={() => setShowUsers((s) => !s)}
                        spray={spray}
                        killMode={killMode}
                        onToggleKillMode={toggleKillMode}
                        onOpenWorlds={onOpenWorlds}
                        onOpenSprite={onOpenSprite}
                        onOpenSpray={onOpenSpray}
                        onOpenJukebox={onOpenJukebox}
                        onOpenVideo={onOpenVideo}
                        onCopyInvite={onCopyInvite}
                    />
                )}

                <div className="flex flex-col flex-1" style={{ minWidth: 0, minHeight: 0 }}>
                    <div
                        className="w95-bevel-inset"
                        style={{
                            padding: 0,
                            flex: "1 1 auto",
                            minHeight: 160,
                            position: "relative",
                            overflow: "hidden",
                        }}
                    >
                        <IsoWorld
                            room={room}
                            users={users}
                            myId={user.user_id}
                            onMove={handleMove}
                            onAttack={handleAttack}
                            onClickUser={handleClickUser}
                            killMode={killMode}
                            onToggleKillMode={toggleKillMode}
                            tags={tags}
                            basketballShots={basketballShots}
                            spray={spray}
                            onPlaceTag={onPlaceTag}
                            youtubeTrack={youtubeTrack}
                            chatMessages={messages}
                            sendWS={send}
                            restStance={restStance}
                            bottomInset={0}
                            fitMode={mobile ? "cover" : "contain"}
                        />

                        {/* Resize handle (drag bar above chat overlay) */}
                        <div
                            onMouseDown={startResize}
                            onTouchStart={startResize}
                            data-testid="chat-resize"
                            title="drag to resize chat"
	                            style={{
	                                position: "absolute",
	                                left: 0, right: 0,
	                                bottom: chatH + CHAT_COMPOSE_OVERLAY_H,
	                                height: 10,
	                                background:
	                                    "repeating-linear-gradient(90deg,rgba(0,0,0,0.55) 0 4px,rgba(255,255,255,0.55) 4px 8px)",
                                cursor: "ns-resize",
                                borderTop: "1px solid #000",
                                borderBottom: "1px solid #000",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                userSelect: "none",
	                                touchAction: "none",
	                                zIndex: 5,
	                            }}
	                        >
                            <span
                                className="font-pixel"
                                style={{ fontSize: 9, color: "#000", lineHeight: 1, textShadow: "0 0 2px #fff" }}
                            >
                                ═ drag ═
                            </span>
                        </div>

                        <ChatMessageList
                            messages={messages}
                            listRef={listRef}
                            height={chatH}
	                            currentNickname={user.nickname}
	                            room={room}
	                            bottomOffset={CHAT_COMPOSE_OVERLAY_H}
	                        />

                        <div
                            data-testid="chat-compose-overlay"
                            style={{
                                position: "absolute",
                                left: 0,
                                right: 0,
                                bottom: 0,
                                minHeight: CHAT_COMPOSE_OVERLAY_H,
                                padding: "3px 4px 4px",
                                background: "rgba(224,224,224,0.66)",
                                backdropFilter: "blur(4px) saturate(1.2)",
                                WebkitBackdropFilter: "blur(4px) saturate(1.2)",
                                borderTop: "2px solid #000",
                                boxShadow: "0 -1px 0 #fff inset, 0 -14px 24px rgba(0,0,0,0.18)",
                                zIndex: 4,
                            }}
                        >
                            <div
                                className="font-mono-retro px-1"
                                style={{ fontSize: 14, color: "#aa0088", height: 18, minHeight: 18 }}
                                data-testid="typing-indicator"
                            >
                                {typingLabel && (
                                    <>
                                        <span className="blink">...</span>{" "}
                                        {typingLabel} {typingNames.length > 1 ? "are" : "is"} typing
                                    </>
                                )}
                            </div>

                            <ChatInputBar
                                text={text}
                                onChange={onChange}
                                onSubmit={submit}
                                fullfunk={fullfunk}
                                onToggleFullfunk={() => setFullfunk((v) => !v)}
                                showEmotes={showEmotes}
                                onToggleEmotes={() => setShowEmotes((s) => !s)}
                                onAddThink={() =>
                                    setText((t) => (t.startsWith("*think ") ? t : `*think ${t}`))
                                }
                                connected={connected}
                            />
                        </div>
	                    </div>
	                </div>

                {!mobile && (
                    <div className="flex flex-col" style={{ width: DESKTOP_SIDEBAR_W }}>
                        {sidebar}
                    </div>
                )}
                {mobile && showUsers && (
                    <div
                        className="flex flex-col"
                        style={{
                            position: "absolute",
                            top: 26, right: 0,
                            width: 220,
                            maxHeight: "calc(100% - 28px)",
                            background: "var(--w95-bg)",
                            padding: 4,
                            zIndex: 50,
                            border: "2px solid #000",
                        }}
                        data-testid="mobile-sidebar"
                    >
                        {sidebar}
                    </div>
                )}
            </div>
        </Win95Window>
    );
}
