import fs from "fs";
import path from "path";
import zlib from "zlib";

const CAT_DIR = path.resolve(process.cwd(), "public/anim/cat");
const SLIME_DIR = path.resolve(process.cwd(), "public/anim/slime");
const TEE_KAE_DIR = path.resolve(process.cwd(), "public/anim/teekae");

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

function opaqueWidthBelow({ width, height, alpha }, startY) {
    let left = width;
    let right = -1;
    for (let y = Math.max(0, startY); y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (alpha[y][x] === 0) continue;
            left = Math.min(left, x);
            right = Math.max(right, x);
        }
    }
    return right >= left ? right - left + 1 : 0;
}

function opaqueWidthBetween({ width, height, alpha }, startY, endY) {
    let left = width;
    let right = -1;
    for (let y = Math.max(0, startY); y < Math.min(height, endY); y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (alpha[y][x] === 0) continue;
            left = Math.min(left, x);
            right = Math.max(right, x);
        }
    }
    return right >= left ? right - left + 1 : 0;
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

function bodyBrightnessMedian(decoded) {
    const values = largestSlimeBodyPoints(decoded).map(({ x, y }) => brightness(decoded.rgba[y][x]));
    values.sort((a, b) => a - b);
    return values.length ? values[Math.floor(values.length / 2)] : 0;
}

function pointsBounds(points) {
    const xs = points.map(({ x }) => x);
    const ys = points.map(({ y }) => y);
    return {
        left: Math.min(...xs),
        top: Math.min(...ys),
        right: Math.max(...xs),
        bottom: Math.max(...ys),
        width: Math.max(...xs) - Math.min(...xs) + 1,
        height: Math.max(...ys) - Math.min(...ys) + 1,
    };
}

function largestSlimeBodyPoints(decoded) {
    const seen = Array.from({ length: decoded.height }, () => new Uint8Array(decoded.width));
    const components = [];

    for (let y = 0; y < decoded.height; y += 1) {
        for (let x = 0; x < decoded.width; x += 1) {
            if (seen[y][x] || !isSlimeBodyPixel(decoded.rgba[y][x])) continue;
            const queue = [{ x, y }];
            seen[y][x] = 1;
            const points = [];

            while (queue.length) {
                const point = queue.shift();
                points.push(point);
                [[point.x - 1, point.y], [point.x + 1, point.y], [point.x, point.y - 1], [point.x, point.y + 1]].forEach(([nx, ny]) => {
                    if (nx < 0 || ny < 0 || nx >= decoded.width || ny >= decoded.height) return;
                    if (seen[ny][nx] || !isSlimeBodyPixel(decoded.rgba[ny][nx])) return;
                    seen[ny][nx] = 1;
                    queue.push({ x: nx, y: ny });
                });
            }

            components.push(points);
        }
    }

    components.sort((a, b) => b.length - a.length);
    return components[0] || [];
}

function alphaComponents(decoded) {
    const seen = Array.from({ length: decoded.height }, () => new Uint8Array(decoded.width));
    const components = [];

    for (let y = 0; y < decoded.height; y += 1) {
        for (let x = 0; x < decoded.width; x += 1) {
            if (seen[y][x] || decoded.alpha[y][x] === 0) continue;
            const queue = [{ x, y }];
            seen[y][x] = 1;
            const points = [];

            while (queue.length) {
                const point = queue.shift();
                points.push(point);
                [[point.x - 1, point.y], [point.x + 1, point.y], [point.x, point.y - 1], [point.x, point.y + 1]].forEach(([nx, ny]) => {
                    if (nx < 0 || ny < 0 || nx >= decoded.width || ny >= decoded.height) return;
                    if (seen[ny][nx] || decoded.alpha[ny][nx] === 0) return;
                    seen[ny][nx] = 1;
                    queue.push({ x: nx, y: ny });
                });
            }

            components.push(points);
        }
    }

    components.sort((a, b) => b.length - a.length);
    return components;
}

