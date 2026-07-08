import React, { useEffect, useRef, useState } from "react";
import { mediaUrlForElement, seekElementToTrackTime } from "../lib/mediaSync";

function applyLocalSettings(element, volume, muted) {
    if (!element) return;
    element.volume = Math.max(0, Math.min(1, Number(volume) || 0));
    element.muted = !!muted;
}

function useSyncedMediaPlayback({
    ref,
    kind,
    track,
    enabled = true,
    volume,
    muted,
    onBlocked,
    onUnblocked,
}) {
    useEffect(() => {
        applyLocalSettings(ref.current, volume, muted);
    }, [muted, ref, volume]);

    useEffect(() => {
        const element = ref.current;
        if (!element) return undefined;

        if (!enabled || !track?.url) {
            try {
                element.pause();
                element.removeAttribute("src");
                element.load();
            } catch {
                // noop
            }
            return undefined;
        }

        const desiredUrl = mediaUrlForElement(track.url);
        if (element.src !== desiredUrl) {
            element.src = track.url;
            element.load();
        }
        applyLocalSettings(element, volume, muted);

        const play = () => {
            seekElementToTrackTime(element, track);
            let promise;
            try {
                promise = element.play();
            } catch {
                onBlocked?.(kind);
                return;
            }
            if (promise && typeof promise.then === "function") {
                promise.then(() => onUnblocked?.(kind)).catch(() => onBlocked?.(kind));
            } else {
                onUnblocked?.(kind);
            }
        };

        const onLoadedMetadata = () => play();
        element.addEventListener("loadedmetadata", onLoadedMetadata);
        play();

        const driftTimer = window.setInterval(() => {
            seekElementToTrackTime(element, track);
            if (element.paused) play();
        }, 15000);

        return () => {
            window.clearInterval(driftTimer);
            element.removeEventListener("loadedmetadata", onLoadedMetadata);
        };
    }, [
        enabled,
        kind,
        muted,
        onBlocked,
        onUnblocked,
        ref,
        track,
        track?.started_at,
        track?.url,
        volume,
    ]);
}

export default function RoomMediaPlayers({
    user,
    currentAudio,
    currentVideo,
    sendWS,
    audioVolume = 0.6,
    audioMuted = false,
    videoVolume = 0.8,
    videoMuted = false,
    showVideoMonitor = true,
    onOpenVideo,
}) {
    const audioRef = useRef(null);
    const videoRef = useRef(null);
    const [blockedKind, setBlockedKind] = useState(null);

    const markBlocked = (kind) => setBlockedKind(kind);
    const markUnblocked = (kind) => {
        setBlockedKind((current) => (current === kind ? null : current));
    };

    useSyncedMediaPlayback({
        ref: audioRef,
        kind: "audio",
        track: currentAudio,
        volume: audioVolume,
        muted: audioMuted,
        onBlocked: markBlocked,
        onUnblocked: markUnblocked,
    });

    useSyncedMediaPlayback({
        ref: videoRef,
        kind: "video",
        track: currentVideo,
        enabled: showVideoMonitor,
        volume: videoVolume,
        muted: videoMuted,
        onBlocked: markBlocked,
        onUnblocked: markUnblocked,
    });

    const advanceIfOwner = (kind, track) => {
        if (track?.uploader && track.uploader === user?.nickname) {
            sendWS?.({ type: "jukebox_next", kind });
        }
    };

    const unlock = () => {
        [audioRef.current, videoRef.current].forEach((element) => {
            if (!element?.src) return;
            seekElementToTrackTime(element, element === audioRef.current ? currentAudio : currentVideo);
            try {
                const promise = element.play();
                if (promise?.catch) promise.catch(() => {});
            } catch {
                // noop
            }
        });
        setBlockedKind(null);
    };

    return (
        <>
            <audio
                ref={audioRef}
                data-testid="room-audio-player"
                preload="auto"
                onEnded={() => advanceIfOwner("audio", currentAudio)}
                style={{ display: "none" }}
            />

            {currentVideo && showVideoMonitor && (
                <div
                    className="w95-bevel"
                    data-testid="room-video-monitor"
                    style={{
                        position: "absolute",
                        right: 12,
                        bottom: 42,
                        width: "min(360px, calc(100vw - 24px))",
                        background: "var(--w95-bg)",
                        padding: 2,
                        zIndex: 8,
                    }}
                >
                    <div className="w95-titlebar" style={{ cursor: "default" }}>
                        <span className="truncate">Room Video</span>
                        {onOpenVideo && (
                            <button
                                type="button"
                                className="w95-title-btn"
                                onClick={onOpenVideo}
                                title="Open VideoWall"
                                data-testid="room-video-open"
                            >
                                ^
                            </button>
                        )}
                    </div>
                    <video
                        ref={videoRef}
                        controls
                        playsInline
                        preload="auto"
                        data-testid="room-video-player"
                        onEnded={() => advanceIfOwner("video", currentVideo)}
                        style={{
                            display: "block",
                            width: "100%",
                            maxHeight: 220,
                            background: "#000",
                        }}
                    />
                    <div
                        className="font-mono-retro truncate"
                        style={{ fontSize: 14, padding: "2px 4px", color: "#111" }}
                    >
                        {currentVideo.title || "room video"}
                    </div>
                </div>
            )}

            {blockedKind && (
                <button
                    type="button"
                    className="w95-button font-pixel"
                    onClick={unlock}
                    data-testid="room-media-unlock"
                    style={{
                        position: "absolute",
                        right: 12,
                        bottom: currentVideo && showVideoMonitor ? 300 : 42,
                        zIndex: 30,
                        fontSize: 10,
                        background: "#ffff99",
                    }}
                >
                    ENABLE ROOM {blockedKind.toUpperCase()}
                </button>
            )}
        </>
    );
}
