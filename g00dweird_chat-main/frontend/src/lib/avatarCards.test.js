import {
    ANIMATED_AVATAR_CARD_IDS,
    STATIC_AVATAR_CARD_IDS,
    avatarCardAssetFor,
    avatarCardFullSrc,
    avatarCardSquareSrc,
    avatarInitials,
} from "./avatarCards";
import fs from "fs";
import path from "path";

function readPngSize(src) {
    const filePath = path.resolve(process.cwd(), "public", src.replace(/^\//, ""));
    const buffer = fs.readFileSync(filePath);
    expect(buffer.toString("ascii", 1, 4)).toBe("PNG");
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
    };
}

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

    test("stock avatar card images keep fixed full and square dimensions", () => {
        const ids = [...ANIMATED_AVATAR_CARD_IDS, ...STATIC_AVATAR_CARD_IDS];

        ids.forEach((id) => {
            expect(readPngSize(avatarCardFullSrc(id))).toEqual({ width: 720, height: 1080 });
            expect(readPngSize(avatarCardSquareSrc(id))).toEqual({ width: 512, height: 512 });
        });
    });
});
