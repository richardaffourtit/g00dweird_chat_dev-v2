import React, { useEffect, useRef, useState } from "react";

/**
 * MST3K-style floating reaction particles. Detects emoji + short reactions in chat
 * messages and floats them up across the iso world for everyone in the room.
 *
 * Usage: drop <EmojiBurst messages={socket.messages} /> inside the iso-world stage.
 * messages is the chat-history array; this component reacts only to NEW messages
 * arriving after mount (and only the last few seconds' worth) so old history doesn't
 * spam particles on join.
 */

// Match emoji chars (BMP + supplementary planes). Keep it simple and compatible.
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2700}-\u{27BF}]/gu;

// Short text reactions get rendered as their own particle (capped to 8 chars)
const TEXT_REACTIONS = new Set([
    "lol", "lmao", "lmaoo", "omg", "wtf", "yo", "yes", "no", "fr", "fr fr",
    "based", "weird", "feels", "noted", "ok", "kek", "rofl", "bruh",
    "<3", "<33", ":3", ":)", ":(", ":d", ":p", ";)", ":o", ":'(",
    ">:3", "uwu", "owo", "✦", "❤", "💀",
]);

const PARTICLE_TTL_MS = 4500;
const PARTICLE_REAP_GRACE_MS = 250;

function extractParticles(text) {
    if (!text) return [];
    const out = [];
    // 1) all emoji glyphs (cap to first 6 per message to avoid spam)
    const emojis = (text.match(EMOJI_RE) || []).slice(0, 6);
    for (const e of emojis) out.push({ kind: "emoji", glyph: e });
    // 2) lowercased token: short reactions / "lol" etc
    const t = text.trim().toLowerCase();
    if (t.length > 0 && t.length <= 8 && TEXT_REACTIONS.has(t)) {
        out.push({ kind: "text", glyph: t });
    } else {
        // also match a single short reaction at the start: "lol that was wild"
        const head = t.split(/\s+/)[0];
        if (head && head.length <= 6 && TEXT_REACTIONS.has(head)) {
            out.push({ kind: "text", glyph: head });
        }
    }
    return out;
}

export default function EmojiBurst({ messages = [] }) {
    const [particles, setParticles] = useState([]);
    const seenRef = useRef(new Set()); // message ids we've already processed
    const mountedAtRef = useRef(Date.now());

    useEffect(() => {
        if (!Array.isArray(messages) || messages.length === 0) return;
        const fresh = [];
        for (const m of messages) {
            const id = m.id || `${m.ts}-${m.user_id}-${(m.text || "").slice(0, 16)}`;
            if (seenRef.current.has(id)) continue;
            // Skip messages older than mount (history replay) or older than 4s
            const ts = m.ts ? Date.parse(m.ts) : Date.now();
            if (ts < mountedAtRef.current - 4000) {
                seenRef.current.add(id);
                continue;
            }
            seenRef.current.add(id);
            const parts = extractParticles(m.text || "");
            for (const p of parts) {
                fresh.push({
                    ...p,
                    id: `${id}-${fresh.length}`,
                    x: 8 + Math.random() * 84,        // % from left
                    y: 90 + Math.random() * 6,         // % from top (start near bottom)
                    drift: (Math.random() - 0.5) * 22, // horizontal drift in vw
                    born: Date.now(),
                    rot: (Math.random() - 0.5) * 18,
                    rotEnd: (Math.random() - 0.5) * 10,
                    scale: p.kind === "emoji" ? 1 + Math.random() * 0.5 : 0.9,
                });
            }
        }
        if (fresh.length) setParticles((cur) => [...cur, ...fresh].slice(-60));
    }, [messages]);

    // Reap expired particles
    useEffect(() => {
        if (particles.length === 0) return undefined;
        const now = Date.now();
        const nextExpiry = Math.min(...particles.map((p) => p.born + PARTICLE_TTL_MS));
        const t = setTimeout(() => {
            setParticles((cur) => {
                const next = cur.filter((p) => Date.now() - p.born < PARTICLE_TTL_MS);
                return next.length === cur.length ? cur : next;
            });
        }, Math.max(80, nextExpiry - now + PARTICLE_REAP_GRACE_MS));
        return () => clearTimeout(t);
    }, [particles]);

    if (particles.length === 0) return null;
    return (
        <div
            data-testid="emoji-burst-layer"
            aria-hidden
            style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                overflow: "hidden",
                zIndex: 5,
            }}
        >
            {particles.map((p) => {
                return (
                    <span
                        key={p.id}
                        data-testid="emoji-burst-particle"
                        className="emoji-burst-particle"
                        style={{
                            position: "absolute",
                            left: `${p.x}%`,
                            top: `${p.y}%`,
                            "--emoji-x": `${p.x}%`,
                            "--emoji-y": `${p.y}%`,
                            "--emoji-drift": `${p.drift}vw`,
                            "--emoji-rise": "95vh",
                            "--emoji-rot-start": `${p.rot}deg`,
                            "--emoji-rot-end": `${p.rotEnd}deg`,
                            "--emoji-scale": p.scale,
                            "--emoji-duration": `${PARTICLE_TTL_MS}ms`,
                            fontSize: p.kind === "emoji" ? 36 : 18,
                            fontFamily: p.kind === "text" ? "Silkscreen, monospace" : undefined,
                            color: "#fff",
                            textShadow: "1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000",
                            whiteSpace: "nowrap",
                            userSelect: "none",
                        }}
                    >
                        {p.glyph}
                    </span>
                );
            })}
        </div>
    );
}
