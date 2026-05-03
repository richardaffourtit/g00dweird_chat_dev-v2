import React, { useState } from "react";
import { joinWithNickname } from "../lib/api";

export default function LoginDialog({ onJoin }) {
    const [nick, setNick] = useState("");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        const v = nick.trim();
        if (v.length < 2) {
            setErr("nickname too short (2-24)");
            return;
        }
        setLoading(true);
        setErr("");
        try {
            const data = await joinWithNickname(v);
            localStorage.setItem("gw_user", JSON.stringify(data));
            onJoin(data);
        } catch (e) {
            setErr(e?.response?.data?.detail || "could not log on");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 desktop-wallpaper flex items-center justify-center"
            data-testid="login-screen"
        >
            <div className="scanlines crt-flicker" aria-hidden="true" />
            {/* Boot / marquee */}
            <div className="absolute top-0 left-0 right-0 bsod-banner marquee">
                <span className="marquee-inner">
                    g00dweird.com ~ weirdnet boot sequence OK ~ please select an
                    identity ~ no packets were harmed ~ system time: invalid ~
                    all signals cursed ~ stay strange ~ g00dweird.com ~
                </span>
            </div>

            <form
                onSubmit={submit}
                className="w95-bevel relative"
                style={{ width: "min(420px, calc(100vw - 24px))", padding: 2 }}
                data-testid="login-dialog"
            >
                <div className="w95-titlebar">
                    <span className="flex items-center gap-2">
                        <span
                            className="inline-block"
                            style={{
                                width: 14,
                                height: 14,
                                background:
                                    "conic-gradient(from 0deg, #ff0000 0 90deg, #00ff00 90deg 180deg, #0000ff 180deg 270deg, #ffff00 270deg 360deg)",
                            }}
                        />
                        <span>Enter g00dweird.com</span>
                    </span>
                    <span className="w95-title-btn" aria-hidden>
                        ?
                    </span>
                </div>
                <div className="p-4 flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                        <div
                            className="w95-bevel-inset"
                            style={{
                                width: 48,
                                height: 48,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 32,
                                background: "#fff",
                                color: "#000080",
                            }}
                        >
                            <span className="font-pixel">@</span>
                        </div>
                        <div className="flex-1">
                            <p className="font-mono-retro" style={{ fontSize: 20, lineHeight: 1.1 }}>
                                Welcome weirdo. pick a handle to log on to the
                                chatroom.
                            </p>
                            <p className="text-sm" style={{ color: "#555" }}>
                                (no password. strange by design.)
                            </p>
                        </div>
                    </div>

                    <label className="flex items-center gap-2">
                        <span
                            className="font-pixel"
                            style={{ width: 90, fontSize: 12 }}
                        >
                            Nickname:
                        </span>
                        <input
                            data-testid="nickname-input"
                            className="w95-input flex-1"
                            value={nick}
                            onChange={(e) => setNick(e.target.value)}
                            maxLength={24}
                            placeholder="e.g. h4xx0r_ghost"
                            autoFocus
                        />
                    </label>

                    {err && (
                        <div
                            className="w95-bevel-inset px-2 py-1"
                            style={{ color: "#aa0000", fontSize: 16 }}
                            data-testid="login-error"
                        >
                            ! {err}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="submit"
                            className="w95-button"
                            disabled={loading}
                            data-testid="login-submit"
                            style={{ minWidth: 90 }}
                        >
                            {loading ? "connecting..." : "OK"}
                        </button>
                        <button
                            type="button"
                            className="w95-button"
                            onClick={() => setNick("")}
                            data-testid="login-clear"
                            style={{ minWidth: 90 }}
                        >
                            Clear
                        </button>
                    </div>
                </div>
            </form>

            <div
                className="absolute bottom-10 left-4 right-4 text-center font-pixel"
                style={{ color: "#fff", textShadow: "1px 1px 0 #000", fontSize: 10 }}
            >
                <span className="blink">&#9632;</span> g00dweird.com &middot; strange iso worlds since 1995 &middot;
                <span className="blink">&#9632;</span>
            </div>
        </div>
    );
}
