// Positions are fractions of Halloween Town's square artwork, not chat coordinates.
const FLIGHTS = [
    [[0.27, 0.64], [0.21, 0.38], [0.76, 0.39], [0.73, 0.65]],
    [[0.74, 0.59], [0.68, 0.36], [0.28, 0.42], [0.26, 0.65]],
    [[0.33, 0.68], [0.75, 0.49], [0.69, 0.37], [0.67, 0.61]],
    [[0.68, 0.68], [0.32, 0.44], [0.23, 0.40], [0.36, 0.59]],
];

const STATES = ["rise", "float", "haunt", "vanish"];
export const HALLOWEEN_GHOST_IDS = ["ghost1", "ghost2", "ghost3", "ghost4"];
export const HALLOWEEN_GHOST_MANIFEST = "/assets/halloween/ghosts/manifest.json";

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
};

export function halloweenGhostHeight(stageWidth) {
    return Math.min(148, Math.max(54, stageWidth * 0.14)) * 0.75;
}

export function halloweenGhostCycle(index) {
    const flight = 22 + index * 2.7;
    return { delay: index * 2.4, rise: 0.9, flight, vanish: 0.9, hidden: 2.2, total: flight + 4 };
}

function flightPoint(points, progress) {
    const t = smooth(progress);
    const u = 1 - t;
    const weights = [u ** 3, 3 * u * u * t, 3 * u * t * t, t ** 3];
    return {
        x: points.reduce((sum, point, index) => sum + point[0] * weights[index], 0),
        y: points.reduce((sum, point, index) => sum + point[1] * weights[index], 0),
    };
}

export function halloweenGhostPose(index, elapsedMs, reducedMotion = false) {
    const route = FLIGHTS[index];
    const timing = halloweenGhostCycle(index);
    const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs / 1000 : 0) - timing.delay;
    const cycle = Math.floor(Math.max(0, elapsed) / timing.total);
    // Reverse the entire route each visit: the next rise starts where the last sink ended.
    const points = cycle % 2 ? [...route].reverse() : route;
    const local = Math.max(0, elapsed) % timing.total;
    const flyingFor = local - timing.rise;
    const progress = clamp01(flyingFor / timing.flight);
    let state = "float";
    let animationTime = Math.max(0, flyingFor);
    let opacity = 0.94;
    let groundOpacity = Math.max(0, 1 - Math.min(progress, 1 - progress) * 12) * 0.65;

    if (elapsed < 0) {
        state = "hidden";
        opacity = 0;
        groundOpacity = 0;
    } else if (local < timing.rise) {
        state = "rise";
        animationTime = local;
        opacity *= smooth(local / 0.2);
        groundOpacity = smooth(local / 0.3) * 0.65;
    } else if (flyingFor >= timing.flight + timing.vanish) {
        state = "hidden";
        opacity = 0;
        groundOpacity = 0;
    } else if (flyingFor >= timing.flight) {
        state = "vanish";
        animationTime = flyingFor - timing.flight;
        opacity *= 1 - smooth((animationTime / timing.vanish - 0.6) / 0.4);
        groundOpacity = 0.65 * (1 - smooth(animationTime / timing.vanish));
    } else {
        for (const at of [timing.flight * 0.3, timing.flight * 0.68]) {
            if (flyingFor >= at && flyingFor < at + 0.9) {
                state = "haunt";
                animationTime = flyingFor - at;
            }
        }
    }

    if (reducedMotion) {
        // A quiet, fully visible tableau, independent of the animation clock.
        const point = flightPoint(route, 0.18 + index * 0.2);
        return { ...point, groundX: point.x, groundY: 0.65, state: "float", animationTime: 0, opacity: 0.85, groundOpacity: 0 };
    }

    const point = flightPoint(points, progress);
    // This envelope reaches zero at both ground contacts and stays continuous during haunts.
    point.y -= Math.sin(Math.PI * progress) ** 2 * Math.sin(flyingFor * 1.5 + index) * 0.007;
    return {
        ...point,
        groundX: point.x,
        groundY: points[0][1] + (points[3][1] - points[0][1]) * smooth(progress),
        state,
        animationTime,
        opacity,
        groundOpacity,
    };
}

export function halloweenGhostFrame(ghost, pose) {
    const animation = ghost.animations[pose.state === "hidden" ? "vanish" : pose.state];
    const tick = Math.floor(Math.max(0, pose.animationTime) * animation.fps);
    return {
        row: animation.row,
        frame: pose.state === "hidden" ? animation.frames - 1
            : animation.loop ? tick % animation.frames : Math.min(animation.frames - 1, tick),
    };
}

export function halloweenGhostsFromManifest(manifest) {
    if (!Array.isArray(manifest?.ghosts)) return [];
    return HALLOWEEN_GHOST_IDS.flatMap((id, routeIndex) => {
        const ghost = manifest.ghosts.find((entry) => entry?.id === id);
        if (!ghost || typeof ghost.sheet !== "string" || !ghost.sheet.startsWith("/assets/halloween/ghosts/") ||
            ghost.frameWidth !== 354 || ghost.frameHeight !== 314 ||
            !STATES.every((state) => {
                const animation = ghost.animations?.[state];
                return animation && Number.isInteger(animation.row) && animation.row >= 0 && animation.row < 4 &&
                    Number.isInteger(animation.frames) && animation.frames > 0 && animation.frames <= 4 &&
                    Number.isFinite(animation.fps) && animation.fps > 0;
            })) return [];
        return [{ ...ghost, routeIndex }];
    });
}