function transparentRowInteriorLeaks(decoded) {
    const leaks = [];
    const bodyPoints = largestSlimeBodyPoints(decoded);
    const bodyByRow = bodyPoints.reduce((rows, point) => {
        rows[point.y] = rows[point.y] || [];
        rows[point.y].push(point.x);
        return rows;
    }, {});

    for (let y = 0; y < decoded.height; y += 1) {
        const bodyXs = bodyByRow[y] || [];
        if (bodyXs.length < 8) continue;

        const left = Math.min(...bodyXs);
        const right = Math.max(...bodyXs);
        for (let x = left; x <= right; x += 1) {
            if (decoded.alpha[y][x] !== 0) continue;

            let nearbyBody = 0;
            for (let dy = -3; dy <= 3; dy += 1) {
                for (let dx = -3; dx <= 3; dx += 1) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= decoded.width || ny >= decoded.height) continue;
                    if (isSlimeBodyPixel(decoded.rgba[ny][nx])) nearbyBody += 1;
                }
            }
            if (nearbyBody >= 10) leaks.push({ x, y });
        }
    }
    return leaks;
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

function isWhiteFeaturePixel([r, g, b, a]) {
    return a > 0 && r > 180 && g > 180 && b > 165;
}

function isCleanDarkOutlinePixel([r, g, b, a]) {
    return a > 0 && r < 45 && g < 55 && b < 45;
}

function isSlimeOutlineMudPixel(pixel) {
    const [r, g, b, a] = pixel;
    if (a === 0 || isSlimeBodyPixel(pixel) || isWhiteFeaturePixel(pixel)) return false;
    return (r < 95 && g < 90 && b < 65) || (r > 55 && g < 85 && b < 70);
}

function hasNearbyPixel(decoded, x, y, radius, predicate) {
    for (let ny = Math.max(0, y - radius); ny <= Math.min(decoded.height - 1, y + radius); ny += 1) {
        for (let nx = Math.max(0, x - radius); nx <= Math.min(decoded.width - 1, x + radius); nx += 1) {
            if (predicate(decoded.rgba[ny][nx], nx, ny)) return true;
        }
    }
    return false;
}

function nearbySlimeBodyCount(decoded, x, y, radius) {
    let count = 0;
    for (let ny = Math.max(0, y - radius); ny <= Math.min(decoded.height - 1, y + radius); ny += 1) {
        for (let nx = Math.max(0, x - radius); nx <= Math.min(decoded.width - 1, x + radius); nx += 1) {
            if (isSlimeBodyPixel(decoded.rgba[ny][nx])) count += 1;
        }
    }
    return count;
}

function slimeOutlineIntrusions(decoded) {
    const intrusions = [];
    for (let y = 0; y < decoded.height; y += 1) {
        for (let x = 0; x < decoded.width; x += 1) {
            if (!isSlimeOutlineMudPixel(decoded.rgba[y][x])) continue;
            if (hasNearbyPixel(decoded, x, y, 5, (pixel) => pixel[3] === 0)) continue;
            if (hasNearbyPixel(decoded, x, y, 7, isWhiteFeaturePixel)) continue;
            if (nearbySlimeBodyCount(decoded, x, y, 3) >= 24) intrusions.push({ x, y });
        }
    }
    return intrusions;
}

function whiteEyeEdgeGaps(decoded) {
    const gaps = [];
    for (let y = 1; y < decoded.height - 1; y += 1) {
        for (let x = 1; x < decoded.width - 1; x += 1) {
            if (!isWhiteFeaturePixel(decoded.rgba[y][x])) continue;
            const touchesBody = hasNearbyPixel(decoded, x, y, 1, (pixel) => isSlimeBodyPixel(pixel));
            if (!touchesBody) continue;
            const hasDarkSeparator = hasNearbyPixel(decoded, x, y, 1, isCleanDarkOutlinePixel);
            if (!hasDarkSeparator) gaps.push({ x, y });
        }
    }
    return gaps;
}

