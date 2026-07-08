export function elapsedSinceStartedAt(startedAt, nowMs = Date.now()) {
    if (!startedAt) return 0;
    let startedMs = 0;
    if (typeof startedAt === "number") {
        startedMs = startedAt > 1000000000000 ? startedAt : startedAt * 1000;
    } else {
        startedMs = Date.parse(startedAt);
    }
    if (!Number.isFinite(startedMs)) return 0;
    return Math.max(0, (nowMs - startedMs) / 1000);
}

export function mediaUrlForElement(url) {
    if (!url) return "";
    if (typeof window === "undefined") return url;
    try {
        return new URL(url, window.location.href).href;
    } catch {
        return url;
    }
}

export function seekElementToTrackTime(element, track, toleranceSeconds = 1.25) {
    if (!element || !track?.started_at) return;
    const target = elapsedSinceStartedAt(track.started_at);
    const duration = Number.isFinite(element.duration) ? element.duration : 0;
    const clamped = duration > 0 ? Math.min(target, Math.max(0, duration - 0.25)) : target;
    if (Math.abs((element.currentTime || 0) - clamped) <= toleranceSeconds) return;
    try {
        element.currentTime = clamped;
    } catch {
        // Some browsers reject currentTime before metadata is ready; loadedmetadata retries.
    }
}
