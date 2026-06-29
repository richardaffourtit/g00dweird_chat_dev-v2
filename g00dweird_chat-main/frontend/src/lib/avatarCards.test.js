import {
    avatarCardAssetFor,
    avatarCardFullSrc,
    avatarCardSquareSrc,
    avatarInitials,
} from "./avatarCards";

describe("avatar card helpers", () => {
    test("builds readable initials from one or more words", () => {
        expect(avatarInitials("rich ford")).toBe("RF");
        expect(avatarInitials("weirdbot")).toBe("W");
        expect(avatarInitials("  ")).toBe("??");
    });

    test("animated stock avatars resolve before static sprites", () => {
        expect(avatarCardAssetFor({ animId: "ape", spriteId: "ghost_cute" })?.id).toBe("ape");
        expect(avatarCardSquareSrc("ape")).toBe("/assets/avatar-cards/square/ape.png");
        expect(avatarCardFullSrc("ape")).toBe("/assets/avatar-cards/full/ape.png");
    });

    test("static stock avatars resolve when no animated avatar is selected", () => {
        expect(avatarCardAssetFor({ spriteId: "ghost_cute" })?.id).toBe("ghost_cute");
        expect(avatarCardAssetFor({ animId: "not-real", spriteId: "ghost_cute" })?.id).toBe("ghost_cute");
    });

    test("unknown stock avatars return null", () => {
        expect(avatarCardAssetFor({ animId: "nope", spriteId: "also-nope" })).toBeNull();
        expect(avatarCardSquareSrc("nope")).toBeNull();
        expect(avatarCardFullSrc("nope")).toBeNull();
    });
});
