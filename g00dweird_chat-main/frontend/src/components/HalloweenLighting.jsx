import React, { useEffect, useRef, useState } from "react";
import { getHalloweenLightningFrame } from "../lib/halloweenLightning";
import "./HalloweenLighting.css";

const BACKGROUND = "/assets/halloween/scene/background.png";
const FOREGROUND = "/assets/halloween/scene/foreground.png";

// Centers/radii follow the painted lamps, in percent of the unchanged square.
// Re-expose their original pixels above the darkened town, including a little
// of the warm light they cast. Windows and candles stay on the unpowered layer.
const LANTERNS = [
    [7.5, 48.8, 1.9], [27.3, 30, 1.6], [38.5, 29, 1.5],
    [47, 26.2, 1.6], [60.2, 29.8, 1.8], [76, 35.4, 1.8],
    [40.8, 65, 2.2], [58.9, 65, 2.2],
    [7.6, 20.8, 1.3], [46.6, 12.3, 1.3], [51.4, 21.3, 1.3], [97.9, 43.3, 1.4],
    [91.5, 29.4, 1.4], [95.9, 36, 1.5], [85.6, 36, 1.5],
    [81.8, 45.8, 1.8], [12, 45.8, 1.5], [19.2, 37.2, 1.2],
    [40.8, 79, 1.9], [58.8, 79, 1.9], [34.1, 69.7, 1.5],
    [7.4, 39.2, 0.9], [13.5, 38.4, 0.9], [15.2, 37.8, 0.9],
    [5.3, 69.1, 0.8], [11.6, 73.7, 0.7], [17.1, 78.3, 0.7],
    [20, 74.4, 0.7], [25.4, 79.8, 0.7], [28.3, 80.2, 0.7],
    [35.1, 81.5, 0.7], [36.6, 93.8, 0.7], [73, 88.6, 0.7],
    [67.5, 78.8, 0.7], [78.5, 74.7, 0.7], [83.4, 78, 0.7],
    [91.5, 71.6, 0.7], [96.6, 66.9, 0.7],
];
const LANTERN_MASK = LANTERNS.map(([x, y, radius]) =>
    `radial-gradient(ellipse ${radius}% ${radius * 1.2}% at ${x}% ${y}%, #000 20%, #000c 42%, transparent 100%)`
).join(",");

// Ground contact points of the clockhouse, benches and lamp posts. Project
// away from each strike so the silhouettes change direction across the plaza.
const SHADOWS = [
    [290, 470, 92, 180], [537, 463, 35, 95], [840, 503, 35, 110],
    [754, 454, 10, 125], [949, 517, 10, 135], [510, 856, 13, 100],
    [738, 856, 13, 100], [92, 645, 10, 100], [376, 812, 13, 112],
];
const BOLTS = [
    ["M714 -8 L688 36 L700 36 L666 82 L679 82 L646 128 L658 128 L627 178 L638 178 L609 226 L615 226 L595 273", "M670 80 L713 96 L702 110 L736 126 L724 139 L753 157 M641 151 L611 154 L625 169 L596 186"],
    ["M1181 -8 L1153 35 L1165 35 L1128 79 L1141 79 L1107 124 L1118 124 L1086 171 L1096 171 L1065 218 L1071 218 L1050 254", "M1132 78 L1180 92 L1167 109 L1203 126 L1189 142 L1215 166 M1101 147 L1069 152 L1082 167 L1056 185"],
];

