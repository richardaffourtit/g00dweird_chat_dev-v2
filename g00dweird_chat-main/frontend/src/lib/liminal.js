import { useEffect, useMemo, useState } from "react";

export const LIMINAL_THEME = "liminal-backroom";

const PHANTOM_TYPERS = ["someone", "no one", "the room", "a previous you"];
const PHANTOM_LINES = [
    "did someone say that already?",
    "the room is typing with no hands",
    "message recalled before it arrived",
    "your cursor stood still and lied",
    "someone left a note under the wallpaper",
];

export function isLiminalRoom(room) {
    return room?.theme === LIMINAL_THEME || room?.id === LIMINAL_THEME;
}

export function hashString(value = "") {
    let h = 0;
    for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
    return Math.abs(h);
}

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

export function useLiminalNow(active, intervalMs = 3000) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) return undefined;
        const id = window.setInterval(() => setNow(Date.now()), intervalMs);
        return () => window.clearInterval(id);
    }, [active, intervalMs]);
    return active ? now : 0;
}

export function liminalDisplayName(name, seed, now) {
    const value = String(name || "");
    if (!value || !now) return value;

    const h = hashString(seed || value);
    const cycle = Math.floor(now / 7000);
    if ((h + cycle) % 17 !== 0) return value;

    const chars = value.split("");
    const index = (h + cycle) % chars.length;
    if (chars[index] === " ") return value.replace(" ", "  ");

    const lower = chars[index].toLowerCase();
    const substitutions = { a: "4", e: "3", i: "1", o: "0", s: "5", t: "+", b: "8" };
    chars[index] = substitutions[lower] || (
        chars[index] === lower ? chars[index].toUpperCase() : lower
    );
    return chars.join("");
}

export function liminalAvatarDrift(user, now, active) {
    if (!active || !now) return { x: 0, y: 0, opacity: 1, filter: undefined };
    const h = hashString(user?.user_id || user?.nickname || "");
    const macroCycle = Math.floor(now / 11000);
    const microCycle = Math.floor(now / 2600);
    const unsettled = (h + macroCycle) % 5 === 0;
    if (!unsettled) return { x: 0, y: 0, opacity: 1, filter: undefined };

    const x = (((h + microCycle * 3) % 5) - 2) * 0.8;
    const y = (((h + microCycle * 5) % 5) - 2) * 0.55;
    return {
        x,
        y,
        opacity: 0.86 + ((h + microCycle) % 4) * 0.03,
        filter: "drop-shadow(2px 2px 0 rgba(0,0,0,0.6)) blur(0.15px)",
    };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function liminalCornerShadow(x, y, active, width = 1000, height = 500) {
    if (!active) return { opacity: 1, filter: undefined, strength: 0 };

    const safeX = Number.isFinite(Number(x)) ? Number(x) : width / 2;
    const safeY = Number.isFinite(Number(y)) ? Number(y) : height / 2;
    const horizontalEdge = clamp(1 - Math.min(safeX, width - safeX) / 250, 0, 1);
    const verticalEdge = clamp(1 - Math.min(safeY, height - safeY) / 135, 0, 1);
    const strength = Math.pow(horizontalEdge * verticalEdge, 0.72);

    if (strength < 0.03) return { opacity: 1, filter: undefined, strength: 0 };

    const brightness = clamp(1 - strength * 0.46, 0.54, 1);
    const saturate = clamp(1 - strength * 0.22, 0.78, 1);
    const shadowAlpha = clamp(0.28 + strength * 0.48, 0.28, 0.76);

    return {
        opacity: clamp(1 - strength * 0.08, 0.92, 1),
        filter: `brightness(${brightness.toFixed(3)}) saturate(${saturate.toFixed(3)}) drop-shadow(3px 4px 0 rgba(0,0,0,${shadowAlpha.toFixed(2)}))`,
        strength,
    };
}

export function liminalOrderMessages(messages, now, active) {
    if (!active || !now || messages.length < 4) return messages;
    const arr = [...messages];
    const cycle = Math.floor(now / 9000);
    if (cycle % 11 !== 4) return arr;

    const swap = [];
    for (let i = arr.length - 1; i >= 0; i--) {
        const msg = arr[i];
        if (msg?.is_system || msg?.system || msg?.user_id === "system") continue;
        swap.push(i);
        if (swap.length === 2) break;
    }
    if (swap.length === 2) {
        const [a, b] = swap;
        [arr[a], arr[b]] = [arr[b], arr[a]];
    }
    return arr;
}

export function liminalMessageStyle(message, index, now, active) {
    if (!active || !now) return {};
    const id = message?.id || `${message?.user_id || "unknown"}-${message?.ts || index}`;
    const h = hashString(id);
    const cycle = Math.floor(now / 5000);
    const fading = message?.liminal_phantom || (h + cycle) % 19 === 0;
    const sliding = !message?.is_system && (h + cycle) % 23 === 0;
    return {
        opacity: message?.liminal_phantom ? 0.58 : fading ? 0.66 : 1,
        transform: sliding ? `translateX(${((h + cycle) % 3) - 1}px)` : undefined,
        filter: fading ? "blur(0.12px)" : undefined,
        transition: "opacity 900ms ease, transform 900ms ease, filter 900ms ease",
        fontStyle: message?.liminal_phantom ? "italic" : undefined,
    };
}

export function useLiminalPhantomTyping(active) {
    const [label, setLabel] = useState("");

    useEffect(() => {
        if (!active) {
            setLabel("");
            return undefined;
        }
        let alive = true;
        const timers = new Set();
        const schedule = (fn, ms) => {
            const id = window.setTimeout(() => {
                timers.delete(id);
                fn();
            }, ms);
            timers.add(id);
            return id;
        };
        const run = () => {
            if (!alive) return;
            setLabel(pick(PHANTOM_TYPERS));
            schedule(() => setLabel(""), 2600 + Math.random() * 1800);
            schedule(run, 52000 + Math.random() * 62000);
        };
        schedule(run, 9000 + Math.random() * 9000);
        return () => {
            alive = false;
            for (const timer of timers) window.clearTimeout(timer);
            timers.clear();
        };
    }, [active]);

    return label;
}

export function useLiminalPhantomMessage(active) {
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (!active) {
            setMessage(null);
            return undefined;
        }
        let alive = true;
        const timers = new Set();
        const schedule = (fn, ms) => {
            const id = window.setTimeout(() => {
                timers.delete(id);
                fn();
            }, ms);
            timers.add(id);
            return id;
        };
        const run = () => {
            if (!alive) return;
            const ts = new Date().toISOString();
            const phantom = {
                id: `liminal-phantom-${Date.now()}`,
                type: "chat",
                user_id: "liminal-phantom",
                nickname: "unknown",
                text: pick(PHANTOM_LINES),
                ts,
                liminal_phantom: true,
            };
            setMessage(phantom);
            schedule(() => setMessage(null), 8000 + Math.random() * 4000);
            schedule(run, 68000 + Math.random() * 74000);
        };
        schedule(run, 18000 + Math.random() * 12000);
        return () => {
            alive = false;
            for (const timer of timers) window.clearTimeout(timer);
            timers.clear();
        };
    }, [active]);

    return useMemo(() => message, [message]);
}
