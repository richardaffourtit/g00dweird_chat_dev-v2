import fs from "fs";
import path from "path";
import zlib from "zlib";

const MARS_ROVER_ASSET_DIR = path.join(__dirname, "../../public/assets/mars-rover");
const MARS_ROVER_FILES = ["right", "back", "left", "front"].flatMap((direction) => (
    [0, 1, 2, 3].map((frame) => `${direction}_${frame}.png`)
));

function paethPredictor(left, up, upperLeft) {
    const estimate = left + up - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
    return upDistance <= upperLeftDistance ? up : upperLeft;
}

function readRgbaPng(filePath) {
    const buffer = fs.readFileSync(filePath);
    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const idatChunks = [];

    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString("ascii", offset + 4, offset + 8);
        const data = buffer.subarray(offset + 8, offset + 8 + length);
        if (type === "IHDR") {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data[8];
            colorType = data[9];
        } else if (type === "IDAT") {
            idatChunks.push(data);
        } else if (type === "IEND") {
            break;
        }
        offset += length + 12;
    }

    expect(bitDepth).toBe(8);
    expect(colorType).toBe(6);

    const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
    const rowBytes = width * 4;
    const pixels = new Uint8Array(width * height * 4);
    let sourceOffset = 0;
    let outputOffset = 0;
    let previous = new Uint8Array(rowBytes);
    let current = new Uint8Array(rowBytes);

    for (let y = 0; y < height; y += 1) {
        const filter = inflated[sourceOffset];
        sourceOffset += 1;
        for (let x = 0; x < rowBytes; x += 1) {
            const value = inflated[sourceOffset];
            sourceOffset += 1;
            const left = x >= 4 ? current[x - 4] : 0;
            const up = previous[x];
            const upperLeft = x >= 4 ? previous[x - 4] : 0;
            if (filter === 0) current[x] = value;
            else if (filter === 1) current[x] = (value + left) & 255;
            else if (filter === 2) current[x] = (value + up) & 255;
            else if (filter === 3) current[x] = (value + Math.floor((left + up) / 2)) & 255;
            else if (filter === 4) current[x] = (value + paethPredictor(left, up, upperLeft)) & 255;
            else throw new Error(`Unsupported PNG filter ${filter}`);
        }
        pixels.set(current, outputOffset);
        outputOffset += rowBytes;
        [previous, current] = [current, previous];
        current.fill(0);
    }

    return { width, height, pixels };
}

function marsRoverFrameMetrics(fileName) {
    const image = readRgbaPng(path.join(MARS_ROVER_ASSET_DIR, fileName));
    const { width, height, pixels } = image;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    const edgeAlpha = { left: 0, right: 0, top: 0, bottom: 0 };

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const alpha = pixels[(y * width + x) * 4 + 3];
            if (!alpha) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            if (x === 0) edgeAlpha.left += 1;
            if (x === width - 1) edgeAlpha.right += 1;
            if (y === 0) edgeAlpha.top += 1;
            if (y === height - 1) edgeAlpha.bottom += 1;
        }
    }

    let weightedX = 0;
    let alphaSum = 0;
    for (let y = Math.max(minY, maxY - 24); y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
            const alpha = pixels[(y * width + x) * 4 + 3];
            if (!alpha) continue;
            weightedX += x * alpha;
            alphaSum += alpha;
        }
    }

    return {
        width,
        height,
        edgeAlpha,
        bbox: { minX, minY, maxX, maxY },
        platformX: weightedX / alphaSum,
        platformY: maxY,
    };
}

function marsRoverAlphaInRect(fileName, rect) {
    const { width, pixels } = readRgbaPng(path.join(MARS_ROVER_ASSET_DIR, fileName));
    let count = 0;

    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
        for (let x = rect.x; x < rect.x + rect.w; x += 1) {
            const alpha = pixels[(y * width + x) * 4 + 3];
            if (alpha) count += 1;
        }
    }

    return count;
}

