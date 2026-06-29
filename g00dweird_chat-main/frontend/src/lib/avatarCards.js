export const ANIMATED_AVATAR_CARD_IDS = [
    "alien", "ape", "cat", "fairy", "frog", "ghost",
    "robot", "skeleton", "slime", "tvhead", "weirdbot",
];

export const STATIC_AVATAR_CARD_IDS = [
    "ghost_tiny", "ghost_cute", "ghost_giant",
    "alien_gray", "alien_green", "alien_hulk",
    "ape_baby", "ape_dude", "ape_king",
];

const CARD_IDS = new Set([...ANIMATED_AVATAR_CARD_IDS, ...STATIC_AVATAR_CARD_IDS]);

export function avatarInitials(nickname) {
    const parts = String(nickname || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "??";
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

export function avatarCardSquareSrc(id) {
    return CARD_IDS.has(id) ? `/assets/avatar-cards/square/${id}.png` : null;
}

export function avatarCardFullSrc(id) {
    return CARD_IDS.has(id) ? `/assets/avatar-cards/full/${id}.png` : null;
}

export function avatarCardAssetFor({ animId, spriteId } = {}) {
    if (CARD_IDS.has(animId)) {
        return {
            id: animId,
            squareSrc: avatarCardSquareSrc(animId),
            fullSrc: avatarCardFullSrc(animId),
        };
    }
    if (CARD_IDS.has(spriteId)) {
        return {
            id: spriteId,
            squareSrc: avatarCardSquareSrc(spriteId),
            fullSrc: avatarCardFullSrc(spriteId),
        };
    }
    return null;
}