export default function HalloweenLighting() {
    const layerRef = useRef(null);
    const [loaded, setLoaded] = useState({});
    const ready = Boolean(loaded.background && loaded.foreground);

    useEffect(() => {
        if (!ready) return undefined;
        const layer = layerRef.current;
        const scene = layer.parentElement;
        const plane = scene.closest('[data-testid="iso-world-plane"]');
        const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
        let visible = typeof IntersectionObserver === "undefined";
        let elapsed = 0;
        let lastTime = null;
        let request = null;
        let lastFrame = null;
        let disposed = false;

        const render = () => {
            const frame = getHalloweenLightningFrame(elapsed, { reducedMotion: Boolean(motion?.matches) });
            if (frame === lastFrame) return;
            lastFrame = frame;
            layer.dataset.phase = frame.phase;
            layer.dataset.strike = String(frame.strike);
            scene.style.setProperty("--halloween-darkness", frame.darkness);
            scene.style.setProperty("--halloween-flash", frame.flash);
            scene.style.setProperty("--halloween-bolt", frame.bolt);
            scene.style.setProperty("--halloween-shadow", frame.shadow);
            plane?.style.setProperty("--halloween-actor-brightness", 1 - frame.darkness * 0.86 + frame.flash * 0.9);
        };
        const shouldRun = () => !disposed && visible && !document.hidden && !motion?.matches;
        const tick = (now) => {
            request = null;
            if (!shouldRun()) { lastTime = null; return; }
            if (lastTime !== null) elapsed += Math.min(100, Math.max(0, now - lastTime));
            lastTime = now;
            render();
            request = window.requestAnimationFrame(tick);
        };
        const sync = () => {
            render();
            if (shouldRun()) {
                if (request === null) request = window.requestAnimationFrame(tick);
            } else {
                if (request !== null) window.cancelAnimationFrame(request);
                request = null;
                lastTime = null;
            }
        };
        const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
            visible = entries.some((entry) => entry.isIntersecting);
            sync();
        });
        observer?.observe(layer);
        document.addEventListener("visibilitychange", sync);
        motion?.addEventListener?.("change", sync);
        sync();
        return () => {
            disposed = true;
            if (request !== null) window.cancelAnimationFrame(request);
            observer?.disconnect();
            document.removeEventListener("visibilitychange", sync);
            motion?.removeEventListener?.("change", sync);
            ["darkness", "flash", "bolt", "shadow"].forEach((name) => scene.style.removeProperty(`--halloween-${name}`));
            plane?.style.removeProperty("--halloween-actor-brightness");
        };
    }, [ready]);

    const onLoad = (name) => (event) => {
        if (event.currentTarget.naturalWidth === 1254 && event.currentTarget.naturalHeight === 1254) {
            setLoaded((previous) => ({ ...previous, [name]: true }));
        }
    };

    return (
        <div ref={layerRef} className="halloween-lighting" data-testid="halloween-lighting" data-ready={ready} data-phase="calm" data-strike="0" aria-hidden="true">
            <img className="halloween-art halloween-background" src={BACKGROUND} alt="" draggable={false} onLoad={onLoad("background")} />
            <div className="halloween-sky-flash" />
            <svg className="halloween-bolts" viewBox="0 0 1254 1254" preserveAspectRatio="none">
                {BOLTS.map(([main, branches], index) => (
                    <g key={index} data-strike-shape={index}>
                        <path d={main} strokeWidth="5" />
                        <path d={branches} strokeWidth="2" />
                    </g>
                ))}
            </svg>
            <img className="halloween-art halloween-foreground" src={FOREGROUND} alt="" draggable={false} onLoad={onLoad("foreground")} />
            <svg className="halloween-cast-shadows" viewBox="0 0 1254 1254" preserveAspectRatio="none">
                {[0, 1].map((strike) => (
                    <g key={strike} data-strike-shape={strike}>
                        {SHADOWS.map(([x, y, width, length], index) => {
                            const sourceX = strike === 0 ? 595 : 1050;
                            const dx = (x - sourceX) / (y - 100) * length;
                            return <polygon key={index} points={`${x - width},${y} ${x + width},${y} ${x + dx + width * 0.45},${y + length * 0.64} ${x + dx - width * 0.65},${y + length * 0.64}`} />;
                        })}
                    </g>
                ))}
            </svg>
            <img className="halloween-art halloween-lantern-light" src={FOREGROUND} alt="" draggable={false} style={{ maskImage: LANTERN_MASK, WebkitMaskImage: LANTERN_MASK }} />
        </div>
    );
}
