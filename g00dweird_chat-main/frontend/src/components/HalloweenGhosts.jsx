import React, { useEffect, useRef, useState } from "react";
import {
    HALLOWEEN_GHOST_MANIFEST,
    halloweenGhostFrame,
    halloweenGhostHeight,
    halloweenGhostPose,
    halloweenGhostsFromManifest,
} from "../lib/halloweenGhosts";
import "./HalloweenGhosts.css";

export default function HalloweenGhosts() {
    const [ghosts, setGhosts] = useState([]);
    const layerRef = useRef(null);
    const actorRefs = useRef({});
    const loadedSheets = useRef(new Set());
    const redraw = useRef(null);

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        fetch(HALLOWEEN_GHOST_MANIFEST, { signal: controller.signal })
            .then((response) => response.ok ? response.json() : null)
            .then((manifest) => {
                if (active) setGhosts(halloweenGhostsFromManifest(manifest));
            })
            .catch(() => { /* The room remains usable when optional scenery cannot load. */ });
        return () => {
            active = false;
            controller.abort();
        };
    }, []);

    useEffect(() => {
        const layer = layerRef.current;
        if (!layer || !ghosts.length) return undefined;
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
        const actors = ghosts.map((ghost) => {
            const node = actorRefs.current[ghost.id];
            return {
                ghost, node,
                sheet: node.querySelector("img"),
                crop: node.querySelector(".halloween-ghost-crop"),
                light: layer.querySelector(`[data-ghost-ground="${ghost.id}"]`),
                lastFrame: "",
                lastHeight: null,
            };
        });
        let width = 0;
        let height = 0;
        let elapsed = 0;
        let lastTime = null;
        let frameRequest = null;
        let visible = typeof IntersectionObserver === "undefined";
        let disposed = false;

        const render = () => {
            if (disposed) return;
            const spriteHeight = halloweenGhostHeight(width);
            const spriteWidth = spriteHeight * 354 / 314;
            for (const actor of actors) {
                const { ghost, node, sheet, crop, light } = actor;
                const pose = halloweenGhostPose(ghost.routeIndex, elapsed, Boolean(reducedMotion?.matches));
                const ready = loadedSheets.current.has(ghost.id) && width > 0 && height > 0;
                if (actor.lastHeight !== spriteHeight) {
                    node.style.width = `${spriteWidth}px`;
                    node.style.height = `${spriteHeight}px`;
                    light.style.width = `${spriteHeight * 0.55}px`;
                    actor.lastHeight = spriteHeight;
                }
                node.style.opacity = ready ? String(pose.opacity) : "0";
                node.style.transform = `translate3d(${(pose.x * width - spriteWidth * 0.5).toFixed(2)}px, ${(pose.y * height - spriteHeight * 0.96).toFixed(2)}px, 0)`;
                light.style.opacity = ready ? String(pose.groundOpacity) : "0";
                light.style.transform = `translate3d(${(pose.groundX * width).toFixed(2)}px, ${(pose.groundY * height).toFixed(2)}px, 0) translate(-50%, -50%)`;
                const { frame, row } = halloweenGhostFrame(ghost, pose);
                const frameKey = `${row}:${frame}:${pose.state}`;
                if (frameKey !== actor.lastFrame) {
                    node.dataset.state = pose.state;
                    sheet.style.transform = `translate(${-frame * 25}%, ${-row * 25}%)`;
                    crop.style.clipPath = pose.state === "rise" || pose.state === "vanish" ? "inset(0 0 4% 0)" : "none";
                    actor.lastFrame = frameKey;
                }
            }
        };
        const shouldRun = () => !disposed && visible && !document.hidden && !reducedMotion?.matches &&
            width > 0 && height > 0 && loadedSheets.current.size > 0;
        const tick = (now) => {
            frameRequest = null;
            if (!shouldRun()) { lastTime = null; return; }
            if (lastTime !== null) elapsed += Math.min(100, Math.max(0, now - lastTime));
            lastTime = now;
            render();
            frameRequest = window.requestAnimationFrame(tick);
        };
        const sync = () => {
            render();
            if (shouldRun()) {
                if (frameRequest === null) frameRequest = window.requestAnimationFrame(tick);
            } else {
                if (frameRequest !== null) window.cancelAnimationFrame(frameRequest);
                frameRequest = null;
                lastTime = null;
            }
        };
        const measure = () => {
            const bounds = layer.getBoundingClientRect();
            width = bounds.width;
            height = bounds.height;
            sync();
        };
        const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
        const intersectionObserver = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
            visible = entries.some((entry) => entry.isIntersecting);
            sync();
        });
        redraw.current = sync;
        resizeObserver?.observe(layer);
        intersectionObserver?.observe(layer);
        if (!resizeObserver) window.addEventListener("resize", measure);
        document.addEventListener("visibilitychange", sync);
        reducedMotion?.addEventListener?.("change", sync);
        measure();

        return () => {
            disposed = true;
            redraw.current = null;
            if (frameRequest !== null) window.cancelAnimationFrame(frameRequest);
            resizeObserver?.disconnect();
            intersectionObserver?.disconnect();
            window.removeEventListener("resize", measure);
            document.removeEventListener("visibilitychange", sync);
            reducedMotion?.removeEventListener?.("change", sync);
        };
    }, [ghosts]);

    return (
        <div ref={layerRef} className="halloween-ghosts" data-testid="halloween-ghosts" aria-hidden="true">
            <link rel="stylesheet" href="/assets/halloween/ghosts/appearance.css" />
            {ghosts.map((ghost) => (
                <React.Fragment key={ghost.id}>
                    <span className="halloween-ghost-ground" data-ghost-ground={ghost.id} />
                    <div
                        ref={(node) => { actorRefs.current[ghost.id] = node; }}
                        className="halloween-ghost-actor"
                        data-testid={`halloween-${ghost.id}`}
                    >
                        <div className="halloween-ghost-glow">
                            <div className="halloween-ghost-crop">
                                <img
                                    className="halloween-ghost-sheet"
                                    src={ghost.sheet}
                                    alt=""
                                    draggable={false}
                                    decoding="async"
                                    onLoad={(event) => {
                                        const image = event.currentTarget;
                                        if (image.naturalWidth === 1416 && image.naturalHeight === 1256) loadedSheets.current.add(ghost.id);
                                        redraw.current?.();
                                    }}
                                    onError={() => {
                                        loadedSheets.current.delete(ghost.id);
                                        redraw.current?.();
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </React.Fragment>
            ))}
        </div>
    );
}
