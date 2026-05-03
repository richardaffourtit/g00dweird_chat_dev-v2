import React, { useEffect, useRef, useState } from "react";

/**
 * CloudLayer — eight pixel-art clouds drifting right→left across the top
 * of an iso-world. Used as scenery in select rooms (currently `hello`).
 *
 * Each cloud has its own seed (size, vertical offset within band, drift
 * speed and starting offset) so they don't move in lockstep. Speeds are
 * deliberately slow (60-110s per full pass) to feel ambient rather than
 * busy.
 */

const N_CLOUDS = 8;

// Per-cloud configs. y is a 0..1 fraction of the BAND height (0 = top,
// 1 = bottom of band). Speed is total seconds for one full L→R pass.
const CONFIGS = [
    { src: "/scenery/cloud_1.png", scale: 0.42, y: 0.05, speed: 95,  delay: 0   },
    { src: "/scenery/cloud_2.png", scale: 0.34, y: 0.55, speed: 78,  delay: -22 },
    { src: "/scenery/cloud_3.png", scale: 0.50, y: 0.20, speed: 110, delay: -45 },
    { src: "/scenery/cloud_4.png", scale: 0.30, y: 0.70, speed: 64,  delay: -8  },
    { src: "/scenery/cloud_5.png", scale: 0.36, y: 0.40, speed: 85,  delay: -55 },
    { src: "/scenery/cloud_6.png", scale: 0.44, y: 0.10, speed: 100, delay: -70 },
    { src: "/scenery/cloud_7.png", scale: 0.28, y: 0.85, speed: 72,  delay: -30 },
    { src: "/scenery/cloud_8.png", scale: 0.38, y: 0.30, speed: 90,  delay: -60 },
];

export default function CloudLayer({ heightFraction = 0.45, opacity = 0.85 }) {
    const ref = useRef(null);
    const [size, setSize] = useState({ w: 0, h: 0 });

    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const ro = new ResizeObserver(() => {
            const r = el.getBoundingClientRect();
            setSize({ w: r.width, h: r.height });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            data-testid="cloud-layer"
            aria-hidden
            style={{
                position: "absolute",
                top: 0, left: 0, right: 0,
                height: `${Math.round(heightFraction * 100)}%`,
                pointerEvents: "none",
                overflow: "hidden",
                zIndex: 1,
                opacity,
            }}
        >
            <style>{`
                @keyframes cloud-drift {
                    0%   { transform: translate3d(110%,0,0); }
                    100% { transform: translate3d(-110%,0,0); }
                }
            `}</style>
            {CONFIGS.slice(0, N_CLOUDS).map((c, i) => {
                if (size.w === 0) return null;
                const baseW = 600 * c.scale; // sliced clouds are ~580-620px wide
                return (
                    <img
                        key={i}
                        src={c.src}
                        alt=""
                        style={{
                            position: "absolute",
                            top: `${c.y * 100}%`,
                            left: 0,
                            width: `${baseW}px`,
                            height: "auto",
                            imageRendering: "pixelated",
                            animation: `cloud-drift ${c.speed}s linear infinite`,
                            animationDelay: `${c.delay}s`,
                            willChange: "transform",
                            filter: "drop-shadow(0 2px 0 rgba(0,0,0,0.06))",
                        }}
                    />
                );
            })}
        </div>
    );
}