const MARS_ROVER_CANVAS_PAD_PX = 12;
const MARS_ROVER_BASE_SIDE_PAD_PX = 2;
const MARS_ROVER_SIDE_PAD_PX = 10;
const MARS_ROVER_SIDE_PAD_TOTAL_PX = MARS_ROVER_BASE_SIDE_PAD_PX + MARS_ROVER_SIDE_PAD_PX;
const EXPECTED_WIDTH = 398 + (MARS_ROVER_CANVAS_PAD_PX * 2) + (MARS_ROVER_SIDE_PAD_TOTAL_PX * 2);
const EXPECTED_HEIGHT = 306 + (MARS_ROVER_CANVAS_PAD_PX * 2);
const EXPECTED_PLATFORM_X = 199 + MARS_ROVER_CANVAS_PAD_PX + MARS_ROVER_SIDE_PAD_PX;
const EXPECTED_PLATFORM_Y = 293 + MARS_ROVER_CANVAS_PAD_PX;
const EXPECTED_PLATFORM_X_TOLERANCE = 16;
const MARS_ROVER_REPAIR_REGIONS = [
    { fileName: "back_3.png", rect: { x: 82, y: 151, w: 94, h: 97 }, minAlpha: 4500 },
    { fileName: "left_3.png", rect: { x: 71, y: 189, w: 105, h: 97 }, minAlpha: 6500 },
    { fileName: "front_2.png", rect: { x: 126, y: 180, w: 68, h: 125 }, minAlpha: 7900 },
    { fileName: "front_3.png", rect: { x: 145, y: 180, w: 62, h: 126 }, minAlpha: 7000 },
    { fileName: "right_3.png", rect: { x: 98, y: 231, w: 62, h: 68 }, minAlpha: 3600 },
    { fileName: "right_3.png", rect: { x: 76, y: 236, w: 28, h: 62 }, minAlpha: 500 },
];

