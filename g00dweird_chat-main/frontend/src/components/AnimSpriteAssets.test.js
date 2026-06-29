import fs from "fs";
import path from "path";
import zlib from "zlib";

const CAT_DIR = path.resolve(process.cwd(), "public/anim/cat");
const SLIME_DIR = path.resolve(process.cwd(), "public/anim/slime");

function paeth(left, up, upLeft) {
    const p = left + up - upLeft;
    const pa = Math.abs(p - left);
    const pb = Math.abs(p - up);
    const pc = Math.abs(p - upLeft);
    if (pa <= pb && pa <= pc) return left;
    if (pb <= pc) return up;
    return upLeft;
}

function decodePngAlpha(filePath) {
    const buffer = fs.readFileSync(filePath);
    expect(buffer.toString("ascii", 1, 4)).toBe("PNG");

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    const bitDepth = buffer[24];
    const colorType = buffer[25];
    expect(bitDepth).toBe(8);
    expect(colorType).toBe(6);

    const idatChunks = [];
    let offset = 8;
    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString("ascii", offset + 4, offset + 8);
        if (type === "IDAT") idatChunks.push(buffer.subarray(offset + 8, offset + 8 + length));
        offset += 12 + length;
    }

    const bytesPerPixel = 4;
    const scanlineLength = width * bytesPerPixel;
    const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
    const alpha = Array.from({ length: height }, () => new Uint8Array(width));
    const rgba = Array.from({ length: height }, () => Array(width));
    let sourceOffset = 0;
    let previous = Buffer.alloc(scanlineLength);

    for (let y = 0; y < height; y += 1) {
        const filter = inflated[sourceOffset];
        const raw = inflated.subarray(sourceOffset + 1, sourceOffset + 1 + scanlineLength);
        const row = Buffer.alloc(scanlineLength);
        sourceOffset += 1 + scanlineLength;

        for (let x = 0; x < scanlineLength; x += 1) {
            const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
            const up = previous[x] || 0;
            const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
            if (filter === 0) row[x] = raw[x];
            else if (filter === 1) row[x] = (raw[x] + left) & 255;
            else if (filter === 2) row[x] = (raw[x] + up) & 255;
            else if (filter === 3) row[x] = (raw[x] + Math.floor((left + up) / 2)) & 255;
            else if (filter === 4) row[x] = (raw[x] + paeth(left, up, upLeft)) & 255;
            else throw new Error(`Unsupported PNG filter ${filter}`);
        }

        for (let x = 0; x < width; x += 1) {
            const pixelOffset = x * bytesPerPixel;
            rgba[y][x] = [
                row[pixelOffset],
                row[pixelOffset + 1],
                row[pixelOffset + 2],
                row[pixelOffset + 3],
            ];
            alpha[y][x] = row[pixelOffset + 3];
        }
        previous = row;
    }

    return { width, height, alpha, rgba };
}

function enclosedTransparentPinholes({ width, height, alpha }, maxArea = 80) {
    const seen = Array.from({ length: height }, () => new Uint8Array(width));
    const pinholes = [];

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (alpha[y][x] !== 0 || seen[y][x]) continue;

            const queue = [[x, y]];
            seen[y][x] = 1;
            let touchesBorder = false;
            let area = 0;

            while (queue.length) {
                const [px, py] = queue.shift();
                area += 1;
                if (px === 0 || py === 0 || px === width - 1 || py === height - 1) touchesBorder = true;

                [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]].forEach(([nx, ny]) => {
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
                    if (seen[ny][nx] || alpha[ny][nx] !== 0) return;
                    seen[ny][nx] = 1;
                    queue.push([nx, ny]);
                });
            }

            if (!touchesBorder && area <= maxArea) pinholes.push(area);
        }
    }

    return pinholes;
}

function opaquePixelCount({ width, height, alpha }) {
    let opaque = 0;
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (alpha[y][x] > 0) opaque += 1;
        }
    }
    return opaque;
}

function animationStateName(frameName) {
    return frameName.replace(/_\d+\.png$/, "");
}

function opaqueBounds({ width, height, alpha }) {
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (alpha[y][x] === 0) continue;
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
        }
    }

    return right >= left ? { left, top, right, bottom } : null;
}

function isSlimeBodyPixel([r, g, b, a]) {
    if (a === 0) return false;
    if (r > 190 && g > 190 && b > 185) return false;
    return g > 40 && g >= r + 5 && g >= b + 8;
}

function brightness([r, g, b]) {
    return (r + g + b) / 3;
}

