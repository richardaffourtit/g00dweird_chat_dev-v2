import React, { useEffect, useMemo, useState } from "react";

const CANVAS_SIZE = 1254;
const BASE = "/worlds/neoclassick-back-nine/hole9";
const ASSET_VERSION = "hole9-living-20260503a";

function asset(name) {
    return `${BASE}/${name}.png?v=${ASSET_VERSION}`;
}

function pct(value) {
    return `${(value / CANVAS_SIZE) * 100}%`;
}

const HAND_SEQUENCES = {
    rise: Array.from({ length: 7 }, (_, index) => asset(`hand_rise_${String(index + 1).padStart(2, "0")}`)),
    swipe: Array.from({ length: 6 }, (_, index) => asset(`hand_swipe_${String(index + 1).padStart(2, "0")}`)),
    grab: Array.from({ length: 7 }, (_, index) => asset(`hand_grab_${String(index + 1).padStart(2, "0")}`)),
    slam: Array.from({ length: 7 }, (_, index) => asset(`hand_slam_${String(index + 1).padStart(2, "0")}`)),
};

const HAND_EVENTS = ["rise", "swipe", "grab", "slam"];
const TOXIC_BUBBLES = [
    { x: 350, y: 930, size: 9, delay: -0.2 },
    { x: 418, y: 880, size: 6, delay: -1.1 },
    { x: 544, y: 702, size: 8, delay: -0.7 },
    { x: 664, y: 622, size: 5, delay: -1.9 },
    { x: 772, y: 530, size: 7, delay: -1.4 },
    { x: 905, y: 430, size: 8, delay: -0.4 },
    { x: 1010, y: 640, size: 6, delay: -2.2 },
    { x: 1092, y: 760, size: 10, delay: -0.9 },
];

const DRIFT_SHARDS = [
    { x: 304, y: 144, size: 72, delay: -0.4, drift: 11 },
    { x: 882, y: 210, size: 54, delay: -1.6, drift: -8 },
    { x: 1085, y: 330, size: 44, delay: -2.7, drift: 7 },
    { x: 700, y: 412, size: 34, delay: -1.0, drift: -10 },
];

