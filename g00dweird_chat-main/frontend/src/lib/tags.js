/**
 * Graffiti tag list (matches /public/tags/manifest.json)
 * 24 preset tags: GOOD WEIRD VOID TOXIC ACID SLIME GLITCH OOZE BUG SICK HACK NOKE
 *                 FEED MELT BURN ROT CYBER SPAWN VIRUS LEAK ANARCHY DATA FREAK SKULL
 */
export const TAG_WORDS = [
    "GOOD", "WEIRD", "VOID", "TOXIC",
    "ACID", "SLIME", "GLITCH", "OOZE",
    "BUG", "SICK", "HACK", "NOKE",
    "FEED", "MELT", "BURN", "ROT",
    "CYBER", "SPAWN", "VIRUS", "LEAK",
    "ANARCHY", "DATA", "FREAK", "SKULL",
];

export function normalizePresetTag(tag) {
    const raw = String(tag || "good").trim().toUpperCase();
    if (TAG_WORDS.includes(raw)) return raw;
    const firstKnown = raw
        .split(/[^A-Z0-9]+/)
        .find((part) => TAG_WORDS.includes(part));
    return firstKnown || null;
}

export function isPresetTag(tag) {
    return !!normalizePresetTag(tag);
}

export function tagImageUrl(tag) {
    const key = normalizePresetTag(tag) || "GOOD";
    return `/tags/${key.toLowerCase()}.png`;
}

// Spray-jet animation frames (9 available 1..9)
export const JET_FRAMES = 9;

export function jetFrameUrl(i) {
    return `/spray/jet_${Math.max(1, Math.min(JET_FRAMES, i))}.png`;
}

// Spray can variants (0..7). 0 is the base upright can.
export function canUrl(i = 0) {
    return `/spray/can_${i}.png`;
}
