import fs from "fs";
import path from "path";
import { WORLD_ICON_URLS } from "./worldIcons";

const worlds = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "../../../backend/worlds/manifests.json"),
    "utf8"
));
const publicDir = path.resolve(__dirname, "../../public");

describe("world picker icon coverage", () => {
    test("dedicated picker icons cover the backend world registry", () => {
        expect(Object.keys(WORLD_ICON_URLS).sort()).toEqual(
            worlds.map((world) => world.theme || world.id).sort()
        );
    });

    test.each(worlds)("$id ships its dedicated picker PNG", (world) => {
        const url = WORLD_ICON_URLS[world.theme || world.id];
        expect(url).toBe(`/assets/world-icons/${world.id}.png`);
        const iconPath = path.join(publicDir, url);
        expect(fs.existsSync(iconPath)).toBe(true);
        const png = fs.readFileSync(iconPath);
        expect(png.subarray(0, 8)).toEqual(
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
        );
        // Full-room thumbnails must not replace the small transparent icons.
        expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([96, 96]);
        expect(png[25]).toBe(6); // PNG RGBA color type.
    });
});