describe("iso world avatar rendering styles", () => {
    test("avatar anchors do not paint-contain overflowing sprites", () => {
        const css = fs.readFileSync(path.join(__dirname, "../index.css"), "utf8");
        const match = css.match(/\.avatar-anchor\s*\{(?<rules>[^}]+)\}/);

        expect(match?.groups?.rules).toBeTruthy();
        expect(match.groups.rules).not.toMatch(/contain:[^;]*\bpaint\b/);
    });

    test("inverted thought clouds are placed below the avatar body", () => {
        const source = fs.readFileSync(path.join(__dirname, "IsoWorld.jsx"), "utf8");

        expect(source).toMatch(/\.\.\.\(placeBelow \? \{ top: `calc\(100% \+ \$\{belowOffset\}px\)` \}/);
    });

    test("thought clouds anchor against the avatar body instead of the world anchor", () => {
        const css = fs.readFileSync(path.join(__dirname, "../index.css"), "utf8");
        const source = fs.readFileSync(path.join(__dirname, "IsoWorld.jsx"), "utf8");
        const match = css.match(/\.avatar-bob\s*\{(?<rules>[^}]+)\}/);

        expect(match?.groups?.rules).toMatch(/position:\s*relative/);
        expect(source).toMatch(/const avatarBoxSize = avatarCssSize\(u\)/);
        expect(source).toMatch(/const thoughtBubbleBelow = displayY < 320 \|\| displayCss\.y - avatarBoxSize\.height - 126 < 6/);
        expect(source).toMatch(/placeBelow=\{thoughtBubbleBelow\}/);
        expect(source).toMatch(/avatarWidth=\{thoughtBubbleWidth\}/);
        expect(source).toMatch(/avatarHeight=\{thoughtBubbleHeight\}/);
    });

    test("thought text is centered inside variant text boxes", () => {
        const source = fs.readFileSync(path.join(__dirname, "IsoWorld.jsx"), "utf8");

        expect(source).toMatch(/data-thought-text-box=\{`\$\{variant\.id\}:/);
        expect(source).toMatch(/placeItems:\s*"center"/);
        expect(source).not.toMatch(/fullfunkShortTextShift/);
    });

    test("basketball court launches local shots from click and tap input", () => {
        const source = fs.readFileSync(path.join(__dirname, "IsoWorld.jsx"), "utf8");

        expect(source).toMatch(/lastLocalHoopShotAtRef\.current = Date\.now\(\)/);
        expect(source).toMatch(/processedShotIdsRef\.current\.add\(shot\.id\)/);
        expect(source).toMatch(/setBasketballs\(\(balls\) => \[\s*\.\.\.balls,\s*buildBasketball\(\{ \.\.\.shot, user_id: myId, nickname: me\?\.nickname \}\),\s*\]\.slice\(-MAX_BASKETBALLS\)\)/);
        expect(source).toMatch(/if \(Date\.now\(\) - lastLocalHoopShotAtRef\.current > BASKETBALL_CLICK_SHOT_GUARD_MS\) \{\s*launchBasketball\(p\);/);
        expect(source).toMatch(/const p = stagePoint\(e\.touches\[0\]\.clientX, e\.touches\[0\]\.clientY\);\s*launchBasketball\(p\);\s*setAimShot\(null\);/);
        expect(source).toMatch(/if \(e\.pointerType === "touch"\) return/);
    });

    test("basketballs use a smooth settling path and remain on the court", () => {
        const source = fs.readFileSync(path.join(__dirname, "IsoWorld.jsx"), "utf8");
        const css = fs.readFileSync(path.join(__dirname, "../index.css"), "utf8");

        expect(source).toMatch(/BASKETBALL_SHOT_SAMPLE_COUNT = 96/);
        expect(source).toMatch(/BASKETBALL_COURT_POLYGON = \[/);
        expect(source).toMatch(/BASKETBALL_HOOP_FLOOR/);
        expect(source).toMatch(/function basketballShotSamples\(ball, target, made\)/);
        expect(source).toMatch(/function basketballCourtYBoundsAtX\(x\)/);
        expect(source).toMatch(/function basketballClampToCourt\(point\)/);
        expect(source).toMatch(/function basketballAdvanceOnCourt\(point, vector, distance\)/);
        expect(source).toMatch(/groundY: ground\.y/);
        expect(source).toMatch(/basketballShotHeight\(point\)/);
        expect(source).toMatch(/root\.animate\(rootFrames, \{ duration: durationMs, easing: "linear", fill: "forwards" \}\)/);
        expect(source).toMatch(/root\.dataset\.shotSamples = String\(samples\.length\)/);
        expect(source).toMatch(/root\.dataset\.courtPlane = "iso"/);
        expect(source).toMatch(/root\.dataset\.courtGeometry = "polygon"/);
        expect(source).toMatch(/root\.style\.transform = finalRootFrame\.transform/);
        expect(source).toMatch(/BASKETBALL_FLIGHT_END_PROGRESS/);
        expect(source).toMatch(/scoreTimerRef\.current = setTimeout/);
        expect(source).not.toMatch(/onDone\?\.\(ball\.id\)/);
        expect(css).not.toMatch(/@keyframes\s+basketballShotFlight/);
        expect(css).not.toMatch(/@keyframes\s+basketballShotShadow/);
    });

    test("mars rover uses preloaded frames and transform-only patrol motion", () => {
        const css = fs.readFileSync(path.join(__dirname, "../index.css"), "utf8");
        const source = fs.readFileSync(path.join(__dirname, "IsoWorld.jsx"), "utf8");
        const roverMatch = css.match(/\.mars-rover-layer\s*\{(?<rules>[^}]+)\}/);

        expect(source).toMatch(/MARS_ROVER_PATROL_MS/);
        expect(source).toMatch(/MARS_ROVER_PLATFORM_ANCHOR/);
        expect(source).toMatch(/--rover-frame-offset-x/);
        expect(source).toMatch(/data-direction=\{direction\}/);
        expect(roverMatch?.groups?.rules).toMatch(/will-change:\s*transform/);
        expect(roverMatch?.groups?.rules).toMatch(/transform-origin:\s*0 0/);
        expect(roverMatch?.groups?.rules).not.toMatch(/animation:/);
        expect(css).not.toMatch(/content:\s*url\("\/assets\/mars-rover\//);
        expect(css).not.toMatch(/@keyframes\s+marsRoverPatrol/);
    });

    test("mars rover frames share one uncropped platform anchor", () => {
        for (const fileName of MARS_ROVER_FILES) {
            const metrics = marsRoverFrameMetrics(fileName);

            expect(metrics.width).toBe(EXPECTED_WIDTH);
            expect(metrics.height).toBe(EXPECTED_HEIGHT);
            expect(metrics.edgeAlpha).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
            expect(metrics.bbox.minX).toBeGreaterThan(0);
            expect(metrics.bbox.minY).toBeGreaterThan(0);
            expect(metrics.bbox.maxX).toBeLessThan(metrics.width - 1);
            expect(metrics.bbox.maxY).toBeLessThan(metrics.height - 1);
            expect(Math.abs(metrics.platformX - EXPECTED_PLATFORM_X)).toBeLessThanOrEqual(EXPECTED_PLATFORM_X_TOLERANCE);
            expect(metrics.platformY).toBe(EXPECTED_PLATFORM_Y);
        }
    });

    test("mars rover frames keep artwork in previously cropped interior regions", () => {
        for (const { fileName, rect, minAlpha } of MARS_ROVER_REPAIR_REGIONS) {
            expect(marsRoverAlphaInRect(fileName, rect)).toBeGreaterThanOrEqual(minAlpha);
        }
    });
});