export default function Hole9InteractiveScene() {
    const [handEvent, setHandEvent] = useState({ mode: "rise", nonce: 0 });
    const [handFrame, setHandFrame] = useState(0);
    const [burst, setBurst] = useState(0);
    const frames = HAND_SEQUENCES[handEvent.mode] || HAND_SEQUENCES.rise;
    const handSrc = frames[handFrame % frames.length];

    useEffect(() => {
        let index = 0;
        setHandFrame(0);
        const id = window.setInterval(() => {
            index = (index + 1) % frames.length;
            setHandFrame(index);
        }, handEvent.mode === "slam" ? 90 : 115);
        return () => window.clearInterval(id);
    }, [frames, handEvent]);

    useEffect(() => {
        const id = window.setInterval(() => {
            setHandEvent((event) => {
                const nextMode = HAND_EVENTS[(HAND_EVENTS.indexOf(event.mode) + 1) % HAND_EVENTS.length] || "rise";
                return { mode: nextMode, nonce: event.nonce + 1 };
            });
        }, 8200);
        return () => window.clearInterval(id);
    }, []);

    const bubbleNodes = useMemo(() => TOXIC_BUBBLES, []);
    const shardNodes = useMemo(() => DRIFT_SHARDS, []);

    const triggerHand = (preferred = null) => {
        setHandEvent((event) => {
            const mode = preferred || HAND_EVENTS[(event.nonce + 1) % HAND_EVENTS.length] || "slam";
            return { mode, nonce: event.nonce + 1 };
        });
        setBurst((value) => value + 1);
    };

    return (
        <div className="absolute inset-0 pointer-events-none" data-testid="hole9-interactive-scene">
            <style>{`
                @keyframes hole9-vortex-breathe {
                    0%, 100% { opacity: 0.38; transform: translate(-50%, -50%) scale(0.88) rotate(0deg); }
                    50% { opacity: 0.86; transform: translate(-50%, -50%) scale(1.08) rotate(9deg); }
                }
                @keyframes hole9-lightning-flash {
                    0%, 14%, 18%, 48%, 100% { opacity: 0; }
                    15%, 17% { opacity: 0.48; }
                    49% { opacity: 0.24; }
                }
                @keyframes hole9-toxic-rise {
                    0% { opacity: 0; transform: translate3d(0, 18px, 0) scale(0.7); }
                    22% { opacity: 0.9; }
                    100% { opacity: 0; transform: translate3d(0, -54px, 0) scale(1.1); }
                }
                @keyframes hole9-shard-float {
                    0%, 100% { transform: translate(-50%, -50%) translate3d(0, 0, 0) rotate(-2deg); }
                    50% { transform: translate(-50%, -50%) translate3d(var(--drift), -14px, 0) rotate(2deg); }
                }
                @keyframes hole9-sign-flicker {
                    0%, 100% { opacity: 0.72; filter: drop-shadow(0 0 3px #b3ff00) drop-shadow(0 0 8px #ff2bd6); }
                    11% { opacity: 0.42; }
                    13% { opacity: 0.92; }
                    54% { opacity: 0.58; }
                    58% { opacity: 0.98; filter: drop-shadow(0 0 7px #b3ff00) drop-shadow(0 0 13px #ff2bd6); }
                }
                @keyframes hole9-hand-idle {
                    0%, 100% { transform: translate(-50%, -100%) translateY(0) rotate(-1deg); }
                    50% { transform: translate(-50%, -100%) translateY(-5px) rotate(1deg); }
                }
                @keyframes hole9-pop {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.45); }
                    28% { opacity: 0.92; }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(1.55); }
                }
                @keyframes hole9-ooze-sway {
                    0%, 100% { transform: translate(-50%, -50%) translateX(0); opacity: 0.72; }
                    50% { transform: translate(-50%, -50%) translateX(5px); opacity: 1; }
                }
            `}</style>

            <div
                data-testid="hole9-lightning"
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 8,
                    background:
                        "linear-gradient(116deg, rgba(255,255,255,0) 0 42%, rgba(255,160,255,0.62) 43%, rgba(255,255,255,0.96) 44%, rgba(255,255,255,0) 45% 100%)",
                    mixBlendMode: "screen",
                    animation: "hole9-lightning-flash 5.6s steps(1, end) infinite",
                }}
            />

            <div
                data-testid="hole9-vortex-core"
                style={{
                    position: "absolute",
                    left: pct(785),
                    top: pct(124),
                    width: pct(270),
                    height: pct(118),
                    zIndex: 12,
                    borderRadius: "50%",
                    background:
                        "radial-gradient(ellipse, rgba(255,255,255,0.9) 0 4%, rgba(255,58,255,0.66) 5% 18%, rgba(130,32,255,0.38) 19% 48%, rgba(0,0,0,0) 70%)",
                    boxShadow: "0 0 26px rgba(255,58,255,0.56), 0 0 58px rgba(129,61,255,0.36)",
                    mixBlendMode: "screen",
                    animation: "hole9-vortex-breathe 4.8s ease-in-out infinite",
                }}
            />

            {shardNodes.map((shard, index) => (
                <div
                    key={`${shard.x}-${shard.y}`}
                    data-testid="hole9-floating-shard"
                    style={{
                        "--drift": `${shard.drift}px`,
                        position: "absolute",
                        left: pct(shard.x),
                        top: pct(shard.y),
                        width: shard.size,
                        height: shard.size * 1.7,
                        zIndex: 11,
                        opacity: 0.4,
                        clipPath: "polygon(50% 0, 82% 34%, 64% 100%, 34% 100%, 18% 35%)",
                        background: "linear-gradient(180deg, rgba(190,84,255,0.58), rgba(28,10,55,0.2))",
                        boxShadow: "0 0 16px rgba(184,80,255,0.45)",
                        mixBlendMode: "screen",
                        animation: "hole9-shard-float 5.8s ease-in-out infinite",
                        animationDelay: `${shard.delay - index * 0.2}s`,
                    }}
                />
            ))}

            <img
                src={asset("sign_beyond")}
                alt=""
                aria-hidden
                data-testid="hole9-beyond-sign"
                style={{
                    position: "absolute",
                    left: pct(76),
                    top: pct(372),
                    width: pct(132),
                    height: "auto",
                    zIndex: 28,
                    imageRendering: "pixelated",
                    animation: "hole9-sign-flicker 3.2s steps(5, end) infinite",
                    transformOrigin: "bottom center",
                }}
            />

            {bubbleNodes.map((bubble) => (
                <span
                    key={`${bubble.x}-${bubble.y}`}
                    data-testid="hole9-toxic-bubble"
                    style={{
                        position: "absolute",
                        left: pct(bubble.x),
                        top: pct(bubble.y),
                        width: bubble.size,
                        height: bubble.size,
                        zIndex: 18,
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(255,255,255,0.85), rgba(179,255,0,0.68) 32%, rgba(179,255,0,0) 72%)",
                        boxShadow: "0 0 9px rgba(179,255,0,0.62)",
                        animation: "hole9-toxic-rise 3.4s ease-in-out infinite",
                        animationDelay: `${bubble.delay}s`,
                        mixBlendMode: "screen",
                    }}
                />
            ))}

            <img
                src={asset("toxic_splash")}
                alt=""
                aria-hidden
                data-testid="hole9-toxic-splash"
                style={{
                    position: "absolute",
                    left: pct(526),
                    top: pct(706),
                    width: pct(72),
                    height: "auto",
                    zIndex: 27,
                    opacity: 0.9,
                    imageRendering: "pixelated",
                    mixBlendMode: "screen",
                    animation: "hole9-pop 4.1s ease-out infinite",
                }}
            />

            <img
                key={burst}
                src={asset("purple_burst")}
                alt=""
                aria-hidden
                data-testid="hole9-purple-burst"
                style={{
                    position: "absolute",
                    left: pct(760),
                    top: pct(612),
                    width: pct(112),
                    height: "auto",
                    zIndex: 29,
                    opacity: 0.82,
                    imageRendering: "pixelated",
                    mixBlendMode: "screen",
                    animation: "hole9-pop 900ms ease-out both",
                }}
            />

            <img
                src={handSrc}
                alt=""
                aria-hidden
                data-testid="hole9-demon-hand"
                data-hole9-hand-mode={handEvent.mode}
                style={{
                    position: "absolute",
                    left: pct(704),
                    top: pct(748),
                    width: handEvent.mode === "swipe" ? pct(190) : pct(150),
                    height: "auto",
                    zIndex: 34,
                    imageRendering: "pixelated",
                    filter: "drop-shadow(0 0 8px rgba(255,43,214,0.48)) drop-shadow(0 0 12px rgba(179,255,0,0.22))",
                    animation: "hole9-hand-idle 1.8s ease-in-out infinite",
                    transformOrigin: "50% 100%",
                }}
            />

            <button
                type="button"
                aria-label="Summon hole 9 hand"
                tabIndex={-1}
                onClick={(e) => {
                    e.stopPropagation();
                    triggerHand();
                }}
                style={{
                    position: "absolute",
                    left: pct(570),
                    top: pct(566),
                    width: pct(272),
                    height: pct(270),
                    zIndex: 70,
                    border: 0,
                    padding: 0,
                    opacity: 0,
                    pointerEvents: "auto",
                    cursor: "crosshair",
                }}
            />

            <button
                type="button"
                aria-label="Pulse hole 9 vortex"
                tabIndex={-1}
                onClick={(e) => {
                    e.stopPropagation();
                    triggerHand("slam");
                }}
                style={{
                    position: "absolute",
                    left: pct(664),
                    top: pct(36),
                    width: pct(264),
                    height: pct(178),
                    zIndex: 70,
                    border: 0,
                    padding: 0,
                    opacity: 0,
                    pointerEvents: "auto",
                    cursor: "crosshair",
                }}
            />
        </div>
    );
}
