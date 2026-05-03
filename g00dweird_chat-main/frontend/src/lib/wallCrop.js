export const WALL_SAVE_MODES = [
    { id: "as-seen", label: "As Seen" },
    { id: "extract-mark", label: "Extract Mark Only" },
    { id: "sticker-cutout", label: "Sticker Cutout" },
];

export function normalizeCropRect(rect, maxW, maxH) {
    if (!rect) return null;
    const x1 = Math.max(0, Math.min(maxW, Math.min(rect.x, rect.x + rect.w)));
    const y1 = Math.max(0, Math.min(maxH, Math.min(rect.y, rect.y + rect.h)));
    const x2 = Math.max(0, Math.min(maxW, Math.max(rect.x, rect.x + rect.w)));
    const y2 = Math.max(0, Math.min(maxH, Math.max(rect.y, rect.y + rect.h)));
    const w = Math.max(0, Math.round(x2 - x1));
    const h = Math.max(0, Math.round(y2 - y1));
    if (w < 4 || h < 4) return null;
    return { x: Math.round(x1), y: Math.round(y1), w, h };
}

function drawScaled(source, maxDimension) {
    const maxSide = Math.max(source.width, source.height);
    if (!maxDimension || maxSide <= maxDimension) return source;
    const scale = maxDimension / maxSide;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
}

function luminance(r, g, b) {
    return (r * 0.299) + (g * 0.587) + (b * 0.114);
}

function extractMarkOnly(source, surface = "white") {
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = img.data;
    const lightMarks = surface === "black";
    for (let i = 0; i < data.length; i += 4) {
        const lum = luminance(data[i], data[i + 1], data[i + 2]);
        const alpha = data[i + 3] / 255;
        const markStrength = lightMarks
            ? Math.max(0, Math.min(255, (lum - 32) * 2.2))
            : Math.max(0, Math.min(255, (246 - lum) * 2.8));
        const nextAlpha = Math.round(markStrength * alpha);
        if (nextAlpha < 10) {
            data[i + 3] = 0;
        } else {
            data[i + 3] = nextAlpha;
            if (!lightMarks && lum > 90) {
                data[i] = Math.max(0, data[i] - 50);
                data[i + 1] = Math.max(0, data[i + 1] - 50);
                data[i + 2] = Math.max(0, data[i + 2] - 50);
            }
        }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
}

function stickerCutout(source, surface) {
    const mark = extractMarkOnly(source, surface);
    const pad = 8;
    const radius = 4;
    const canvas = document.createElement("canvas");
    canvas.width = mark.width + pad * 2;
    canvas.height = mark.height + pad * 2;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;

    const markCtx = mark.getContext("2d", { willReadFrequently: true });
    const src = markCtx.getImageData(0, 0, mark.width, mark.height);
    const outline = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < mark.height; y += 1) {
        for (let x = 0; x < mark.width; x += 1) {
            const srcIdx = ((y * mark.width) + x) * 4;
            if (src.data[srcIdx + 3] < 24) continue;
            for (let oy = -radius; oy <= radius; oy += 1) {
                for (let ox = -radius; ox <= radius; ox += 1) {
                    if ((ox * ox) + (oy * oy) > radius * radius) continue;
                    const tx = x + pad + ox;
                    const ty = y + pad + oy;
                    if (tx < 0 || ty < 0 || tx >= canvas.width || ty >= canvas.height) continue;
                    const outIdx = ((ty * canvas.width) + tx) * 4;
                    outline.data[outIdx] = 255;
                    outline.data[outIdx + 1] = 255;
                    outline.data[outIdx + 2] = 255;
                    outline.data[outIdx + 3] = Math.max(outline.data[outIdx + 3], 230);
                }
            }
        }
    }
    ctx.putImageData(outline, 0, 0);
    ctx.drawImage(mark, pad, pad);
    return canvas;
}

export function cropCanvasSelection(sourceCanvas, rect, options = {}) {
    const normalized = normalizeCropRect(rect, sourceCanvas.width, sourceCanvas.height);
    if (!normalized) throw new Error("select a bigger area first");

    const crop = document.createElement("canvas");
    crop.width = normalized.w;
    crop.height = normalized.h;
    const ctx = crop.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
        sourceCanvas,
        normalized.x,
        normalized.y,
        normalized.w,
        normalized.h,
        0,
        0,
        normalized.w,
        normalized.h
    );

    const mode = options.mode || "as-seen";
    const processed = mode === "extract-mark"
        ? extractMarkOnly(crop, options.surface)
        : mode === "sticker-cutout"
            ? stickerCutout(crop, options.surface)
            : crop;
    const finalCanvas = drawScaled(processed, options.maxDimension || 420);
    return {
        dataUrl: finalCanvas.toDataURL("image/png"),
        width: finalCanvas.width,
        height: finalCanvas.height,
        rect: normalized,
        mode,
    };
}
