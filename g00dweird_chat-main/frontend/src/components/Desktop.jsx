import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { listRooms, fileUrl, api } from "../lib/api";
import { useChatSocket } from "../lib/useChatSocket";
import ChatWindow from "./ChatWindow";
import JukeboxWindow from "./JukeboxWindow";
import UploadDialog from "./UploadDialog";
import ProfileWindow from "./ProfileWindow";
import WorldPicker from "./WorldPicker";
import SpritePicker from "./SpritePicker";
import GuestbookWindow from "./GuestbookWindow";
import SprayWindow from "./SprayWindow";
import WallExeWindow from "./WallExeWindow";
import YouTubeWindow from "./YouTubeWindow";

function useIsMobile(bp = 640) {
    const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth < bp);
    useEffect(() => {
        const on = () => setM(window.innerWidth < bp);
        window.addEventListener("resize", on);
        return () => window.removeEventListener("resize", on);
    }, [bp]);
    return m;
}

function DesktopIcon({ label, glyph, color = "#fff", onDoubleClick, testId }) {
    return (
        <button
            onDoubleClick={onDoubleClick}
            onClick={onDoubleClick}
            className="flex flex-col items-center gap-1 p-1"
            style={{ background: "transparent", border: "none", cursor: "pointer", width: 88 }}
            data-testid={testId}
        >
            <div
                className="w95-bevel flex items-center justify-center"
                style={{ width: 48, height: 48, background: color, fontSize: 28, color: "#000" }}
                aria-hidden
            >
                <span className="font-pixel">{glyph}</span>
            </div>
            <span
                className="font-pixel text-center"
                style={{
                    color: "#fff", fontSize: 10,
                    textShadow: "1px 1px 0 #000",
                    lineHeight: 1.1, padding: "1px 3px",
                }}
            >
                {label}
            </span>
        </button>
    );
}