function colorDistance(a, b) {
    return (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3;
}

function verticalSlimeBodyBands(decoded) {
    const bounds = opaqueBounds(decoded);
    if (!bounds) return [];
    const bands = [];

    for (let x = bounds.left + 8; x <= bounds.right - 8; x += 1) {
        let darkContrastPixels = 0;

        for (let y = bounds.top + 5; y <= bounds.bottom - 5; y += 1) {
            const pixel = decoded.rgba[y][x];
            const left = decoded.rgba[y][x - 1];
            const right = decoded.rgba[y][x + 1];
            if (!isSlimeBodyPixel(pixel) || !isSlimeBodyPixel(left) || !isSlimeBodyPixel(right)) continue;
            if (brightness(pixel) + 28 < Math.min(brightness(left), brightness(right))) {
                darkContrastPixels += 1;
            }
        }

        if (darkContrastPixels >= 22) bands.push({ x, darkContrastPixels });
    }

    return bands;
}

function directionalBodyDiffRatio(decoded) {
    const bounds = opaqueBounds(decoded);
    if (!bounds) return 0;
    const horizontalDiffs = [];
    const verticalDiffs = [];

    for (let y = bounds.top; y <= bounds.bottom; y += 1) {
        for (let x = bounds.left; x <= bounds.right; x += 1) {
            const pixel = decoded.rgba[y][x];
            if (!isSlimeBodyPixel(pixel)) continue;

            if (x + 1 <= bounds.right && isSlimeBodyPixel(decoded.rgba[y][x + 1])) {
                horizontalDiffs.push(colorDistance(pixel, decoded.rgba[y][x + 1]));
            }
            if (y + 1 <= bounds.bottom && isSlimeBodyPixel(decoded.rgba[y + 1][x])) {
                verticalDiffs.push(colorDistance(pixel, decoded.rgba[y + 1][x]));
            }
        }
    }

    const horizontal = horizontalDiffs.reduce((sum, value) => sum + value, 0) / horizontalDiffs.length;
    const vertical = verticalDiffs.reduce((sum, value) => sum + value, 0) / verticalDiffs.length;
    return vertical / horizontal;
}

function outlineAlphaChips({ width, height, alpha }, minNeighbors = 7) {
    const chips = [];
    for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
            if (alpha[y][x] !== 0) continue;
            let opaqueNeighbors = 0;
            for (let dy = -1; dy <= 1; dy += 1) {
                for (let dx = -1; dx <= 1; dx += 1) {
                    if (dx === 0 && dy === 0) continue;
                    if (alpha[y + dy][x + dx] > 0) opaqueNeighbors += 1;
                }
            }
            if (opaqueNeighbors >= minNeighbors) chips.push({ x, y, opaqueNeighbors });
        }
    }
    return chips;
}

describe("animated sprite asset alpha", () => {
    test("cat frames have no enclosed transparent pinholes", () => {
        const badFrames = fs.readdirSync(CAT_DIR)
            .filter((name) => name.endsWith(".png"))
            .map((name) => {
                const pinholes = enclosedTransparentPinholes(decodePngAlpha(path.join(CAT_DIR, name)));
                return pinholes.length ? { name, pinholes } : null;
            })
            .filter(Boolean);

        expect(badFrames).toEqual([]);
    });

    test("slime frames have opaque body interiors", () => {
        const transparentBodyFrames = fs.readdirSync(SLIME_DIR)
            .filter((name) => name.endsWith(".png"))
            .map((name) => {
                const pinholes = enclosedTransparentPinholes(decodePngAlpha(path.join(SLIME_DIR, name)), Infinity);
                return pinholes.length ? { name, pinholes } : null;
            })
            .filter(Boolean);

        expect(transparentBodyFrames).toEqual([]);
    });

    test("slime animated states do not include sparse transparent flash frames", () => {
        const statesToStabilize = new Set(["attack", "hop", "idle", "split", "wiggle"]);
        const framesByState = fs.readdirSync(SLIME_DIR)
            .filter((name) => name.endsWith(".png"))
            .reduce((groups, name) => {
                const state = animationStateName(name);
                if (!statesToStabilize.has(state)) return groups;
                const decoded = decodePngAlpha(path.join(SLIME_DIR, name));
                groups[state] = groups[state] || [];
                groups[state].push({ name, opaque: opaquePixelCount(decoded) });
                return groups;
            }, {});

        const sparseFrames = Object.entries(framesByState).flatMap(([state, frames]) => {
            const maxOpaque = Math.max(...frames.map((frame) => frame.opaque));
            return frames
                .filter((frame) => frame.opaque < maxOpaque * 0.62)
                .map((frame) => ({ state, name: frame.name, opaque: frame.opaque, maxOpaque }));
        });

        expect(sparseFrames).toEqual([]);
    });

    test("slime body frames do not contain hard vertical stripe bands", () => {
        const stripedFrames = fs.readdirSync(SLIME_DIR)
            .filter((name) => name.endsWith(".png"))
            .map((name) => {
                const bands = verticalSlimeBodyBands(decodePngAlpha(path.join(SLIME_DIR, name)));
                return bands.length ? { name, bands } : null;
            })
            .filter(Boolean);

        expect(stripedFrames).toEqual([]);
    });

    test("slime body texture is not dominated by horizontal bands", () => {
        const rowBandedFrames = fs.readdirSync(SLIME_DIR)
            .filter((name) => name.endsWith(".png"))
            .map((name) => {
                const ratio = directionalBodyDiffRatio(decodePngAlpha(path.join(SLIME_DIR, name)));
                return ratio > 1.55 ? { name, ratio: Number(ratio.toFixed(2)) } : null;
            })
            .filter(Boolean);

        expect(rowBandedFrames).toEqual([]);
    });

    test("slime outlines have no surrounded transparent cutout chips", () => {
        const chippedFrames = fs.readdirSync(SLIME_DIR)
            .filter((name) => name.endsWith(".png"))
            .map((name) => {
                const chips = outlineAlphaChips(decodePngAlpha(path.join(SLIME_DIR, name)));
                return chips.length ? { name, chips } : null;
            })
            .filter(Boolean);

        expect(chippedFrames).toEqual([]);
    });

    test("slime sleep pose keeps a visible slime body", () => {
        const sleepFrame = decodePngAlpha(path.join(SLIME_DIR, "emote_d_0.png"));
        expect(opaquePixelCount(sleepFrame)).toBeGreaterThanOrEqual(5600);
    });
});
