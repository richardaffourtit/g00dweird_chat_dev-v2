import React, { useEffect, useRef, useState } from "react";
import Win95Window from "./Win95Window";
import { getRecentMedia, fileUrl } from "../lib/api";

export default function JukeboxWindow({
    kind, // "audio" | "video"
    user,
    currentTrack,
    queue = [],
    sendWS,
    refreshNonce = 0,
    onClose,
    initialX = 120,
    initialY = 120,
    requestFocus = 0,
}) {
    const [library, setLibrary] = useState([]);
    const [loading, setLoading] = useState(false);
    const [volume, setVolume] = useState(0.6);
    const [muted, setMuted] = useState(false);
    const mediaRef = useRef(null);
    const title = kind === "audio" ? "Jukebox.exe" : "VideoWall.exe";
    const icon =
        kind === "audio" ? (
            <span style={{ color: "#ff00ff" }}>♪</span>
        ) : (
            <span style={{ color: "#ff00ff" }}>▶</span>
        );

    const reload = async () => {
        setLoading(true);
        try {
            const data = await getRecentMedia(kind);
            setLibrary(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, refreshNonce]);

    // Auto play/update when currentTrack changes
    useEffect(() => {
        const el = mediaRef.current;
        if (!el) return;
        if (currentTrack && currentTrack.url) {
            try {
                if (el.src !== currentTrack.url) {
                    el.src = currentTrack.url;
                }
                const p = el.play();
                if (p && p.catch) p.catch(() => {});
            } catch { /* ignore */ }
        } else {
            try {
                el.pause();
                el.removeAttribute("src");
                el.load();
            } catch { /* ignore */ }
        }
    }, [currentTrack]);

    // Volume / mute apply to local element only
    useEffect(() => {
        const el = mediaRef.current;
        if (el) {
            el.volume = volume;
            el.muted = muted;
        }
    }, [volume, muted]);

    const play = (f) => {
        sendWS({
            type: "jukebox_play",
            kind,
            file_id: f.id,
            url: fileUrl(f.storage_path),
            title: f.original_filename,
            nickname: f.nickname,
        });
    };

    const enqueue = (f) => {
        sendWS({
            type: "jukebox_enqueue",
            kind,
            file_id: f.id,
            url: fileUrl(f.storage_path),
            title: f.original_filename,
            nickname: f.nickname,
        });
    };

    const stop = () => sendWS({ type: "jukebox_stop", kind });
    const next = () => sendWS({ type: "jukebox_next", kind });
    const clear = () => sendWS({ type: "jukebox_clear", kind });

    // Auto-advance when track ends (only the sender triggers advance — only ONE client should call this)
    // We rely on the uploader's client: whoever's nickname matches current track uploader advances.
    const onMediaEnded = () => {
        if (currentTrack && currentTrack.uploader === user.nickname) {
            sendWS({ type: "jukebox_next", kind });
        }
    };

    return (
        <Win95Window
            title={title}
            testId={kind === "audio" ? "jukebox-window" : "video-window"}
            icon={icon}
            initialX={initialX}
            initialY={initialY}
            width={kind === "audio" ? 460 : 560}
            height={kind === "audio" ? 520 : 600}
            onClose={onClose}
            requestFocus={requestFocus}
        >
            <div className="flex flex-col h-full" style={{ background: "var(--w95-bg)", padding: 6, gap: 6 }}>
                <div
                    className="w95-bevel-inset p-2 glow"
                    style={{ background: "#000", color: "#0f0" }}
                    data-testid="jukebox-now-playing"
                >
                    <div className="font-pixel" style={{ fontSize: 10, color: "#ff00ff" }}>
                        NOW PLAYING {kind === "audio" ? "◉ AUDIO" : "◉ VIDEO"}
                    </div>
                    {currentTrack ? (
                        <div className="font-mono-retro" style={{ fontSize: 18 }}>
                            <div className="marquee">
                                <span className="marquee-inner">
                                    ♪ {currentTrack.title} — by {currentTrack.uploader} ♪
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="font-mono-retro blink"
                            style={{ fontSize: 18, color: "#7fff7f" }}
                        >
                            -- silent --
                        </div>
                    )}
                </div>

                {kind === "audio" ? (
                    <audio
                        ref={mediaRef}
                        controls
                        className="w-full"
                        onEnded={onMediaEnded}
                        data-testid="jukebox-audio"
                    />
                ) : (
                    <video
                        ref={mediaRef}
                        controls
                        playsInline
                        className="w-full w95-bevel-inset"
                        style={{ background: "#000", maxHeight: 260 }}
                        onEnded={onMediaEnded}
                        data-testid="jukebox-video"
                    />
                )}

                {/* Controls row: volume + transport */}
                <div className="w95-bevel-inset p-2 flex items-center gap-2" style={{ background: "var(--w95-bg)" }}>
                    <button
                        className="w95-button"
                        onClick={() => setMuted((m) => !m)}
                        data-testid="jukebox-mute"
                        title="local mute"
                    >
                        {muted ? "🔇" : "🔊"}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        data-testid="jukebox-volume"
                        style={{ flex: 1 }}
                        aria-label="Volume"
                    />
                    <span className="font-mono-retro" style={{ fontSize: 14, width: 36, textAlign: "right" }}>
                        {Math.round(volume * 100)}%
                    </span>
                    <button className="w95-button" onClick={stop} data-testid="jukebox-stop">
                        Stop
                    </button>
                    <button className="w95-button" onClick={next} data-testid="jukebox-next">
                        Next ▶▶
                    </button>
                </div>

                {/* Queue */}
                <div className="w95-bevel-inset" style={{ background: "#fff", maxHeight: 120, overflow: "auto" }} data-testid="jukebox-queue">
                    <div
                        className="font-pixel px-2 py-0.5"
                        style={{ background: "#000080", color: "#fff", fontSize: 10, position: "sticky", top: 0 }}
                    >
                        QUEUE [{queue.length}]
                        <button
                            className="w95-button ml-2"
                            style={{ padding: "0 6px", fontSize: 10 }}
                            onClick={clear}
                            data-testid="jukebox-clear"
                        >
                            clear
                        </button>
                    </div>
                    {queue.length === 0 ? (
                        <div className="px-2 py-1 font-mono-retro" style={{ fontSize: 14, color: "#666" }}>
                            empty. enqueue tracks from library below.
                        </div>
                    ) : (
                        <ul>
                            {queue.map((t, i) => (
                                <li
                                    key={`${t.file_id}-${i}`}
                                    className="px-2 py-0.5 font-mono-retro"
                                    style={{ fontSize: 14, borderBottom: "1px dashed #999" }}
                                    data-testid="queue-item"
                                >
                                    {i + 1}. {t.title}{" "}
                                    <span style={{ color: "#666" }}>— {t.uploader}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Library */}
                <div className="flex items-center justify-between">
                    <div className="font-pixel" style={{ fontSize: 10 }}>
                        LIBRARY ({library.length})
                    </div>
                    <div className="flex gap-1">
                        <button className="w95-button" onClick={reload} data-testid="jukebox-refresh">
                            ↻
                        </button>
                    </div>
                </div>

                <div className="w95-bevel-inset flex-1" style={{ overflow: "auto", background: "#fff" }}>
                    {loading && <div className="p-2 font-mono-retro">loading...</div>}
                    {!loading && library.length === 0 && (
                        <div className="p-2 font-mono-retro" style={{ color: "#666" }}>
                            no {kind} uploaded yet. open UploadZone to add some.
                        </div>
                    )}
                    <ul data-testid="jukebox-library">
                        {library.map((f) => (
                            <li
                                key={f.id}
                                className="flex items-center justify-between px-2 py-1 font-mono-retro"
                                style={{ borderBottom: "1px dashed #999", fontSize: 16 }}
                                data-testid="jukebox-track"
                            >
                                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {kind === "audio" ? "♪ " : "▶ "}
                                    <strong>{f.original_filename}</strong>{" "}
                                    <span style={{ color: "#666", fontSize: 14 }}>
                                        by {f.nickname}
                                    </span>
                                </span>
                                <span className="flex gap-1">
                                    <button
                                        className="w95-button"
                                        onClick={() => enqueue(f)}
                                        data-testid="jukebox-enqueue"
                                        title="add to queue"
                                    >
                                        + Q
                                    </button>
                                    <button
                                        className="w95-button"
                                        onClick={() => play(f)}
                                        data-testid="jukebox-play"
                                    >
                                        Play
                                    </button>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="font-pixel" style={{ fontSize: 9, color: "#555" }}>
                    play = everyone hears now. + Q = queue for later.
                </div>
            </div>
        </Win95Window>
    );
}
