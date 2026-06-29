import fs from "fs";
import path from "path";
import zlib from "zlib";

const GLYPH_DIR = path.resolve(process.cwd(), "public/wall/glyphs");
const MANIFEST_PATH = path.join(GLYPH_DIR, "manifest.json");

function readPngInfo(filePath) {
    const buffer = fs.readFileSync(filePath);
    expect(buffer.toString("ascii", 1, 4)).toBe("PNG");
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    const bitDepth = buffer[24];
    const colorType = buffer[25];
    const idatChunks = [];
    let offset = 8;

    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString("ascii", offset + 4, offset + 8);
        if (type === "IDAT") idatChunks.push(buffer.subarray(offset + 8, offset + 8 + length));
        offset += 12 + length;
    }

    const alphaPixels = countAlphaPixels(Buffer.concat(idatChunks), width, height, colorType, bitDepth);
    return {
        width,
        height,
        colorType,
        alphaPixels,
    };
}

function paeth(left, up, upLeft) {
    const p = left + up - upLeft;
    const pa = Math.abs(p - left);
    const pb = Math.abs(p - up);
    const pc = Math.abs(p - upLeft);
    if (pa <= pb && pa <= pc) return left;
    if (pb <= pc) return up;
    return upLeft;
}

function countAlphaPixels(idat, width, height, colorType, bitDepth) {
    expect(bitDepth).toBe(8);
    const bytesPerPixel = colorType === 6 ? 4 : colorType === 4 ? 2 : 0;
    expect(bytesPerPixel).toBeGreaterThan(0);

    const inflated = zlib.inflateSync(idat);
    const scanlineLength = width * bytesPerPixel;
    let offset = 0;
    let previous = Buffer.alloc(scanlineLength);
    let alphaPixels = 0;

    for (let y = 0; y < height; y += 1) {
        const filter = inflated[offset];
        const raw = inflated.subarray(offset + 1, offset + 1 + scanlineLength);
        const row = Buffer.alloc(scanlineLength);
        offset += 1 + scanlineLength;

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

        for (let x = bytesPerPixel - 1; x < scanlineLength; x += bytesPerPixel) {
            if (row[x] > 0) alphaPixels += 1;
        }
        previous = row;
    }

    return alphaPixels;
}

describe("wall dingbat assets", () => {
    test("manifest points at transparent single-dingbat masks", () => {
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

        expect(manifest.schema).toBe("g00dweird.wallGlyphs.v2");
        expect(manifest.glyphs).toHaveLength(117);

        manifest.glyphs.forEach((glyph) => {
            expect(glyph.kind).toBe("dingbat-mask");
            expect(glyph.url).toMatch(/^\/wall\/glyphs\/wall-glyph-\d{3}\.png$/);
            expect(glyph.w).toBeGreaterThan(12);
            expect(glyph.h).toBeGreaterThan(12);
            expect(glyph.w).toBeLessThanOrEqual(256);
            expect(glyph.h).toBeLessThanOrEqual(256);

            const info = readPngInfo(path.join(GLYPH_DIR, path.basename(glyph.url)));
            expect(info).toEqual(expect.objectContaining({ width: glyph.w, height: glyph.h }));
            expect([4, 6]).toContain(info.colorType);
            expect(info.alphaPixels).toBeGreaterThan(0);
        });
    });
});