describe("animated sprite asset alpha", () => {
    test("Tee Kae ships a complete transparent, bottom-anchored frame family", () => {
        const expectedFiles = [
            "idle_0.png", "idle_1.png", "idle_2.png",
            "walk_0.png", "walk_1.png", "walk_2.png",
            "walk_3.png", "walk_4.png", "walk_5.png",
            "attack_0.png", "attack_1.png", "attack_2.png", "attack_3.png",
            "hurt_0.png",
            "die_0.png", "die_1.png", "die_2.png", "die_3.png",
            "emote_a_0.png", "emote_b_0.png", "emote_c_0.png", "emote_d_0.png",
        ].sort();
        const actualFiles = fs.readdirSync(TEE_KAE_DIR)
            .filter((name) => name.endsWith(".png"))
            .sort();

        expect(actualFiles).toEqual(expectedFiles);

        actualFiles.forEach((name) => {
            const decoded = decodePngAlpha(path.join(TEE_KAE_DIR, name));
            const state = animationStateName(name);
            const expectedWidth = state === "attack" ? 520 : (["die", "hurt"].includes(state) ? 280 : 180);
            const corners = [
                decoded.alpha[0][0],
                decoded.alpha[0][decoded.width - 1],
                decoded.alpha[decoded.height - 1][0],
                decoded.alpha[decoded.height - 1][decoded.width - 1],
            ];
            const bounds = opaqueBounds(decoded);
            const opaque = opaquePixelCount(decoded);

            expect(decoded.width).toBe(expectedWidth);
            expect(decoded.height).toBe(224);
            expect(corners).toEqual([0, 0, 0, 0]);
            expect(bounds?.bottom).toBe(219);
            expect(opaque).toBeGreaterThan(8000);
            expect(opaque / (decoded.width * decoded.height)).toBeLessThan(0.5);
        });
    });

    test("Tee Kae uses the upright dizzy pose for hurt", () => {
        const hurt = fs.readFileSync(path.join(TEE_KAE_DIR, "hurt_0.png"));
        const firstDie = fs.readFileSync(path.join(TEE_KAE_DIR, "die_0.png"));
        expect(hurt.equals(firstDie)).toBe(true);
    });

    test("Tee Kae walk alternates between contact and passing silhouettes", () => {
        const lowerBodyWidths = Array.from({ length: 6 }, (_, frame) => (
            opaqueWidthBelow(
                decodePngAlpha(path.join(TEE_KAE_DIR, `walk_${frame}.png`)),
                160
            )
        ));

        expect(Math.max(...lowerBodyWidths) - Math.min(...lowerBodyWidths)).toBeGreaterThan(30);
    });

    test("Tee Kae keeps the same head scale between idle and walk", () => {
        const headWidth = (name) => {
            const decoded = decodePngAlpha(path.join(TEE_KAE_DIR, name));
            const bounds = opaqueBounds(decoded);
            return opaqueWidthBetween(decoded, bounds.top, bounds.top + 24);
        };
        const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
        const idleAverage = average(["idle_0.png", "idle_1.png", "idle_2.png"].map(headWidth));
        const walkAverage = average(Array.from({ length: 6 }, (_, frame) => headWidth(`walk_${frame}.png`)));

        expect(Math.abs(idleAverage - walkAverage)).toBeLessThanOrEqual(2);
    });

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

    test("slime hop frames keep outline debris outside the body fill", () => {
        const muddyHopFrames = ["hop_0.png", "hop_1.png", "hop_2.png", "hop_3.png"]
            .map((name) => {
                const intrusions = slimeOutlineIntrusions(decodePngAlpha(path.join(SLIME_DIR, name)));
                return intrusions.length ? { name, intrusions: intrusions.slice(0, 12), intrusionCount: intrusions.length } : null;
            })
            .filter(Boolean);

        expect(muddyHopFrames).toEqual([]);
    });

    test("slime eye whites keep a clean dark outline against body fill", () => {
        const gappyEyeFrames = ["idle_0.png", "idle_1.png", "idle_2.png", "hop_0.png", "hop_1.png", "hop_2.png", "hop_3.png"]
            .map((name) => {
                const gaps = whiteEyeEdgeGaps(decodePngAlpha(path.join(SLIME_DIR, name)));
                return gaps.length ? { name, gaps: gaps.slice(0, 12), gapCount: gaps.length } : null;
            })
            .filter(Boolean);

        expect(gappyEyeFrames).toEqual([]);
    });

    test("slime body row interiors do not leak transparent pixels", () => {
        const leakingFrames = fs.readdirSync(SLIME_DIR)
            .filter((name) => name.endsWith(".png"))
            .map((name) => {
                const leaks = transparentRowInteriorLeaks(decodePngAlpha(path.join(SLIME_DIR, name)));
                return leaks.length ? { name, leaks: leaks.slice(0, 12), leakCount: leaks.length } : null;
            })
            .filter(Boolean);

        expect(leakingFrames).toEqual([]);
    });

    test("slime idle frames keep consistent body brightness", () => {
        const medians = ["idle_0.png", "idle_1.png", "idle_2.png"].map((name) => ({
            name,
            median: bodyBrightnessMedian(decodePngAlpha(path.join(SLIME_DIR, name))),
        }));
        const spread = Math.max(...medians.map((frame) => frame.median)) - Math.min(...medians.map((frame) => frame.median));

        expect({ medians, spread: Number(spread.toFixed(2)) }).toMatchObject({ spread: expect.any(Number) });
        expect(spread).toBeLessThanOrEqual(3);
    });

    test("slime idle body height stays close to hop travel height", () => {
        const idleHeights = ["idle_0.png", "idle_1.png", "idle_2.png"].map((name) => ({
            name,
            height: pointsBounds(largestSlimeBodyPoints(decodePngAlpha(path.join(SLIME_DIR, name)))).height,
        }));
        const hopHeights = ["hop_0.png", "hop_1.png", "hop_2.png", "hop_3.png"].map((name) => ({
            name,
            height: pointsBounds(largestSlimeBodyPoints(decodePngAlpha(path.join(SLIME_DIR, name)))).height,
        }));
        const sortedHopHeights = hopHeights.map(({ height }) => height).sort((a, b) => a - b);
        const hopMedian = sortedHopHeights[Math.floor(sortedHopHeights.length / 2)];
        const maxIdleHeight = Math.max(...idleHeights.map(({ height }) => height));

        expect({ idleHeights, hopHeights, hopMedian, maxIdleHeight }).toMatchObject({
            hopMedian: expect.any(Number),
            maxIdleHeight: expect.any(Number),
        });
        expect(maxIdleHeight).toBeLessThanOrEqual(hopMedian + 5);
    });

    test("slime frames do not keep disconnected rotoscope debris", () => {
        const debrisFrames = fs.readdirSync(SLIME_DIR)
            .filter((name) => name.endsWith(".png"))
            .map((name) => {
                const components = alphaComponents(decodePngAlpha(path.join(SLIME_DIR, name)));
                const debris = components.slice(1).filter((component) => component.length <= 20);
                return debris.length
                    ? {
                        name,
                        debris: debris.map((component) => ({
                            pixels: component.length,
                            bounds: pointsBounds(component),
                        })),
                    }
                    : null;
            })
            .filter(Boolean);

        expect(debrisFrames).toEqual([]);
    });

    test("slime sleep frame keeps the sleeping pose instead of the standing idle pose", () => {
        const sleepFrame = decodePngAlpha(path.join(SLIME_DIR, "emote_d_0.png"));
        const bounds = opaqueBounds(sleepFrame);

        expect(bounds).toEqual(expect.objectContaining({ left: expect.any(Number), right: expect.any(Number) }));
        expect(bounds.left).toBeLessThanOrEqual(30);
        expect(bounds.right - bounds.left).toBeGreaterThanOrEqual(110);
    });

    test("slime sleep pose keeps a visible slime body", () => {
        const sleepFrame = decodePngAlpha(path.join(SLIME_DIR, "emote_d_0.png"));
        expect(opaquePixelCount(sleepFrame)).toBeGreaterThanOrEqual(3900);
    });
});
