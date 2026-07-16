import {
    ANIM_CREATURES,
    getAvailableStates,
    pickTravelStance,
    resolveState,
    sanitizeAnimCreature,
    shouldUseCleanedSprites,
    spriteMirrorForFacing,
    spriteVisualEffect,
    spriteFrameBox,
} from "./AnimSprite";

describe("animated sprite registry", () => {
    test("only exposes production-ready animated creatures", () => {
        expect(ANIM_CREATURES).toEqual(expect.arrayContaining(["alien", "cat", "ghost", "slime", "teekae"]));
        expect(ANIM_CREATURES).not.toEqual(expect.arrayContaining(["bat", "boo", "plant"]));
        expect(sanitizeAnimCreature("cat")).toBe("cat");
        expect(sanitizeAnimCreature("slime")).toBe("slime");
        expect(sanitizeAnimCreature("teekae")).toBe("teekae");
        expect(sanitizeAnimCreature("bat")).toBeNull();
        expect(sanitizeAnimCreature("boo")).toBeNull();
        expect(sanitizeAnimCreature("plant")).toBeNull();
    });

    test("uses sprite-specific travel stances for clean animated creatures", () => {
        expect(pickTravelStance("slime", 120, 0)).toBe("hop");
        expect(pickTravelStance("ghost", 120, 0)).toBe("float");
        expect(pickTravelStance("alien", 320, 0)).toBe("run");
        expect(pickTravelStance("teekae", 320, 0)).toBe("walk");
        expect(resolveState("slime", "idle")).toBe("idle");
        expect(getAvailableStates("teekae")).toEqual([
            "idle", "walk", "attack", "hurt", "die",
            "emote_a", "emote_b", "emote_c", "emote_d",
        ]);
    });

    test("uses cleaned sprite frames by default and allows an explicit opt-out", () => {
        expect(shouldUseCleanedSprites({})).toBe(true);
        expect(shouldUseCleanedSprites({ REACT_APP_USE_CLEANED_SPRITES: "1" })).toBe(true);
        expect(shouldUseCleanedSprites({ REACT_APP_USE_CLEANED_SPRITES: "0" })).toBe(false);
    });

    test("pads WeirdBot walk frames so side arms do not clip while walking", () => {
        expect(spriteFrameBox("weirdbot", "walk", 88)).toEqual({ width: 109, height: 88 });
        expect(spriteFrameBox("weirdbot", "idle", 88)).toBeNull();
        expect(spriteFrameBox("ghost", "float", 88)).toBeNull();
    });

    test("gives slime a color-cycle treatment without affecting cat", () => {
        const slimeEffect = spriteVisualEffect("slime");
        expect(slimeEffect).toEqual(expect.objectContaining({
            animation: expect.stringContaining("slime-chroma-cycle"),
            filter: expect.stringContaining("saturate"),
        }));
        expect(slimeEffect.animation).toContain("linear");
        expect(slimeEffect.animation).not.toContain("steps");
        expect(spriteVisualEffect("cat")).toEqual({});
    });

    test("accounts for Tee Kae walk art being authored facing left", () => {
        expect(spriteMirrorForFacing("teekae", "walk", false)).toBe(true);
        expect(spriteMirrorForFacing("teekae", "walk", true)).toBe(false);
        expect(spriteMirrorForFacing("teekae", "idle", false)).toBe(true);

        // His attack row and the rest of the family are authored facing right.
        expect(spriteMirrorForFacing("teekae", "attack", false)).toBe(false);
        expect(spriteMirrorForFacing("teekae", "attack", true)).toBe(true);
        expect(spriteMirrorForFacing("cat", "walk", false)).toBe(false);
        expect(spriteMirrorForFacing("cat", "walk", true)).toBe(true);
    });
});
