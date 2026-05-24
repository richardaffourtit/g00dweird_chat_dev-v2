import {
    ANIM_CREATURES,
    getAvailableStates,
    pickTravelStance,
    resolveState,
    sanitizeAnimCreature,
    shouldUseCleanedSprites,
    spriteFrameBox,
} from "./AnimSprite";

describe("animated sprite registry", () => {
    test("only exposes production-ready animated creatures", () => {
        expect(ANIM_CREATURES).toEqual(expect.arrayContaining(["alien", "cat", "ghost", "slime"]));
        expect(ANIM_CREATURES).not.toEqual(expect.arrayContaining(["bat", "boo", "plant"]));
        expect(sanitizeAnimCreature("cat")).toBe("cat");
        expect(sanitizeAnimCreature("slime")).toBe("slime");
        expect(sanitizeAnimCreature("bat")).toBeNull();
        expect(sanitizeAnimCreature("boo")).toBeNull();
        expect(sanitizeAnimCreature("plant")).toBeNull();
    });

    test("uses sprite-specific travel stances for clean animated creatures", () => {
        expect(pickTravelStance("slime", 120, 0)).toBe("hop");
        expect(pickTravelStance("ghost", 120, 0)).toBe("float");
        expect(pickTravelStance("alien", 320, 0)).toBe("run");
        expect(resolveState("slime", "idle")).toBe("idle");
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
});
