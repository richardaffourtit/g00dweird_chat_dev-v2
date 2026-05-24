import fs from "fs";
import path from "path";
import {
    ENCHANTED_FOREST_AVATAR_FRAME,
    ENCHANTED_FOREST_WORLD,
    constrainWorldCamera,
    forestAvatarStyleFromMaps,
    movementVectorFromKeys,
    resolveForestMove,
} from "./enchantedForestWorld";

describe("enchanted forest v2 world helpers", () => {
    test("maps keyboard input to normalized eight-way cardinal movement", () => {
        expect(movementVectorFromKeys(new Set(["w"]))).toMatchObject({ x: 0, y: -1, label: "N" });
        expect(movementVectorFromKeys(new Set(["ArrowDown"]))).toMatchObject({ x: 0, y: 1, label: "S" });
        expect(movementVectorFromKeys(new Set(["d"]))).toMatchObject({ x: 1, y: 0, label: "E" });
        expect(movementVectorFromKeys(new Set(["a"]))).toMatchObject({ x: -1, y: 0, label: "W" });

        const ne = movementVectorFromKeys(new Set(["w", "d"]));
        expect(ne.label).toBe("NE");
        expect(Math.hypot(ne.x, ne.y)).toBeCloseTo(1, 5);

        const sw = movementVectorFromKeys(new Set(["z"]));
        expect(sw.label).toBe("SW");
        expect(Math.hypot(sw.x, sw.y)).toBeCloseTo(1, 5);
    });

    test("keeps the zoomed world centered on the avatar without exposing empty edges", () => {
        const viewport = { width: 900, height: 600 };
        const center = constrainWorldCamera(
            { x: 760, y: 380 },
            viewport,
            ENCHANTED_FOREST_WORLD,
            1.62
        );

        expect(center.x + 760 * 1.62).toBeCloseTo(viewport.width / 2, 1);
        expect(center.y + 380 * 1.62).toBeCloseTo(viewport.height / 2, 1);

        const northwest = constrainWorldCamera(
            { x: 18, y: 20 },
            viewport,
            ENCHANTED_FOREST_WORLD,
            1.62
        );

        expect(northwest.x).toBe(0);
        expect(northwest.y).toBe(0);
    });

    test("uses a tighter v2 camera zoom with a small avatar frame", () => {
        expect(ENCHANTED_FOREST_WORLD.zoom).toBeGreaterThanOrEqual(2.35);
        expect(ENCHANTED_FOREST_AVATAR_FRAME.width).toBeLessThanOrEqual(46);
        expect(ENCHANTED_FOREST_AVATAR_FRAME.height).toBeLessThanOrEqual(54);
    });

    test("uses depth and shadow samples for walkability, size, lighting, and contact shadow", () => {
        const dimBack = forestAvatarStyleFromMaps({ depth: 0.22, shadow: 0.15 });
        const brightNear = forestAvatarStyleFromMaps({ depth: 0.82, shadow: 0.74 });

        expect(dimBack.walkable).toBe(true);
        expect(brightNear.scale).toBeGreaterThan(dimBack.scale);
        expect(brightNear.shadowOpacity).toBeGreaterThan(dimBack.shadowOpacity);
        expect(brightNear.zIndex).toBeGreaterThan(dimBack.zIndex);
        expect(dimBack.filter).toContain("brightness");
    });

    test("rejects off-island movement and slides along a walkable axis", () => {
        const sampler = ({ x, y }) => {
            if (x > 500 && y > 300) return { depth: 0.01, shadow: 0 };
            if (x > 500) return { depth: 0.42, shadow: 0.1 };
            if (y > 300) return { depth: 0.02, shadow: 0 };
            return { depth: 0.44, shadow: 0.12 };
        };

        const moved = resolveForestMove(
            { x: 480, y: 280 },
            { x: 540, y: 340 },
            sampler,
            ENCHANTED_FOREST_WORLD
        );

        expect(moved).toEqual({ x: 540, y: 280 });
    });
});

describe("enchanted forest v2 route", () => {
    test("App exposes a fullscreen v2 world route outside the Win95 chat chrome", () => {
        const appSource = fs.readFileSync(path.join(__dirname, "../App.js"), "utf8");

        expect(appSource).toMatch(/EnchantedForestWorld/);
        expect(appSource).toMatch(/path="\/v2"/);
    });
});
