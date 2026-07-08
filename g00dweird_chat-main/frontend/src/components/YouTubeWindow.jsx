import React, { useState } from "react";
import Win95Window from "./Win95Window";
import { parseYouTubeId } from "../lib/youtube";

/**
 * YouTube Theatre control window — paste links, queue them, play now, skip, clear.
 * Communal: every action is a WS broadcast so all room members see the same player.
 */
export default function YouTubeWindow({
    user,
    currentYoutube,
    youtubeQueue = [],
    sendWS,
    onClose,
    initialX = 220,
    initialY = 180,
    requestFocus = 0,
}) {
    const [input, setInput] = useState("");
    const [titleHint, setTitleHint] = useState("");
    const [error, setError] = useState("");

    const submitLink = (type) => {
        const vid = parseYouTubeId(input);
        if (!vid) {
            setError("Paste a YouTube link, Shorts link, or 11-character video ID.");
            return false;
        }
        sendWS({ type, video_id: vid, title: titleHint.trim() || vid });
        setInput("");
        setTitleHint("");
        setError("");
        return true;
    };

    const enqueue = (e) => {
        e?.preventDefault?.();
        submitLink("youtube_enqueue");
    };

    const playNow = (e) => {
        e?.preventDefault?.();
        submitLink("youtube_play");
    };

    const submitDefault = (e) => {
        e.preventDefault();
        submitLink(currentYoutube ? "youtube_enqueue" : "youtube_play");
    };

    const skip = () => sendWS({ type: "youtube_next" });
    const stop = () => sendWS({ type: "youtube_stop" });
    const clear = () => sendWS({ type: "youtube_clear" });

    return (
        <Win95Window
            title="g00dweird Theatre Queue"
            testId="youtube-window"
            initialX={initialX}
            initialY={initialY}
            width={460}
            height={460}
            onClose={onClose}
            requestFocus={requestFocus}
            icon={<span style={{ color: "#ff0033" }}>▶</span>}
        >
            <div className="flex flex-col h-full p-2 gap-2" style={{ background: "var(--w95-bg)" }}>
                <div
                    className="w95-bevel-inset px-2 py-1 font-mono-retro"
                    style={{ background: "#000", color: "#0f0", fontSize: 14 }}
                    data-testid="yt-now-playing"
                >
                    <div className="font-pixel" style={{ fontSize: 10, color: "#ff00ff" }}>
                        NOW PLAYING ◉ YOUTUBE
                    </div>
                    {currentYoutube ? (
                        <div className="marquee">
                            <span className="marquee-inner">
                                ▶ {currentYoutube.title} — by {currentYoutube.by} ▶
                            </span>
                        </div>
                    ) : (
                        <div className="blink" style={{ color: "#7fff7f" }}>
                            -- screen idle --
                        </div>
                    )}
                </div>

                <form
                    onSubmit={submitDefault}
                    className="flex flex-col gap-1 w95-bevel-inset p-2"
                    data-testid="yt-form"
                >
                    <input
                        className="w95-input"
                        placeholder="Paste YouTube URL, Shorts link, or video ID"
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            if (error) setError("");
                        }}
                        data-testid="yt-input"
                    />
                    <input
                        className="w95-input"
                        placeholder="optional title"
                        value={titleHint}
                        onChange={(e) => setTitleHint(e.target.value)}
                        data-testid="yt-title-input"
                    />
                    {error && (
                        <div
                            className="font-mono-retro"
                            style={{ color: "#b00020", fontSize: 14 }}
                            data-testid="yt-error"
                        >
                            {error}
                        </div>
                    )}
                    <div className="flex gap-1">
                        <button
                            className="w95-button"
                            type="button"
                            onClick={playNow}
                            data-testid="yt-play-now"
                        >
                            ▶ Play for Room
                        </button>
                        <button
                            className="w95-button"
                            type="button"
                            onClick={enqueue}
                            data-testid="yt-enqueue"
                        >
                            + Queue
                        </button>
                        <button
                            className="w95-button"
                            type="button"
                            onClick={skip}
                            data-testid="yt-skip"
                            title="skip to next in queue"
                        >
                            ▶▶ Skip
                        </button>
                        <button
                            className="w95-button"
                            type="button"
                            onClick={stop}
                            data-testid="yt-stop"
                        >
                            Stop
                        </button>
                    </div>
                </form>

                <div className="w95-bevel-inset" style={{ background: "#fff", flex: 1, overflow: "auto" }} data-testid="yt-queue">
                    <div
                        className="font-pixel px-2 py-0.5 sticky top-0 flex items-center justify-between"
                        style={{ background: "#000080", color: "#fff", fontSize: 10 }}
                    >
                        QUEUE [{youtubeQueue.length}]
                        <button
                            className="w95-button"
                            style={{ padding: "0 6px", fontSize: 10 }}
                            onClick={clear}
                            data-testid="yt-clear"
                        >
                            clear
                        </button>
                    </div>
                    {youtubeQueue.length === 0 ? (
                        <div className="px-2 py-1 font-mono-retro" style={{ fontSize: 14, color: "#666" }}>
                            empty. paste a link above, then press Enter or Play for Room.
                        </div>
                    ) : (
                        <ul>
                            {youtubeQueue.map((q, i) => (
                                <li
                                    key={`${q.video_id}-${i}`}
                                    className="px-2 py-0.5 font-mono-retro"
                                    style={{ fontSize: 14, borderBottom: "1px dashed #999" }}
                                    data-testid="yt-queue-item"
                                >
                                    {i + 1}. {q.title}{" "}
                                    <span style={{ color: "#666" }}>— {q.by}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="font-pixel" style={{ fontSize: 9, color: "#555" }}>
                    everyone in the theatre sees + hears the same video. enter the
                    <em> Inspiration Theatre </em> world to view the screen.
                </div>
            </div>
        </Win95Window>
    );
}
