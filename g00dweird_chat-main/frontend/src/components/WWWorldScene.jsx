import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const WORLD_BG = "/worlds/wwworld.png";
const IMG_W = 1254;
const IMG_H = 1254;
const STAGE_W = 1000;
const STAGE_H = 500;

const FALLBACK_BROWSER_VIEWPORT = rectFromPixels(231, 262, 1022, 599);
const FALLBACK_ADDRESS_BAR = rectFromPixels(321, 224, 925, 252);
const GO_BUTTON = rectFromPixels(957, 219, 1024, 257);
const ADDRESS_INPUT_INSET = { left: 3, top: 2, right: 4, bottom: 2 };
const HISTORY_LIMIT = 30;
const KEY_REPEAT_DELAY_MS = 10000;
const KEY_REPEAT_INTERVAL_MS = 145;
const MAX_ADDRESS_CHARS = 320;

const TOOLBAR_BUTTONS = [
    { id: "back", label: "Back", rect: rectFromPixels(257, 151, 327, 217) },
    { id: "forward", label: "Forward", rect: rectFromPixels(335, 151, 417, 217) },
    { id: "stop", label: "Stop", rect: rectFromPixels(425, 151, 490, 217) },
    { id: "refresh", label: "Refresh", rect: rectFromPixels(506, 151, 582, 217) },
    { id: "home", label: "Home", rect: rectFromPixels(590, 151, 670, 217) },
    { id: "search", label: "Search", rect: rectFromPixels(680, 151, 762, 217) },
    { id: "favorites", label: "Favorites", rect: rectFromPixels(766, 151, 868, 217) },
    { id: "history", label: "History", rect: rectFromPixels(875, 151, 956, 217) },
];

const KEY_ZONES = [
    ...row("fn", 701, 58, [
        ["esc", 197, 68], ["f1", 307, 58], ["f2", 370, 58], ["f3", 433, 58], ["f4", 496, 58],
        ["f5", 581, 58], ["f6", 644, 58], ["f7", 707, 58], ["f8", 770, 58],
        ["f9", 845, 58], ["f10", 908, 58], ["f11", 971, 58], ["f12", 1034, 58],
    ]),
    ...row("number", 770, 62, [
        ["tilde", 123, 70], ["1", 197, 70], ["2", 271, 70], ["3", 345, 70], ["4", 419, 70],
        ["5", 493, 70], ["6", 567, 70], ["7", 641, 70], ["8", 715, 70], ["9", 789, 70],
        ["0", 863, 70], ["minus", 937, 70], ["plus", 1011, 70], ["backspace", 1085, 126],
    ]),
    ...row("qwerty", 835, 62, [
        ["tab", 99, 114], ["q", 217, 70], ["w", 291, 70], ["e", 365, 70], ["r", 439, 70],
        ["t", 513, 70], ["y", 587, 70], ["u", 661, 70], ["i", 735, 70], ["o", 809, 70],
        ["p", 883, 70], ["bracket_l", 957, 70], ["bracket_r", 1031, 70], ["slash_back", 1105, 88],
    ]),
    ...row("home", 899, 62, [
        ["caps", 82, 139], ["a", 225, 70], ["s", 299, 70], ["d", 373, 70], ["f", 447, 70],
        ["g", 521, 70], ["h", 595, 70], ["j", 669, 70], ["k", 743, 70], ["l", 817, 70],
        ["semicolon", 891, 70], ["quote", 965, 70], ["enter", 1039, 151],
    ]),
    ...row("shift", 963, 64, [
        ["shift_l", 66, 183], ["z", 253, 70], ["x", 327, 70], ["c", 401, 70], ["v", 475, 70],
        ["b", 549, 70], ["n", 623, 70], ["m", 697, 70], ["comma", 771, 70], ["period", 845, 70],
        ["question", 919, 70], ["shift_r", 1035, 158],
    ]),
    ...row("bottom", 1032, 66, [
        ["ctrl_l", 61, 110], ["meta_l", 175, 74], ["alt_l", 253, 101], ["space", 358, 465],
        ["alt_r", 827, 91], ["meta_r", 922, 102], ["green", 1052, 32], ["ctrl_r", 1109, 94],
    ]),
];