function Clock() {
    const [t, setT] = useState(new Date());
    useEffect(() => {
        const i = setInterval(() => setT(new Date()), 1000 * 10);
        return () => clearInterval(i);
    }, []);
    return (
        <div
            className="w95-bevel-inset font-mono-retro px-2"
            style={{ background: "var(--w95-bg)", fontSize: 16, height: 26, display: "flex", alignItems: "center" }}
            data-testid="taskbar-clock"
        >
            {t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
    );
}

export default function Desktop({ user, onLogout }) {
    const mobile = useIsMobile();
    const [rooms, setRooms] = useState([]);
    const [activeRoom, setActiveRoom] = useState(null);
    const [openWindows, setOpenWindows] = useState({
        chat: true,
        jukebox: false,
        video: false,
        upload: false,
        profile: false,
        worlds: false,
        sprite: false,
        guestbook: false,
        spray: false,
        wall: false,
        youtube: false,
    });
    // Per-window focus nonce — incremented on every "open" request so that
    // clicking a desktop icon while the window is already open raises it
    // above any windows currently obscuring it.
    const [focusNonces, setFocusNonces] = useState({});
    const [currentAvatar, setCurrentAvatar] = useState(null);
    const [spriteId, setSpriteId] = useState("ghost_cute");
    const [animId, setAnimId] = useState(null);
    const [restStance, setRestStance] = useState("idle");
    const [startOpen, setStartOpen] = useState(false);

    // Spray config
    const [spraySelTag, setSpraySelTag] = useState("GOOD");
    const [sprayIsCustom, setSprayIsCustom] = useState(false);
    const [spraySize, setSpraySize] = useState(1.0);
    const [sprayActive, setSprayActive] = useState(false);

    // Auto-refresh hint for JukeboxWindow when a new audio/video uploads
    const [mediaRefreshNonce, setMediaRefreshNonce] = useState(0);

    // Bump every time user requests SprayWindow open — forces a fresh mount
    // even when the window state is already true (so the window pops to front).
    const [sprayOpenNonce, setSprayOpenNonce] = useState(0);
    const openSpray = () => {
        setOpenWindows((o) => ({ ...o, spray: true }));
        setSprayOpenNonce((n) => n + 1);
    };

    const navigate = useNavigate();
    const { roomId: urlRoomId } = useParams();

    useEffect(() => {
        listRooms()
            .then((rs) => {
                setRooms(rs);
                if (!activeRoom && rs.length) {
                    if (urlRoomId) {
                        const match = rs.find((r) => r.id === urlRoomId);
                        setActiveRoom(match || rs[0]);
                    } else {
                        setActiveRoom(rs[0]);
                    }
                }
            })
            .catch((error) => {
                console.error("[g00dweird] could not load rooms", error);
                toast.error("could not load worlds", {
                    description: error?.message || "backend unavailable",
                });
            });
        const savedAvatar = localStorage.getItem("gw_avatar");
        if (savedAvatar) {
            try { setCurrentAvatar(JSON.parse(savedAvatar)); } catch { /* ignore */ }
        }
        const savedSprite = localStorage.getItem("gw_sprite");
        if (savedSprite) setSpriteId(savedSprite);
        const savedAnim = localStorage.getItem("gw_anim");
        if (savedAnim) setAnimId(savedAnim);
        const savedStance = localStorage.getItem("gw_rest_stance");
        if (savedStance) setRestStance(savedStance);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (activeRoom) navigate(`/r/${activeRoom.id}`, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeRoom?.id]);

    const avatarUrl = currentAvatar ? fileUrl(currentAvatar.storage_path) : null;

    const socket = useChatSocket({
        user, room: activeRoom,
        avatarUrl, spriteId, animId,
    });

    useEffect(() => {
        if (!socket.connected || !animId) return;
        socket.send({ type: "stance", stance: restStance || "idle" });
    }, [animId, restStance, socket.connected]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggle = (key, val) => {
        setOpenWindows((o) => ({ ...o, [key]: val !== undefined ? val : !o[key] }));
        // Any open request (val=true OR a flip from false to true) bumps the
        // window's focus nonce so it pops above other open windows.
        if (val !== false) {
            setFocusNonces((n) => ({ ...n, [key]: (n[key] || 0) + 1 }));
        }
    };

    const pickRoom = (r) => {
        setActiveRoom(r);
        toggle("chat", true);
        // Auto-open the YouTube control window when entering the theatre room
        if (r?.theme === "inspiration-theatre") {
            setOpenWindows((o) => ({ ...o, youtube: true }));
        }
    };

    // Touch-swipe to switch rooms on mobile (left-swipe = next, right-swipe = prev)
    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        if (!rooms || rooms.length < 2) return undefined;
        let startX = null;
        let startY = null;
        let startTs = 0;
        const SWIPE_THRESHOLD = 80;   // px
        const VERT_GUARD = 60;        // ignore mostly-vertical swipes
        const MAX_DURATION = 700;     // ms

        const onStart = (e) => {
            if (e.touches.length !== 1) return;
            // Only swipe when the chat overlay handle is in the iso area
            const t = e.target;
            if (!(t && (t.closest('[data-testid="iso-world"]')))) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startTs = Date.now();
        };
        const onEnd = (e) => {
            if (startX === null) return;
            const touch = (e.changedTouches && e.changedTouches[0]) || null;
            if (!touch) { startX = null; return; }
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            const dt = Date.now() - startTs;
            startX = null;
            if (dt > MAX_DURATION) return;
            if (Math.abs(dy) > VERT_GUARD) return;
            if (Math.abs(dx) < SWIPE_THRESHOLD) return;
            if (!activeRoom) return;
            const idx = rooms.findIndex((r) => r.id === activeRoom.id);
            if (idx < 0) return;
            const next = dx < 0
                ? rooms[(idx + 1) % rooms.length]
                : rooms[(idx - 1 + rooms.length) % rooms.length];
            pickRoom(next);
        };
        window.addEventListener("touchstart", onStart, { passive: true });
        window.addEventListener("touchend", onEnd, { passive: true });
        return () => {
            window.removeEventListener("touchstart", onStart);
            window.removeEventListener("touchend", onEnd);
        };
    }, [rooms, activeRoom]); // eslint-disable-line react-hooks/exhaustive-deps

    const pickAvatar = (f) => {
        setCurrentAvatar(f);
        localStorage.setItem("gw_avatar", JSON.stringify(f));
    };

    const clearAvatar = () => {
        setCurrentAvatar(null);
        localStorage.removeItem("gw_avatar");
    };

    const pickSprite = (id) => {
        setRestStance("idle");
        setSpriteId(id);
        setAnimId(null);
        localStorage.setItem("gw_sprite", id);
        localStorage.removeItem("gw_anim");
        localStorage.setItem("gw_rest_stance", "idle");
        socket.send({ type: "stance", stance: "idle" });
        clearAvatar();
    };

    const pickAnim = (id) => {
        setAnimId(id);
        localStorage.setItem("gw_anim", id);
        socket.send({ type: "stance", stance: restStance || "idle" });
        clearAvatar();
    };

    const pickStance = (st) => {
        const stance = st || "idle";
        setRestStance(stance);
        localStorage.setItem("gw_rest_stance", stance);
        socket.send({ type: "stance", stance });
    };

    const onUploaded = (rec) => {
        if (rec.kind === "avatar") pickAvatar(rec);
        if (rec.kind === "banner") {
            toast.success("banner added to profile", { description: rec.original_filename });
        }
        if (rec.kind === "audio" || rec.kind === "video") {
            setMediaRefreshNonce((n) => n + 1);
            // Auto-open the relevant Jukebox window if it isn't already open
            if (rec.kind === "audio") setOpenWindows((w) => ({ ...w, jukebox: true }));
            if (rec.kind === "video") setOpenWindows((w) => ({ ...w, video: true }));
            toast.success(`${rec.kind} added to library`, { description: rec.original_filename });
        }
    };

    const copyInvite = async () => {
        if (!activeRoom) return;
        const url = `${window.location.origin}/r/${activeRoom.id}`;
        try {
            await navigator.clipboard.writeText(url);
            toast.success("invite link copied", { description: url });
        } catch {
            toast.message("copy failed — select+copy manually", { description: url });
        }
    };

    // Spray handlers
    const placeTag = (x, y) => {
        const rot = (Math.random() * 30 - 15);
        socket.send({
            type: "tag_spray",
            room_id: activeRoom?.id,
            tag: spraySelTag,
            custom: sprayIsCustom,
            x, y, rot,
            scale: spraySize,
        });
    };

    const clearAllTags = async () => {
        if (!activeRoom) return;
        socket.send({ type: "tag_clear", room_id: activeRoom.id });
        try {
            await api.delete(`/rooms/${activeRoom.id}/tags`);
        } catch { /* ignore */ }
    };

    const spray = {
        active: sprayActive,
        tag: spraySelTag,
        custom: sprayIsCustom,
        size: spraySize,
    };

    const taskbarWindows = useMemo(() => {
        const entries = [];
        if (openWindows.chat && activeRoom) entries.push({ key: "chat", label: `Chat - ${activeRoom.name}` });
        if (openWindows.jukebox) entries.push({ key: "jukebox", label: "Jukebox.exe" });
        if (openWindows.video) entries.push({ key: "video", label: "VideoWall.exe" });
        if (openWindows.upload) entries.push({ key: "upload", label: "UploadZone.exe" });
        if (openWindows.profile) entries.push({ key: "profile", label: "My Profile" });
        if (openWindows.worlds) entries.push({ key: "worlds", label: "Worlds.exe" });
        if (openWindows.sprite) entries.push({ key: "sprite", label: "SpritePicker" });
        if (openWindows.guestbook) entries.push({ key: "guestbook", label: "Guestbook" });
        if (openWindows.spray) entries.push({ key: "spray", label: "SprayTool" });
        if (openWindows.wall) entries.push({ key: "wall", label: "WALL" });
        if (openWindows.youtube) entries.push({ key: "youtube", label: "Theatre" });
        return entries;
    }, [openWindows, activeRoom]);

    return (
        <div
            className="fixed inset-0 desktop-wallpaper overflow-hidden"
            data-testid="desktop"
            onClick={() => startOpen && setStartOpen(false)}
        >
            <div className="scanlines crt-flicker" aria-hidden="true" />

            <div
                className="absolute top-2 left-2 flex flex-col gap-2"
                style={{ width: 96, display: mobile ? "none" : "flex" }}
            >
                <DesktopIcon testId="icon-chat" label="Chat Room" glyph="⌨" color="#ffff00" onDoubleClick={() => toggle("chat", true)} />
                <DesktopIcon testId="icon-worlds" label="Worlds" glyph="◈" color="#ff00ff" onDoubleClick={() => toggle("worlds", true)} />
                <DesktopIcon testId="icon-sprite" label="Sprites" glyph="☻" color="#b3ff00" onDoubleClick={() => toggle("sprite", true)} />
                <DesktopIcon testId="icon-spray" label="SprayTool" glyph="※" color="#ff8844" onDoubleClick={openSpray} />
                <DesktopIcon testId="icon-wall" label="WALL" glyph="▥" color="#b24dff" onDoubleClick={() => toggle("wall", true)} />
                <DesktopIcon testId="icon-jukebox" label="Jukebox" glyph="♪" color="#00ffff" onDoubleClick={() => toggle("jukebox", true)} />
                <DesktopIcon testId="icon-video" label="Video Wall" glyph="▶" color="#ff8844" onDoubleClick={() => toggle("video", true)} />
                <DesktopIcon testId="icon-youtube" label="Theatre" glyph="▶" color="#ff0033" onDoubleClick={() => toggle("youtube", true)} />
                <DesktopIcon testId="icon-upload" label="UploadZone" glyph="⇪" color="#ff6ec7" onDoubleClick={() => toggle("upload", true)} />
                <DesktopIcon testId="icon-profile" label="My Profile" glyph="☻" color="#ffffff" onDoubleClick={() => toggle("profile", true)} />
                <DesktopIcon testId="icon-guestbook" label="Guestbook" glyph="✎" color="#ffee55" onDoubleClick={() => toggle("guestbook", true)} />
            </div>

            <div
                className="absolute top-2 right-2 w95-bevel-inset px-2 py-0.5 font-pixel"
                style={{
                    background: "#000", color: "#0f0", fontSize: 10,
                    maxWidth: mobile ? 180 : 360,
                    display: mobile ? "none" : "block",
                }}
            >
                <span className="blink">◉</span> g00dweird.net ~ logged in as{" "}
                <span style={{ color: "#ff00ff" }}>{user.nickname}</span>
            </div>

            {activeRoom && openWindows.chat && (
                <ChatWindow
                    user={user}
                    room={activeRoom}
                    users={socket.users}
                    messages={socket.messages}
                    connected={socket.connected}
                    typingUsers={socket.typingUsers}
                    tags={socket.tags}
                    basketballShots={socket.basketballShots}
                    spray={spray}
                    onPlaceTag={placeTag}
                    send={socket.send}
                    onClose={() => toggle("chat", false)}
                    onOpenJukebox={() => toggle("jukebox", true)}
                    onOpenVideo={() => toggle("video", true)}
                    onOpenSprite={() => toggle("sprite", true)}
                    onOpenSpray={openSpray}
                    onOpenWorlds={() => toggle("worlds", true)}
                    onCopyInvite={copyInvite}
                    youtubeTrack={socket.currentYoutube}
                    restStance={restStance}
                    initialX={mobile ? 0 : 120}
                    initialY={mobile ? 0 : 40}
                    requestFocus={focusNonces.chat || 0}
                />
            )}

            {openWindows.youtube && activeRoom && (
                <YouTubeWindow
                    user={user}
                    currentYoutube={socket.currentYoutube}
                    youtubeQueue={socket.youtubeQueue}
                    sendWS={socket.send}
                    onClose={() => toggle("youtube", false)}
                    initialX={300}
                    initialY={200}
                    requestFocus={focusNonces.youtube || 0}
                />
            )}

            {openWindows.jukebox && activeRoom && (
                <JukeboxWindow kind="audio" user={user} currentTrack={socket.currentAudio}
                    queue={socket.audioQueue} sendWS={socket.send}
                    refreshNonce={mediaRefreshNonce}
                    onClose={() => toggle("jukebox", false)} initialX={480} initialY={80}
                    requestFocus={focusNonces.jukebox || 0} />
            )}

            {openWindows.video && activeRoom && (
                <JukeboxWindow kind="video" user={user} currentTrack={socket.currentVideo}
                    queue={socket.videoQueue} sendWS={socket.send}
                    refreshNonce={mediaRefreshNonce}
                    onClose={() => toggle("video", false)} initialX={520} initialY={140}
                    requestFocus={focusNonces.video || 0} />
            )}

            {openWindows.upload && (
                <UploadDialog user={user} onClose={() => toggle("upload", false)}
                    onUploaded={onUploaded} initialX={220} initialY={160}
                    requestFocus={focusNonces.upload || 0} />
            )}

            {openWindows.profile && (
                <ProfileWindow user={user} currentAvatar={currentAvatar}
                    onPickAvatar={pickAvatar}
                    onClose={() => toggle("profile", false)}
                    onOpenUpload={() => toggle("upload", true)}
                    onOpenSprites={() => toggle("sprite", true)}
                    initialX={300} initialY={180}
                    requestFocus={focusNonces.profile || 0} />
            )}

            {openWindows.worlds && (
                <WorldPicker rooms={rooms} activeRoomId={activeRoom?.id}
                    onPick={pickRoom}
                    onClose={() => toggle("worlds", false)}
                    initialX={typeof window !== "undefined" ? Math.max(120, window.innerWidth - 400) : 900}
                    initialY={80}
                    requestFocus={focusNonces.worlds || 0} />
            )}

            {openWindows.sprite && (
                <SpritePicker
                    selectedSpriteId={currentAvatar ? null : spriteId}
                    animId={animId}
                    animStance={restStance}
                    onPickSprite={pickSprite}
                    onPickAnim={pickAnim}
                    onPickStance={pickStance}
                    onClearCustom={() => { clearAvatar(); }}
                    onClose={() => toggle("sprite", false)}
                    initialX={260} initialY={140}
                    requestFocus={focusNonces.sprite || 0}
                />
            )}

            {openWindows.guestbook && (
                <GuestbookWindow user={user}
                    onClose={() => toggle("guestbook", false)}
                    initialX={240} initialY={120}
                    requestFocus={focusNonces.guestbook || 0} />
            )}

            {openWindows.spray && (
                <SprayWindow
                    key={sprayOpenNonce}
                    active={sprayActive}
                    onToggleActive={() => setSprayActive((s) => !s)}
                    selectedTag={spraySelTag}
                    isCustom={sprayIsCustom}
                    customText={sprayIsCustom ? spraySelTag : ""}
                    onPickPreset={(w) => { setSpraySelTag(w); setSprayIsCustom(false); }}
                    onSetCustom={(t) => { setSpraySelTag(t); setSprayIsCustom(true); }}
                    tagSize={spraySize}
                    onSetSize={setSpraySize}
                    onClearAll={clearAllTags}
                    onClose={() => toggle("spray", false)}
                    initialX={mobile ? 0 : 340}
                    initialY={mobile ? 0 : 100}
                    requestFocus={focusNonces.spray || 0}
                />
            )}

            {openWindows.wall && (
                <WallExeWindow
                    user={user}
                    users={socket.users}
                    onClose={() => toggle("wall", false)}
                    initialX={mobile ? 0 : 88}
                    initialY={mobile ? 0 : 58}
                    requestFocus={focusNonces.wall || 0}
                />
            )}

            {startOpen && (
                <div
                    className="absolute w95-bevel"
                    style={{ bottom: 34, left: 2, width: 220, zIndex: 99997, padding: 2 }}
                    data-testid="start-menu"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        className="absolute left-0 top-0 bottom-0"
                        style={{
                            width: 26,
                            background: "linear-gradient(180deg,#000080,#1084d0)",
                            writingMode: "vertical-rl",
                            transform: "rotate(180deg)", color: "#fff",
                        }}
                    >
                        <span className="font-pixel px-1" style={{ fontSize: 12 }}>
                            g00dweird 95
                        </span>
                    </div>
                    <div style={{ marginLeft: 26 }}>
                        <StartItem label="Chat Room" onClick={() => { toggle("chat", true); setStartOpen(false); }} testId="start-chat" />
                        <StartItem label="Worlds" onClick={() => { toggle("worlds", true); setStartOpen(false); }} testId="start-worlds" />
                        <StartItem label="Sprites" onClick={() => { toggle("sprite", true); setStartOpen(false); }} testId="start-sprite" />
                        <StartItem label="Spray Tool" onClick={() => { openSpray(); setStartOpen(false); }} testId="start-spray" />
                        <StartItem label="WALL" onClick={() => { toggle("wall", true); setStartOpen(false); }} testId="start-wall" />
                        <StartItem label="Jukebox" onClick={() => { toggle("jukebox", true); setStartOpen(false); }} testId="start-jukebox" />
                        <StartItem label="Video Wall" onClick={() => { toggle("video", true); setStartOpen(false); }} testId="start-video" />
                        <StartItem label="Upload Zone" onClick={() => { toggle("upload", true); setStartOpen(false); }} testId="start-upload" />
                        <StartItem label="My Profile" onClick={() => { toggle("profile", true); setStartOpen(false); }} testId="start-profile" />
                        <StartItem label="Guestbook" onClick={() => { toggle("guestbook", true); setStartOpen(false); }} testId="start-guestbook" />
                        <div style={{ borderTop: "1px solid #808080", margin: "4px 0" }} />
                        <StartItem label="Log off..." onClick={onLogout} testId="start-logoff" />
                    </div>
                </div>
            )}

            <div
                className="absolute bottom-0 left-0 right-0 w95-bevel flex items-center gap-1 px-1"
                style={{ height: 34, zIndex: 99996 }}
                data-testid="taskbar"
            >
                <button
                    className={`w95-button flex items-center gap-1 ${startOpen ? "active" : ""}`}
                    onClick={(e) => { e.stopPropagation(); setStartOpen((s) => !s); }}
                    style={{ height: 26, padding: "0 8px" }}
                    data-testid="start-button"
                >
                    <span aria-hidden style={{
                        display: "inline-block", width: 14, height: 14,
                        background: "conic-gradient(from 0deg, #ff0000 0 90deg, #00ff00 90deg 180deg, #0000ff 180deg 270deg, #ffff00 270deg 360deg)",
                    }} />
                    <span className="font-pixel" style={{ fontSize: 12 }}>Start</span>
                </button>

                <div style={{ width: 2, height: 24, background: "#808080", borderRight: "1px solid #fff", margin: "0 4px" }} />

                <div className="flex gap-1 flex-1 overflow-hidden">
                    {taskbarWindows.map((w) => (
                        <button
                            key={w.key} className="w95-button truncate"
                            onClick={() => toggle(w.key, true)}
                            style={{ height: 26, maxWidth: 180, padding: "0 8px" }}
                            data-testid={`taskbar-${w.key}`}
                        >
                            <span className="font-mono-retro truncate" style={{ fontSize: 14 }}>
                                {w.label}
                            </span>
                        </button>
                    ))}
                </div>

                {(socket.currentAudio || socket.currentVideo) && (
                    <div className="w95-bevel-inset px-2 font-mono-retro"
                        style={{ fontSize: 14, height: 26, display: "flex", alignItems: "center", background: "#000", color: "#0f0", maxWidth: 260 }}
                    >
                        <span className="blink" style={{ color: "#ff00ff", marginRight: 4 }}>♪</span>
                        <span className="truncate">
                            {(socket.currentAudio?.title || socket.currentVideo?.title) || ""}
                        </span>
                    </div>
                )}
                <Clock />
            </div>
        </div>
    );
}

function StartItem({ label, onClick, testId }) {
    return (
        <button
            onClick={onClick}
            className="font-mono-retro w-full text-left px-2 py-1"
            style={{ fontSize: 18, background: "transparent", border: "none" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#000080"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#000"; }}
            data-testid={testId}
        >
            {label}
        </button>
    );
}
