/**
 * Helpers for YouTube embed/queue feature.
 *
 * Accepts:
 *   - full youtube.com/watch?v=ID
 *   - youtu.be/ID
 *   - youtube.com/shorts/ID
 *   - youtube.com/embed/ID
 *   - bare 11-char video id
 */
const ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function parseYouTubeId(input) {
    if (!input) return null;
    const s = input.trim();
    if (ID_RE.test(s)) return s;
    let m;
    m = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    m = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    m = s.match(/youtube\.com\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    return null;
}

export function youtubeEmbedUrl(videoId, { autoplay = 1, mute = 0, startSeconds = 0 } = {}) {
    const u = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
    u.searchParams.set("autoplay", String(autoplay));
    u.searchParams.set("mute", String(mute));
    u.searchParams.set("rel", "0");
    u.searchParams.set("modestbranding", "1");
    u.searchParams.set("playsinline", "1");
    if (startSeconds > 0) u.searchParams.set("start", String(Math.floor(startSeconds)));
    // enablejsapi lets us postMessage seek/play commands later
    u.searchParams.set("enablejsapi", "1");
    return u.toString();
}

/**
 * Compute elapsed seconds since a track's `started_ts` (Unix epoch float, server time)
 * adjusted by the client/server clock skew estimate.
 */
export function elapsedSinceStart(startedTs, serverSkewMs = 0) {
    if (!startedTs) return 0;
    const nowMs = Date.now() - serverSkewMs;
    const startedMs = startedTs * 1000;
    return Math.max(0, (nowMs - startedMs) / 1000);
}

// Bounding box of the GREEN cinema-screen area within the theatre BG (% of image).
// Pixel-measured: green pixels in /5ki60x97_youtubetheatre.png live at
// x=329-924 y=181-543 of a 1254x1254 image → exactly the "tonight's feature" screen.
export const THEATRE_SCREEN_BBOX = {
    leftPct: 26.24,
    topPct: 14.43,
    widthPct: 47.45,
    heightPct: 28.87,
};