function rectFromPixels(x1, y1, x2, y2) {
    return {
        left: (x1 / IMG_W) * 100,
        top: (y1 / IMG_H) * 100,
        width: ((x2 - x1) / IMG_W) * 100,
        height: ((y2 - y1) / IMG_H) * 100,
    };
}

function insetRectByPixels(rect, inset) {
    const left = ((inset.left || 0) / IMG_W) * 100;
    const right = ((inset.right || 0) / IMG_W) * 100;
    const top = ((inset.top || 0) / IMG_H) * 100;
    const bottom = ((inset.bottom || 0) / IMG_H) * 100;
    return {
        left: rect.left + left,
        top: rect.top + top,
        width: Math.max(0, rect.width - left - right),
        height: Math.max(0, rect.height - top - bottom),
    };
}

function row(name, y, h, keys) {
    return keys.map(([id, x, w]) => ({
        id: `${name}-${id}`,
        ...rectFromPixels(x, y, x + w, y + h),
    }));
}

function findMaskRect(imageData, width, scan, predicate) {
    let minX = width;
    let minY = imageData.height || IMG_H;
    let maxX = 0;
    let maxY = 0;
    let count = 0;
    const data = imageData.data;
    for (let y = scan.top; y <= scan.bottom; y += 1) {
        for (let x = scan.left; x <= scan.right; x += 1) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (!predicate(r, g, b)) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            count += 1;
        }
    }
    if (count < 200) return null;
    return rectFromPixels(minX, minY, maxX + 1, maxY + 1);
}

