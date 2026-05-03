import React, { useEffect, useState } from "react";
import Win95Window from "./Win95Window";
import { api } from "../lib/api";

const GUESTBOOK_PREVIEW_KEY = "gw_guestbook_preview_v1";
const REQUEST_TIMEOUT_MS = 7000;

function normalizeGuestbookEntry(raw) {
    if (!raw || typeof raw !== "object") return null;
    return {
        id: String(raw.id || `preview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
        user_id: String(raw.user_id || raw.userId || ""),
        nickname: String(raw.nickname || raw.name || "ANONYMOUS").trim().slice(0, 60) || "ANONYMOUS",
        message: String(raw.message || "").slice(0, 400),
        created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
    };
}

function getCachedGuestbookEntries() {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(GUESTBOOK_PREVIEW_KEY);
        const parsed = JSON.parse(raw || "[]");
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map(normalizeGuestbookEntry)
            .filter(Boolean)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch {
        return [];
    }
}

function setCachedGuestbookEntries(entries) {
    if (typeof window === "undefined") return;
    try {
        const deduped = [...entries].slice(0, 80);
        window.localStorage.setItem(GUESTBOOK_PREVIEW_KEY, JSON.stringify(deduped));
    } catch {
        // localStorage is optional; continue with in-memory mode if unavailable
    }
}

function formatDate(value) {
    const parsed = new Date(value || 0);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleString();
}

function createEntry(user, message) {
    return {
        id: `preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        user_id: String(user?.user_id || ""),
        nickname: String(user?.nickname || "ANONYMOUS").trim().slice(0, 60) || "ANONYMOUS",
        message: message.trim().slice(0, 400),
        created_at: new Date().toISOString(),
    };
}

function isOfflineError(error) {
    return !error?.response;
}

export default function GuestbookWindow({ user, onClose, initialX = 240, initialY = 120, requestFocus = 0 }) {
    const [entries, setEntries] = useState([]);
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const [posting, setPosting] = useState(false);
    const [err, setErr] = useState("");

    const load = async () => {
        setLoading(true);
        setErr("");
        try {
            const { data } = await api.get("/guestbook", { timeout: REQUEST_TIMEOUT_MS });
            const normalized = Array.isArray(data) ? data.map(normalizeGuestbookEntry).filter(Boolean) : [];
            setEntries(normalized);
            setCachedGuestbookEntries(normalized);
        } catch (error) {
            const cached = getCachedGuestbookEntries();
            setEntries(cached);
            if (isOfflineError(error)) {
                setErr("backend offline — using local guestbook cache");
            } else {
                setErr(error?.response?.data?.detail || "couldn't load guestbook");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const submit = async (e) => {
        e.preventDefault();
        const m = msg.trim();
        if (!m) return;
        if (!user?.user_id || !user?.nickname) {
            setErr("sign in before signing the guestbook");
            return;
        }
        setPosting(true);
        setErr("");
        const localEntry = createEntry(user, m);
        try {
            const { data } = await api.post("/guestbook", {
                user_id: user.user_id,
                nickname: user.nickname,
                message: m,
            }, { timeout: REQUEST_TIMEOUT_MS });
            const entry = normalizeGuestbookEntry(data) || localEntry;
            const next = [entry, ...entries].filter(Boolean);
            setEntries(next);
            setCachedGuestbookEntries(next);
            setMsg("");
            setErr("");
        } catch (e) {
            if (isOfflineError(e)) {
                const next = [localEntry, ...entries];
                setEntries(next);
                setCachedGuestbookEntries(next);
                setErr("backend offline — saved to local guestbook cache");
                setMsg("");
            } else {
                setErr(e?.response?.data?.detail || "post failed");
            }
        } finally {
            setPosting(false);
        }
    };

    return (
        <Win95Window
            title="Guestbook.html"
            testId="guestbook-window"
            initialX={initialX}
            initialY={initialY}
            width={520}
            height={560}
            onClose={onClose}
            requestFocus={requestFocus}
            icon={<span style={{ color: "#ff00ff" }}>✎</span>}
        >
            <div
                className="flex flex-col h-full p-2 gap-2"
                style={{ background: "var(--w95-bg)" }}
            >
                <div
                    className="w95-bevel-inset px-2 py-1 marquee"
                    style={{ background: "#000", color: "#0f0", fontSize: 14 }}
                >
                    <span className="marquee-inner">
                        ※ g00dweird.com/guestbook ※ leave a weird note for the
                        next wanderer ※ signed with ink that never dries ※
                    </span>
                </div>

                <form
                    onSubmit={submit}
                    className="flex flex-col gap-2 w95-bevel-inset p-2"
                    data-testid="guestbook-form"
                    style={{ background: "#fff" }}
                >
                    <div className="font-mono-retro" style={{ fontSize: 18 }}>
                        signing as{" "}
                        <span
                            className="font-pixel"
                            style={{ color: "#aa0088", fontSize: 12 }}
                        >
                            {user?.nickname || "ANONYMOUS"}
                        </span>
                    </div>
                    <textarea
                        className="w95-input"
                        style={{ minHeight: 60, fontSize: 18 }}
                        value={msg}
                        onChange={(e) => setMsg(e.target.value)}
                        maxLength={400}
                        placeholder="write something weird, specific, and true..."
                        data-testid="guestbook-input"
                    />
                    {err && (
                        <div className="font-mono-retro" style={{ color: "#a00" }}>
                            ! {err}
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <button
                            type="submit"
                            className="w95-button"
                            disabled={posting}
                            data-testid="guestbook-submit"
                        >
                            {posting ? "signing..." : "Sign Book"}
                        </button>
                    </div>
                </form>

                <div
                    className="w95-bevel-inset flex-1 p-2"
                    style={{ overflow: "auto", background: "#fff" }}
                    data-testid="guestbook-entries"
                >
                    {loading && <div className="font-mono-retro">loading...</div>}
                    {!loading && entries.length === 0 && (
                        <div className="font-mono-retro" style={{ color: "#666" }}>
                            no signatures yet. be the first.
                        </div>
                    )}
                    {entries.map((e) => (
                        <div
                            key={e.id}
                            className="mb-3 pb-2"
                            style={{ borderBottom: "1px dashed #999" }}
                            data-testid="guestbook-entry"
                        >
                            <div
                                className="font-pixel"
                                style={{ fontSize: 11, color: "#000080" }}
                            >
                                ♞ {e.nickname}
                                <span
                                    className="font-mono-retro ml-2"
                                    style={{ fontSize: 14, color: "#666" }}
                                >
                                    {formatDate(e.created_at)}
                                </span>
                            </div>
                            <div
                                className="font-mono-retro"
                                style={{ fontSize: 18, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                            >
                                {e.message}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Win95Window>
    );
}