function normalizeUrl(raw) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("/")) {
        return typeof window !== "undefined"
            ? `${window.location.origin}${trimmed}`
            : trimmed;
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

function defaultWWWorldUrl() {
    if (typeof window !== "undefined" && window.location?.origin) {
        return `${window.location.origin}/r/hello`;
    }
    return "https://example.com";
}

function stagePointToPct(point) {
    return {
        x: (point.x / STAGE_W) * 100,
        y: (point.y / STAGE_H) * 100,
    };
}

function pointInRect(point, rect) {
    return (
        point.x >= rect.left &&
        point.x <= rect.left + rect.width &&
        point.y >= rect.top &&
        point.y <= rect.top + rect.height
    );
}

const KEY_TEXT = {
    tilde: "`",
    minus: "-",
    plus: "=",
    bracket_l: "[",
    bracket_r: "]",
    slash_back: "\\",
    semicolon: ";",
    quote: "'",
    comma: ",",
    period: ".",
    question: "/",
    space: " ",
};

function keyZoneSlug(keyId) {
    return String(keyId || "").replace(/^[^-]+-/, "");
}

function textForKeyZone(keyId) {
    const slug = keyZoneSlug(keyId);
    if (/^[a-z0-9]$/.test(slug)) return slug;
    return KEY_TEXT[slug] || "";
}

function canRepeatKeyZone(keyId) {
    const slug = keyZoneSlug(keyId);
    return slug === "backspace" || Boolean(textForKeyZone(keyId));
}

export default function WWWorldScene({ avatarPoints = [] }) {
    const iframeRef = useRef(null);
    const draftUrlRef = useRef(defaultWWWorldUrl());
    const keyHoldRef = useRef(new Map());
    const [browserRect, setBrowserRect] = useState(FALLBACK_BROWSER_VIEWPORT);
    const [addressRect, setAddressRect] = useState(FALLBACK_ADDRESS_BAR);
    const [draftUrl, setDraftUrl] = useState(defaultWWWorldUrl);
    const [loadedUrl, setLoadedUrl] = useState(defaultWWWorldUrl);
    const [historyStack, setHistoryStack] = useState(() => [defaultWWWorldUrl()]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [webviewKey, setWebviewKey] = useState(0);
    const addressInputRect = useMemo(
        () => insetRectByPixels(addressRect, ADDRESS_INPUT_INSET),
        [addressRect]
    );

    useEffect(() => {
        draftUrlRef.current = draftUrl;
    }, [draftUrl]);

    useEffect(() => {
        let alive = true;
        const img = new Image();
        img.onload = () => {
            if (!alive) return;
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || IMG_W;
            canvas.height = img.naturalHeight || IMG_H;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) return;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const red = findMaskRect(
                data,
                canvas.width,
                { left: 180, top: 230, right: 1060, bottom: 640 },
                (r, g, b) => r > 90 && g < 48 && b < 48 && r > g * 2.2 && r > b * 2.2
            );
            const address = findMaskRect(
                data,
                canvas.width,
                { left: 318, top: 222, right: 925, bottom: 252 },
                (r, g, b) => r > 200 && g > 196 && b > 184 && Math.max(r, g, b) - Math.min(r, g, b) < 55
            );
            if (!alive) return;
            if (red) setBrowserRect(red);
            if (address) setAddressRect(address);
        };
        img.src = WORLD_BG;
        return () => { alive = false; };
    }, []);

    const activeKeyHits = useMemo(() => {
        const hits = [];
        for (const point of avatarPoints) {
            const avatarId = point?.id || point?.user_id || "anon";
            const pct = stagePointToPct(point || { x: 0, y: 0 });
            const zone = KEY_ZONES.find((candidate) => pointInRect(pct, candidate));
            if (zone) hits.push({ avatarId, keyId: zone.id });
        }
        return hits.sort((a, b) => `${a.avatarId}:${a.keyId}`.localeCompare(`${b.avatarId}:${b.keyId}`));
    }, [avatarPoints]);

    const pressedKeys = useMemo(
        () => new Set(activeKeyHits.map((hit) => hit.keyId)),
        [activeKeyHits]
    );

    const keyPressSignature = useMemo(
        () => activeKeyHits.map((hit) => `${hit.avatarId}:${hit.keyId}`).join("|"),
        [activeKeyHits]
    );

    const navigateTo = useCallback((raw, { replace = false } = {}) => {
        const nextUrl = normalizeUrl(raw);
        if (!nextUrl) return;
        let nextStack = replace
            ? [...historyStack]
            : historyStack.slice(0, historyIndex + 1);

        if (replace) {
            nextStack[Math.max(0, historyIndex)] = nextUrl;
        } else if (nextStack[nextStack.length - 1] !== nextUrl) {
            nextStack = [...nextStack, nextUrl];
        }

        if (nextStack.length > HISTORY_LIMIT) {
            nextStack = nextStack.slice(nextStack.length - HISTORY_LIMIT);
        }

        setDraftUrl(nextUrl);
        setLoadedUrl(nextUrl);
        setHistoryStack(nextStack);
        setHistoryIndex(nextStack.length - 1);
        setWebviewKey((key) => key + 1);
    }, [historyIndex, historyStack]);

    const applyKeyZoneInput = useCallback((keyId) => {
        const slug = keyZoneSlug(keyId);
        if (slug === "enter") {
            navigateTo(draftUrlRef.current);
            return true;
        }
        if (slug === "backspace") {
            setDraftUrl((value) => value.slice(0, -1));
            return true;
        }

        const text = textForKeyZone(keyId);
        if (!text) return false;
        setDraftUrl((value) => {
            if (value.length >= MAX_ADDRESS_CHARS) return value;
            return `${value}${text}`.slice(0, MAX_ADDRESS_CHARS);
        });
        return true;
    }, [navigateTo]);

    useEffect(() => {
        const now = Date.now();
        const nextHoldIds = new Set();

        for (const hit of activeKeyHits) {
            const holdId = `${hit.avatarId}:${hit.keyId}`;
            nextHoldIds.add(holdId);
            if (keyHoldRef.current.has(holdId)) continue;
            applyKeyZoneInput(hit.keyId);
            keyHoldRef.current.set(holdId, {
                keyId: hit.keyId,
                startedAt: now,
                lastRepeatAt: 0,
            });
        }

        for (const holdId of Array.from(keyHoldRef.current.keys())) {
            if (!nextHoldIds.has(holdId)) keyHoldRef.current.delete(holdId);
        }
        // activeKeyHits is represented by keyPressSignature so we only run when the pressed key set changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyPressSignature, applyKeyZoneInput]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            const now = Date.now();
            for (const hold of keyHoldRef.current.values()) {
                if (!canRepeatKeyZone(hold.keyId)) continue;
                if (now - hold.startedAt < KEY_REPEAT_DELAY_MS) continue;
                if (hold.lastRepeatAt && now - hold.lastRepeatAt < KEY_REPEAT_INTERVAL_MS) continue;
                hold.lastRepeatAt = now;
                applyKeyZoneInput(hold.keyId);
            }
        }, 80);

        return () => window.clearInterval(timer);
    }, [applyKeyZoneInput]);

    const goToHistoryIndex = (nextIndex) => {
        const clampedIndex = Math.min(Math.max(nextIndex, 0), historyStack.length - 1);
        const nextUrl = historyStack[clampedIndex];
        if (!nextUrl) return;
        setDraftUrl(nextUrl);
        setLoadedUrl(nextUrl);
        setHistoryIndex(clampedIndex);
        setWebviewKey((key) => key + 1);
    };

    const loadDraft = () => {
        navigateTo(draftUrl);
    };

    const handleToolbarAction = (action) => {
        if (action === "back") {
            goToHistoryIndex(historyIndex - 1);
            return;
        }
        if (action === "forward") {
            goToHistoryIndex(historyIndex + 1);
            return;
        }
        if (action === "stop") {
            try {
                iframeRef.current?.contentWindow?.stop?.();
            } catch {
                // Cross-origin iframes may block access; keeping this silent preserves the browser illusion.
            }
            return;
        }
        if (action === "refresh") {
            setWebviewKey((key) => key + 1);
            return;
        }
        if (action === "home") {
            navigateTo(defaultWWWorldUrl());
            return;
        }
        if (action === "search") {
            const query = (draftUrl || loadedUrl || "g00dweird").trim();
            navigateTo(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
            return;
        }
        if (action === "favorites") {
            navigateTo("https://g00dweird.com");
            return;
        }
        if (action === "history") {
            goToHistoryIndex(historyStack.length > 1 ? 0 : historyIndex);
        }
    };

    const stopWorldClick = (e) => {
        e.stopPropagation();
    };

    return (
        <div
            aria-label="WWWorld live browser layer"
            data-testid="wwworld-scene"
            style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                imageRendering: "pixelated",
                zIndex: 3,
            }}
        >
            <div
                data-testid="browser_viewport_mask"
                style={{
                    position: "absolute",
                    left: `${browserRect.left}%`,
                    top: `${browserRect.top}%`,
                    width: `${browserRect.width}%`,
                    height: `${browserRect.height}%`,
                    overflow: "hidden",
                    background: "#f2f2f2",
                    border: "1px solid rgba(0,0,0,0.38)",
                    zIndex: 4,
                    pointerEvents: "auto",
                }}
                onMouseDown={stopWorldClick}
                onClick={stopWorldClick}
                onTouchStart={stopWorldClick}
            >
                <iframe
                    key={webviewKey}
                    ref={iframeRef}
                    title="WWWorld browser viewport"
                    data-testid="browser_webview"
                    src={loadedUrl}
                    referrerPolicy="no-referrer-when-downgrade"
                    style={{
                        width: "100%",
                        height: "100%",
                        border: 0,
                        display: "block",
                        background: "#fff",
                    }}
                />
            </div>

            {TOOLBAR_BUTTONS.map((button) => (
                <button
                    key={button.id}
                    type="button"
                    data-testid={`wwworld_nav_${button.id}`}
                    aria-label={`WWWorld ${button.label}`}
                    title={button.label}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleToolbarAction(button.id);
                    }}
                    onMouseDown={stopWorldClick}
                    onTouchStart={stopWorldClick}
                    style={{
                        position: "absolute",
                        left: `${button.rect.left}%`,
                        top: `${button.rect.top}%`,
                        width: `${button.rect.width}%`,
                        height: `${button.rect.height}%`,
                        zIndex: 9,
                        pointerEvents: "auto",
                        border: 0,
                        background: "rgba(179,255,0,0.01)",
                        cursor: "pointer",
                        padding: 0,
                    }}
                />
            ))}

            <input
                data-testid="address_bar_input"
                aria-label="WWWorld address bar"
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        loadDraft();
                    }
                }}
                onMouseDown={stopWorldClick}
                onClick={stopWorldClick}
                onTouchStart={stopWorldClick}
                style={{
                    position: "absolute",
                    left: `${addressInputRect.left}%`,
                    top: `${addressInputRect.top}%`,
                    width: `${addressInputRect.width}%`,
                    height: `${addressInputRect.height}%`,
                    zIndex: 8,
                    pointerEvents: "auto",
                    boxSizing: "border-box",
                    border: 0,
                    borderRadius: 0,
                    outline: "none",
                    appearance: "none",
                    background: "transparent",
                    color: "#111",
                    fontFamily: "\"VT323\", monospace",
                    fontSize: "clamp(8px, 1.06vw, 16px)",
                    lineHeight: 1,
                    padding: "0 4px",
                    imageRendering: "pixelated",
                    boxShadow: "none",
                }}
            />

            <button
                type="button"
                data-testid="go_button_hitbox"
                aria-label="Go to typed WWWorld address"
                onClick={(e) => {
                    e.stopPropagation();
                    loadDraft();
                }}
                onMouseDown={stopWorldClick}
                onTouchStart={stopWorldClick}
                style={{
                    position: "absolute",
                    left: `${GO_BUTTON.left}%`,
                    top: `${GO_BUTTON.top}%`,
                    width: `${GO_BUTTON.width}%`,
                    height: `${GO_BUTTON.height}%`,
                    zIndex: 9,
                    pointerEvents: "auto",
                    border: 0,
                    background: "rgba(179,255,0,0.01)",
                    cursor: "pointer",
                    padding: 0,
                }}
            />

            <div
                data-testid="keyboard_key_zones"
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    zIndex: 5,
                }}
            >
                {KEY_ZONES.map((zone) => {
                    const pressed = pressedKeys.has(zone.id);
                    if (!pressed) return null;
                    return (
                        <div
                            key={zone.id}
                            data-testid="keyboard-key-pressed"
                            data-key-zone={zone.id}
                            style={{
                                position: "absolute",
                                left: `${zone.left}%`,
                                top: `${zone.top}%`,
                                width: `${zone.width}%`,
                                height: `${zone.height}%`,
                                transform: "translateY(3px)",
                                transition: "transform 80ms steps(2, end)",
                                background: "rgba(34, 26, 18, 0.22)",
                                borderTop: "2px solid rgba(0,0,0,0.35)",
                                borderLeft: "2px solid rgba(0,0,0,0.28)",
                                borderRight: "1px solid rgba(255,255,255,0.22)",
                                borderBottom: "1px solid rgba(255,255,255,0.16)",
                                boxShadow: "inset 0 3px 0 rgba(0,0,0,0.32)",
                                clipPath: "polygon(7% 0, 93% 0, 100% 30%, 93% 100%, 7% 100%, 0 30%)",
                                mixBlendMode: "multiply",
                                imageRendering: "pixelated",
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}
