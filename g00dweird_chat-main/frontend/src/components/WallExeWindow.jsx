import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Win95Window from "./Win95Window";
import { drawThinGlyphText } from "../lib/wallGlyphs";

const WALL_W = 960;
const WALL_H = 560;
const BRICK_URL = "/wall/brickwall.png";
const STORAGE_PREFIX = "gw_wall_marks_v3:";
const WALL_ART_STORAGE_KEY = "gw_wall_marks_v4:shared-art-layer";
const SNAPSHOT_KEY = "gw_wall_last_snapshot_v3";
const TYPE_MAX_WIDTH = 620;
const STENCIL_MAX_WIDTH = 720;
const STENCIL_PAD = 28;
const STICKER_MAX_W = 320;
const STICKER_MAX_H = 240;
const GLYPH_MAX_W = 360;
const GLYPH_MAX_H = 280;
const WALL_GLYPH_MANIFEST_URL = "/wall/glyphs/manifest.json";

const SURFACES = [
    { id: "brick", label: "BRICK", title: "brick wall" },
    { id: "white", label: "WHITE", title: "clean white wall" },
    { id: "black", label: "BLACK", title: "black wall" },
];

const TOOLS = [
    { id: "spray", label: "SPRAY", glyph: "▥" },
    { id: "pen", label: "PEN", glyph: "╱" },
    { id: "type", label: "TYPE", glyph: "A" },
    { id: "glyph", label: "DINGBATS", glyph: "✦" },
    { id: "stencil", label: "STENCIL", glyph: "▣" },
    { id: "erase", label: "ERASE", glyph: "▰" },
    { id: "upload", label: "UPLOAD", glyph: "⇧" },
    { id: "snapshot", label: "SNAPSHOT", glyph: "◉" },
    { id: "clear", label: "CLEAR", glyph: "⌫" },
];

const CAP_PRESETS = [
    { id: "paintpen", label: "PAINT PEN", tool: "pen", size: 32, spread: 0.12, density: 1, drip: 0.18, pixelSize: 2 },
    { id: "skinny", label: "SKINNY CAP", size: 46, spread: 0.32, density: 0.52, drip: 0.22, pixelSize: 1 },
    { id: "fat", label: "FAT CAP", size: 152, spread: 0.58, density: 0.75, drip: 0.42, pixelSize: 2 },
    { id: "soft", label: "SOFT FILL", size: 120, spread: 0.72, density: 0.46, drip: 0.14, pixelSize: 2 },
    { id: "drippy", label: "DRIPPY TAG", size: 92, spread: 0.44, density: 0.86, drip: 0.84, pixelSize: 2 },
];

const PALETTE = [
    "#ff004d", "#ff6ec7", "#ff7a00", "#ffd400", "#b3ff00", "#00ff88",
    "#00d5ff", "#0074ff", "#4f37ff", "#b24dff", "#ffffff", "#111111",
    "#7b2cff", "#ff2f92", "#7c3f16", "#755d28", "#b28b27", "#0f6f4d",
    "#1e6da8", "#132b73", "#a8a8a8", "#c0c0c0",
];

const FAKE_ARTISTS = [
    ["PIXELPHANT", "#ff6ec7"], ["MINITAGER", "#c28b44"], ["GRAFFITI-G", "#00d5ff"],
    ["DRIPMASTER", "#7b2cff"], ["VAPORWAVY", "#ff7a00"], ["BYTEKING", "#b3ff00"],
    ["LUNA_TAGZ", "#b24dff"], ["OLD_SKOOL", "#8b6f4d"], ["NEONNOIR", "#00ff88"],
    ["STICKY-ICKY", "#00aaff"], ["WALLGHOST", "#eaeaea"],
];

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function storageKey(surface) {
    return `${STORAGE_PREFIX}${surface}`;
}

function hexToRgb(hex) {
    const clean = String(hex || "#000000").replace("#", "").trim();
    const expanded = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const safe = /^[0-9a-fA-F]{6}$/.test(expanded) ? expanded : "000000";
    const value = Number.parseInt(safe, 16);
    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255,
    };
}

function normalizeHexColor(value) {
    const raw = String(value || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : "#000000";
}

function randomSigned() {
    return (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
}

function estimateGlyphTextBox(text, size, maxWidth = TYPE_MAX_WIDTH) {
    const value = String(text || "").toUpperCase();
    const spacing = size * 0.77;
    const lineHeight = size * 1.12;
    let lineWidth = 0;
    let maxLineWidth = 0;
    let lines = 1;

    [...value].forEach((ch) => {
        if (ch === "\n") {
            maxLineWidth = Math.max(maxLineWidth, lineWidth);
            lineWidth = 0;
            lines += 1;
            return;
        }
        const advance = ch === " " ? spacing * 0.65 : spacing;
        if (lineWidth > 0 && lineWidth + advance > maxWidth && ch !== " ") {
            maxLineWidth = Math.max(maxLineWidth, lineWidth);
            lineWidth = 0;
            lines += 1;
        }
        lineWidth += advance;
    });
    maxLineWidth = Math.max(maxLineWidth, lineWidth);

    return {
        w: Math.max(size * 0.65, Math.min(maxWidth, maxLineWidth + size * 0.25)),
        h: Math.max(size, lines * lineHeight),
    };
}

function stencilTextLines(text, size, maxWidth = STENCIL_MAX_WIDTH) {
    const value = String(text || "").toUpperCase();
    const letterAdvance = size * 0.68;
    const spaceAdvance = size * 0.42;
    const lines = [{ chars: [], width: 0 }];

    [...value].forEach((ch) => {
        if (ch === "\n") {
            lines.push({ chars: [], width: 0 });
            return;
        }

        const advance = ch === " " ? spaceAdvance : letterAdvance;
        let line = lines[lines.length - 1];
        if (line.width > 0 && line.width + advance > maxWidth && ch !== " ") {
            lines.push({ chars: [], width: 0 });
            line = lines[lines.length - 1];
        }
        line.chars.push({ ch, x: line.width, advance });
        line.width += advance;
    });

    return lines.length ? lines : [{ chars: [], width: 0 }];
}

function estimateStencilTextBox(text, size, maxWidth = STENCIL_MAX_WIDTH) {
    const lines = stencilTextLines(text || "STENCIL", size, maxWidth);
    const lineHeight = size * 1.04;
    const contentW = Math.max(size * 1.4, ...lines.map((line) => line.width));
    return {
        w: Math.max(size * 2.2, Math.min(maxWidth, contentW) + STENCIL_PAD * 2),
        h: Math.max(size * 1.55, lines.length * lineHeight + STENCIL_PAD * 2),
    };
}

function readGlyphManifest(raw) {
    if (!raw || !Array.isArray(raw.glyphs)) return [];
    return raw.glyphs
        .filter((entry) => entry && typeof entry.id === "string" && typeof entry.url === "string")
        .map((entry) => ({
            id: entry.id,
            label: entry.label || entry.id,
            url: entry.url,
            w: Number(entry.crop?.w) || 205,
            h: Number(entry.crop?.h) || 192,
        }));
}

function preloadGlyphImages(glyphs) {
    return Promise.all(glyphs.map((glyph) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ id: glyph.id, img, ok: true });
        img.onerror = () => resolve({ id: glyph.id, img: null, ok: false });
        img.src = glyph.url;
    })));
}

function drawStencilTextMask(ctx, text, box, size) {
    const lines = stencilTextLines(text || "STENCIL", size, Math.max(size, box.w - STENCIL_PAD * 2));
    const lineHeight = size * 1.04;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${Math.round(size)}px Impact, "Arial Black", "Helvetica Neue", sans-serif`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    const startY = Math.max(8, (box.h - lines.length * lineHeight) / 2);
    lines.forEach((line, lineIndex) => {
        const lineX = Math.max(STENCIL_PAD * 0.65, (box.w - line.width) / 2);
        const y = startY + lineIndex * lineHeight;
        line.chars.forEach(({ ch, x, advance }, charIndex) => {
            if (ch === " ") return;
            const drawX = lineX + x;
            ctx.fillText(ch, drawX, y);

            // Stencil bridges: block small parts of the cutout so letters feel
            // like a real cardboard stencil instead of plain filled text.
            ctx.save();
            ctx.globalCompositeOperation = "destination-out";
            ctx.fillStyle = "#000";
            const bridgeH = Math.max(3, Math.round(size * 0.085));
            const bridgeY = Math.round(y + size * (charIndex % 2 ? 0.56 : 0.43));
            ctx.fillRect(Math.round(drawX - size * 0.04), bridgeY, Math.round(advance * 0.88), bridgeH);
            if ("ABDOPQR0689".includes(ch)) {
                const bridgeW = Math.max(3, Math.round(size * 0.07));
                ctx.fillRect(Math.round(drawX + advance * 0.46), Math.round(y + size * 0.16), bridgeW, Math.round(size * 0.72));
            }
            ctx.restore();
        });
    });
    ctx.restore();
}

function createStencilMaskCanvas(text, placement) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(placement.box.w));
    canvas.height = Math.max(1, Math.ceil(placement.box.h));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStencilTextMask(ctx, text, { w: canvas.width, h: canvas.height }, placement.size);
    return canvas;
}

function stencilLocalPoint(point, placement, rotation) {
    const rad = -((Number(rotation) || 0) * Math.PI) / 180;
    const dx = point.x - placement.cx;
    const dy = point.y - placement.cy;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
        x: dx * cos - dy * sin + placement.box.w / 2,
        y: dx * sin + dy * cos + placement.box.h / 2,
    };
}

function drawCardboardStencil(ctx, text, placement, rotation, options = {}) {
    const mask = options.mask || createStencilMaskCanvas(text, placement);
    const w = placement.box.w;
    const h = placement.box.h;

    ctx.save();
    ctx.translate(placement.cx, placement.cy);
    ctx.rotate(((Number(rotation) || 0) * Math.PI) / 180);
    ctx.globalAlpha = options.alpha ?? 0.86;
    ctx.fillStyle = "#9d7446";
    ctx.fillRect(Math.round(-w / 2), Math.round(-h / 2), Math.round(w), Math.round(h));

    ctx.globalAlpha = 0.18;
    for (let y = -h / 2; y < h / 2; y += 8) {
        ctx.fillStyle = y % 16 === 0 ? "#d7b170" : "#5c3c21";
        ctx.fillRect(Math.round(-w / 2), Math.round(y), Math.round(w), 2);
    }
    for (let i = 0; i < 90; i += 1) {
        const x = -w / 2 + ((i * 37) % Math.max(1, w));
        const y = -h / 2 + ((i * 53) % Math.max(1, h));
        ctx.fillStyle = i % 3 === 0 ? "#f1c985" : "#4f321d";
        ctx.fillRect(Math.round(x), Math.round(y), 2 + (i % 4), 1 + (i % 3));
    }

    ctx.globalAlpha = 0.54;
    ctx.strokeStyle = "#2b1a0d";
    ctx.lineWidth = 3;
    ctx.strokeRect(Math.round(-w / 2), Math.round(-h / 2), Math.round(w), Math.round(h));

    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 1;
    ctx.drawImage(mask, -w / 2, -h / 2, w, h);
    ctx.globalCompositeOperation = "source-over";

    ctx.globalAlpha = options.pinned ? 1 : 0.72;
    ctx.strokeStyle = options.pinned ? "#b3ff00" : "#00ffff";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.strokeRect(Math.round(-w / 2 - 7), Math.round(-h / 2 - 7), Math.round(w + 14), Math.round(h + 14));
    ctx.setLineDash([]);
    ctx.restore();
}

function rotatedBoxSize(w, h, degrees) {
    const rad = (Number(degrees) || 0) * Math.PI / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    return {
        w: w * cos + h * sin,
        h: w * sin + h * cos,
    };
}

function imageFromUrl(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        const intersects = ((yi > y) !== (yj > y)) &&
            (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 0.0001) + xi);
        if (intersects) inside = !inside;
    }
    return inside;
}

function trimTransparentCanvas(sourceCanvas, pad = 4) {
    const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const data = imageData.data;
    let minX = sourceCanvas.width;
    let minY = sourceCanvas.height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < sourceCanvas.height; y += 1) {
        for (let x = 0; x < sourceCanvas.width; x += 1) {
            const alpha = data[((y * sourceCanvas.width) + x) * 4 + 3];
            if (alpha < 8) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }

    if (maxX < minX || maxY < minY) return sourceCanvas;
    const x = Math.max(0, minX - pad);
    const y = Math.max(0, minY - pad);
    const w = Math.min(sourceCanvas.width - x, (maxX - minX + 1) + pad * 2);
    const h = Math.min(sourceCanvas.height - y, (maxY - minY + 1) + pad * 2);
    const trimmed = document.createElement("canvas");
    trimmed.width = Math.max(1, w);
    trimmed.height = Math.max(1, h);
    const trimmedCtx = trimmed.getContext("2d", { willReadFrequently: true });
    trimmedCtx.imageSmoothingEnabled = false;
    trimmedCtx.drawImage(sourceCanvas, x, y, w, h, 0, 0, w, h);
    return trimmed;
}

function prepareStickerLassoImage(sourceImg, fallbackDataUrl, points) {
    return new Promise((resolve) => {
        if (!sourceImg || !points || points.length < 3) {
            resolve({ image: sourceImg, dataUrl: fallbackDataUrl, cutout: false, cutMode: "none" });
            return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = sourceImg.width;
        canvas.height = sourceImg.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sourceImg, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let y = 0; y < canvas.height; y += 1) {
            for (let x = 0; x < canvas.width; x += 1) {
                if (pointInPolygon(x + 0.5, y + 0.5, points)) continue;
                data[((y * canvas.width) + x) * 4 + 3] = 0;
            }
        }
        ctx.putImageData(imageData, 0, 0);

        const trimmed = trimTransparentCanvas(canvas, 5);
        const dataUrl = trimmed.toDataURL("image/png");
        const img = new Image();
        img.onload = () => resolve({ image: img, dataUrl, cutout: true, cutMode: "lasso" });
        img.onerror = () => resolve({ image: sourceImg, dataUrl: fallbackDataUrl, cutout: false, cutMode: "none" });
        img.src = dataUrl;
    });
}

function prepareStickerImage(sourceImg, fallbackDataUrl, options = {}) {
    return new Promise((resolve) => {
        const canvas = document.createElement("canvas");
        canvas.width = sourceImg.width;
        canvas.height = sourceImg.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sourceImg, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let cutout = false;
        let cutMode = "none";
        let sampleColor = null;
        const nearWhite = (index, threshold = 238) => (
            data[index] >= threshold &&
            data[index + 1] >= threshold &&
            data[index + 2] >= threshold &&
            Math.max(data[index], data[index + 1], data[index + 2]) - Math.min(data[index], data[index + 1], data[index + 2]) < 34
        );
        const colorDistance = (index, color) => {
            const dr = data[index] - color.r;
            const dg = data[index + 1] - color.g;
            const db = data[index + 2] - color.b;
            return Math.sqrt(dr * dr + dg * dg + db * db);
        };
        const eraseFlood = (seedX, seedY, toleranceValue) => {
            const width = canvas.width;
            const height = canvas.height;
            const tolerance = clamp(Number(toleranceValue) || 0, 0, 255);
            const feather = Math.min(18, Math.max(0, tolerance * 0.35));
            const fadeStart = tolerance - feather;
            const sx = clamp(Math.round(seedX), 0, width - 1);
            const sy = clamp(Math.round(seedY), 0, height - 1);
            const seedIndex = (sy * width + sx) * 4;
            const color = { r: data[seedIndex], g: data[seedIndex + 1], b: data[seedIndex + 2] };
            const visited = new Uint8Array(width * height);
            const stack = [sy * width + sx];
            let erased = 0;

            while (stack.length) {
                const pixel = stack.pop();
                if (visited[pixel]) continue;
                visited[pixel] = 1;
                const x = pixel % width;
                const y = Math.floor(pixel / width);
                const i = pixel * 4;
                const dist = colorDistance(i, color);
                if (dist > tolerance) continue;

                const softAlpha = feather > 0 && dist > fadeStart ? clamp((dist - fadeStart) / feather, 0, 1) : 0;
                data[i + 3] = Math.round(data[i + 3] * softAlpha);
                erased += 1;

                if (x > 0) stack.push(pixel - 1);
                if (x < width - 1) stack.push(pixel + 1);
                if (y > 0) stack.push(pixel - width);
                if (y < height - 1) stack.push(pixel + width);
            }
            return { erased, color };
        };

        if (options.samplePoint) {
            const tolerance = Number.isFinite(Number(options.tolerance)) ? Number(options.tolerance) : 42;
            const result = eraseFlood(options.samplePoint.x, options.samplePoint.y, tolerance);
            sampleColor = result.color;
            cutout = result.erased > 0;
            cutMode = "sample";
            ctx.putImageData(imageData, 0, 0);
        }

        if (!options.samplePoint && options.autoWhite !== false) {
            let borderPixels = 0;
            let whiteBorderPixels = 0;
            for (let y = 0; y < canvas.height; y += 1) {
                for (let x = 0; x < canvas.width; x += 1) {
                    const onBorder = x < 8 || y < 8 || x >= canvas.width - 8 || y >= canvas.height - 8;
                    if (!onBorder) continue;
                    const i = (y * canvas.width + x) * 4;
                    borderPixels += 1;
                    if (nearWhite(i)) whiteBorderPixels += 1;
                }
            }

            const shouldCutWhite = borderPixels > 0 && whiteBorderPixels / borderPixels > 0.58;
            if (shouldCutWhite) {
                for (let i = 0; i < data.length; i += 4) {
                    if (!nearWhite(i, 230)) continue;
                    const whiteness = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    data[i + 3] = Math.round(data[i + 3] * clamp((246 - whiteness) / 16, 0, 1));
                }
                cutout = true;
                cutMode = "auto-white";
                ctx.putImageData(imageData, 0, 0);
            }
        }

        const dataUrl = cutout ? canvas.toDataURL("image/png") : fallbackDataUrl;
        const img = new Image();
        img.onload = () => resolve({ image: img, dataUrl, cutout, cutMode, sampleColor });
        img.onerror = () => resolve({ image: sourceImg, dataUrl: fallbackDataUrl, cutout: false });
        img.src = dataUrl;
    });
}

function useWallArtists(users, currentUser) {
    return useMemo(() => {
        const byId = new Map();
        [currentUser, ...(users || [])].filter(Boolean).forEach((u) => {
            byId.set(u.user_id || u.nickname, u);
        });
        const live = [...byId.values()].map((u, index) => ({
            id: u.user_id || u.nickname,
            name: String(u.nickname || "artist").replace(/\s+/g, "_").toUpperCase(),
            color: index === 0 ? "#ff6ec7" : "#00ff88",
            avatarUrl: u.avatar_url || null,
            animId: u.anim_id || null,
            current: u.user_id === currentUser?.user_id,
        }));
        const filler = FAKE_ARTISTS.map(([name, color], index) => ({
            id: `fake-${name}`,
            name,
            color,
            fake: true,
            animId: ["ghost", "cat", "robot", "slime", "alien"][index % 5],
        }));
        return [...live, ...filler].slice(0, 12);
    }, [currentUser, users]);
}

function ToolButton({ tool, active, onClick }) {
    return (
        <button
            className={`w95-button ${active ? "active" : ""}`}
            onClick={onClick}
            data-testid={`wall-tool-${tool.id}`}
            aria-pressed={active}
            title={active ? `${tool.label} tool is active` : `Switch to ${tool.label}`}
            style={{
                width: 58,
                height: 54,
                padding: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                background: active ? "#000080" : undefined,
                color: active ? "#fff" : undefined,
                boxShadow: active ? "inset 2px 2px 0 #000, inset -1px -1px 0 #fff, 0 0 0 2px #00ffff" : undefined,
            }}
        >
            <span className="font-pixel" style={{ fontSize: 18, lineHeight: 1 }}>{tool.glyph}</span>
            <span className="font-pixel" style={{ fontSize: 7 }}>{tool.label}</span>
            {active && <span className="font-pixel" style={{ fontSize: 6, color: "#b3ff00" }}>ON</span>}
        </button>
    );
}

function Slider({ label, value, min, max, step, onChange, suffix = "" }) {
    return (
        <label className="flex flex-col gap-1" style={{ fontSize: 12 }}>
            <span className="font-pixel" style={{ fontSize: 8 }}>{label}</span>
            <div className="flex items-center gap-2">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    style={{ flex: 1 }}
                />
                <span className="w95-bevel-inset font-mono-retro px-1" style={{ width: 48, textAlign: "right", fontSize: 15 }}>
                    {value}{suffix}
                </span>
            </div>
        </label>
    );
}

export default function WallExeWindow({
    user,
    users = [],
    onClose,
    initialX = 90,
    initialY = 60,
    requestFocus = 0,
}) {
    const canvasRef = useRef(null);
    const previewCanvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const drawingRef = useRef(false);
    const dragStartRef = useRef(null);
    const sprayStrokeRef = useRef(null);
    const typePreviewPointRef = useRef(null);
    const stickerImageRef = useRef(null);
    const stickerSourceImageRef = useRef(null);
    const stickerPreviewImgRef = useRef(null);
    const surfaceRef = useRef("brick");
    const saveTimerRef = useRef(null);
    const stickerCutTimerRef = useRef(null);
    const stickerLassoDrawingRef = useRef(false);
    const stencilScratchRef = useRef(null);
    const stencilMaskCacheRef = useRef({ key: "", canvas: null });
    const glyphImageMapRef = useRef(new Map());

    const [tool, setTool] = useState("spray");
    const [surface, setSurface] = useState("brick");
    const [color, setColor] = useState("#b24dff");
    const [spraySize, setSpraySize] = useState(96);
    const [spread, setSpread] = useState(47);
    const [density, setDensity] = useState(72);
    const [opacity, setOpacity] = useState(85);
    const [drip, setDrip] = useState(61);
    const [pixelSize, setPixelSize] = useState(2);
    const [typeText, setTypeText] = useState("GOOD WEIRD");
    const [typeSize, setTypeSize] = useState(72);
    const [placementScale, setPlacementScale] = useState(100);
    const [placementRotation, setPlacementRotation] = useState(0);
    const [pendingSticker, setPendingSticker] = useState(null);
    const [stickerBgTolerance, setStickerBgTolerance] = useState(42);
    const [stickerBgSample, setStickerBgSample] = useState(null);
    const [stickerCutTool, setStickerCutTool] = useState("magic");
    const [stickerLassoPoints, setStickerLassoPoints] = useState([]);
    const [stencilAnchor, setStencilAnchor] = useState(null);
    const [selection, setSelection] = useState(null);
    const [glyphCatalog, setGlyphCatalog] = useState([]);
    const [glyphLoadState, setGlyphLoadState] = useState("IDLE");
    const [glyphLoadError, setGlyphLoadError] = useState("");
    const [activeGlyphId, setActiveGlyphId] = useState("wall-glyph-001");
    const [status, setStatus] = useState("READY");
    const [marks, setMarks] = useState(0);

    const activeGlyph = useMemo(() => glyphCatalog.find((glyph) => glyph.id === activeGlyphId) || null, [activeGlyphId, glyphCatalog]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setGlyphLoadState("LOADING");
            try {
                const response = await fetch(WALL_GLYPH_MANIFEST_URL);
                if (!response.ok) throw new Error(`status-${response.status}`);
                const json = await response.json();
                const entries = readGlyphManifest(json).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
                if (cancelled) return;
                setGlyphCatalog(entries);
                setGlyphLoadState(entries.length ? "READY" : "EMPTY");
                setActiveGlyphId((current) => {
                    if (!current || !entries.find((entry) => entry.id === current)) {
                        return entries[0]?.id || "";
                    }
                    return current;
                });

                const loaded = await preloadGlyphImages(entries);
                if (cancelled) return;
                loaded.forEach((item) => {
                    if (item.ok && item.img) glyphImageMapRef.current.set(item.id, item.img);
                });
            } catch (error) {
                if (!cancelled) {
                    console.warn("wall glyph manifest load error", error);
                    setGlyphLoadState("ERROR");
                    setGlyphLoadError("Failed to load glyph manifest");
                }
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const artists = useWallArtists(users, user);
    const paintColor = normalizeHexColor(color);

    const saveSurface = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
            localStorage.setItem(WALL_ART_STORAGE_KEY, canvas.toDataURL("image/png"));
            setStatus("AUTOSAVED");
        } catch {
            setStatus("WALL MEMORY FULL");
        }
    };

    const scheduleSave = () => {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => saveSurface(), 600);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setMarks(0);
        setSelection(null);
        scheduleSave();
    };

    const loadWallMarks = (targetSurface = surfaceRef.current) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });
        if (!canvas || !ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const legacyFallbacks = [targetSurface, "brick", "white", "black"]
            .filter((item, index, arr) => item && arr.indexOf(item) === index)
            .map((item) => ({ key: storageKey(item), label: `${item.toUpperCase()} LEGACY` }));
        const sources = [{ key: WALL_ART_STORAGE_KEY, label: "SHARED ART" }, ...legacyFallbacks];
        const source = sources.find((item) => localStorage.getItem(item.key));
        const saved = source ? localStorage.getItem(source.key) : null;
        if (!saved) {
            setStatus(`${targetSurface.toUpperCase()} WALL READY`);
            setMarks(0);
            return;
        }
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            if (source?.key !== WALL_ART_STORAGE_KEY) {
                try {
                    localStorage.setItem(WALL_ART_STORAGE_KEY, canvas.toDataURL("image/png"));
                } catch {
                    // Best-effort migration; drawing still loads even if localStorage is full.
                }
            }
            setStatus(`${source?.label || "WALL"} LOADED`);
        };
        img.src = saved;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const previewCanvas = previewCanvasRef.current;
        canvas.width = WALL_W;
        canvas.height = WALL_H;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.imageSmoothingEnabled = false;
        if (previewCanvas) {
            previewCanvas.width = WALL_W;
            previewCanvas.height = WALL_H;
            const previewCtx = previewCanvas.getContext("2d", { willReadFrequently: true });
            previewCtx.imageSmoothingEnabled = false;
        }
        loadWallMarks(surface);
        return () => {
            window.clearTimeout(saveTimerRef.current);
            window.clearTimeout(stickerCutTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        surfaceRef.current = surface;
    }, [surface]);

    const changeSurface = (nextSurface) => {
        if (nextSurface === surface) return;
        saveSurface();
        surfaceRef.current = nextSurface;
        setSurface(nextSurface);
        setSelection(null);
        setStatus(`${nextSurface.toUpperCase()} BG / ART KEPT`);
    };

    const pointFromEvent = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        return {
            x: clamp((e.clientX - rect.left) * (WALL_W / rect.width), 0, WALL_W),
            y: clamp((e.clientY - rect.top) * (WALL_H / rect.height), 0, WALL_H),
        };
    };

    const effectiveTypeSize = () => Math.max(8, typeSize * (placementScale / 100));

    const clampPlacementCenter = (point, box) => {
        const rotated = rotatedBoxSize(box.w, box.h, placementRotation);
        const pad = 10;
        return {
            cx: clamp(point.x, rotated.w / 2 + pad, Math.max(rotated.w / 2 + pad, WALL_W - rotated.w / 2 - pad)),
            cy: clamp(point.y, rotated.h / 2 + pad, Math.max(rotated.h / 2 + pad, WALL_H - rotated.h / 2 - pad)),
            rotated,
        };
    };

    const typePlacementForPoint = (point) => {
        const text = typeText.trim();
        const size = effectiveTypeSize();
        const box = estimateGlyphTextBox(text || "TYPE TAG TEXT", size, TYPE_MAX_WIDTH);
        const placement = clampPlacementCenter(point, box);
        return {
            ...placement,
            x: placement.cx - box.w / 2,
            y: placement.cy - box.h / 2,
            size,
            box,
        };
    };

    const stencilPlacementForPoint = (point) => {
        const text = typeText.trim();
        const size = effectiveTypeSize();
        const box = estimateStencilTextBox(text || "STENCIL", size, STENCIL_MAX_WIDTH);
        const placement = clampPlacementCenter(point, box);
        return {
            ...placement,
            x: placement.cx - box.w / 2,
            y: placement.cy - box.h / 2,
            size,
            box,
        };
    };

    const getStencilMaskCanvas = (placement) => {
        const key = [
            typeText.trim().toUpperCase(),
            Math.round(placement.box.w),
            Math.round(placement.box.h),
            Math.round(placement.size),
        ].join("|");
        const cache = stencilMaskCacheRef.current;
        if (cache.key === key && cache.canvas) return cache.canvas;
        const canvas = createStencilMaskCanvas(typeText.trim() || "STENCIL", placement);
        stencilMaskCacheRef.current = { key, canvas };
        return canvas;
    };

    const drawStencilMaskToContext = (ctx, placement, maskCanvas = getStencilMaskCanvas(placement)) => {
        ctx.save();
        ctx.translate(placement.cx, placement.cy);
        ctx.rotate((placementRotation * Math.PI) / 180);
        ctx.drawImage(maskCanvas, -placement.box.w / 2, -placement.box.h / 2, placement.box.w, placement.box.h);
        ctx.restore();
    };

    const stencilMaskContainsPoint = (point, placement, maskCanvas = getStencilMaskCanvas(placement)) => {
        const local = stencilLocalPoint(point, placement, placementRotation);
        const x = Math.round(local.x);
        const y = Math.round(local.y);
        if (x < 0 || y < 0 || x >= maskCanvas.width || y >= maskCanvas.height) return false;
        const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
        return maskCtx.getImageData(x, y, 1, 1).data[3] > 12;
    };

    const stickerPlacementForPoint = (point) => {
        const sticker = pendingSticker;
        if (!sticker) return null;
        const baseScale = Math.min(STICKER_MAX_W / sticker.width, STICKER_MAX_H / sticker.height, 1);
        const scaled = baseScale * (placementScale / 100);
        const box = {
            w: Math.max(4, sticker.width * scaled),
            h: Math.max(4, sticker.height * scaled),
        };
        const placement = clampPlacementCenter(point, box);
        return {
            ...placement,
            x: placement.cx - box.w / 2,
            y: placement.cy - box.h / 2,
            box,
        };
    };

    const glyphPlacementForPoint = (point) => {
        if (!activeGlyph) return null;
        const sourceW = activeGlyph.w || 205;
        const sourceH = activeGlyph.h || 192;
        const img = glyphImageMapRef.current.get(activeGlyph.id);
        const baseW = img?.width || sourceW;
        const baseH = img?.height || sourceH;
        const baseScale = Math.min(GLYPH_MAX_W / baseW, GLYPH_MAX_H / baseH, 1);
        const scaled = baseScale * (placementScale / 100);
        const box = {
            w: Math.max(4, baseW * scaled),
            h: Math.max(4, baseH * scaled),
        };
        const placement = clampPlacementCenter(point, box);
        return {
            ...placement,
            x: placement.cx - box.w / 2,
            y: placement.cy - box.h / 2,
            box,
        };
    };

    const clearTypePreview = () => {
        const previewCanvas = previewCanvasRef.current;
        const ctx = previewCanvas?.getContext("2d", { willReadFrequently: true });
        if (!previewCanvas || !ctx) return;
        ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    };

    const drawTypePreview = (point) => {
        const previewCanvas = previewCanvasRef.current;
        const ctx = previewCanvas?.getContext("2d", { willReadFrequently: true });
        const text = typeText.trim();
        if (!previewCanvas || !ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        if (!point && !(tool === "stencil" && stencilAnchor)) return;

        const drawPreviewBox = (placement, color = "rgba(0, 255, 255, 0.72)") => {
            const pad = 8;
            ctx.save();
            ctx.translate(placement.cx, placement.cy);
            ctx.rotate((placementRotation * Math.PI) / 180);
            ctx.globalAlpha = 0.72;
            ctx.fillStyle = "rgba(0, 255, 255, 0.08)";
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 5]);
            ctx.fillRect(
                Math.round(-placement.box.w / 2 - pad),
                Math.round(-placement.box.h / 2 - pad),
                Math.round(placement.box.w + pad * 2),
                Math.round(placement.box.h + pad * 2)
            );
            ctx.strokeRect(
                Math.round(-placement.box.w / 2 - pad),
                Math.round(-placement.box.h / 2 - pad),
                Math.round(placement.box.w + pad * 2),
                Math.round(placement.box.h + pad * 2)
            );
            ctx.restore();
        };

        if (tool === "sticker" && pendingSticker && stickerImageRef.current) {
            const placement = stickerPlacementForPoint(point);
            if (!placement) return;
            drawPreviewBox(placement, "rgba(255, 110, 199, 0.78)");
            ctx.save();
            ctx.translate(placement.cx, placement.cy);
            ctx.rotate((placementRotation * Math.PI) / 180);
            ctx.globalAlpha = Math.min(0.68, Math.max(0.28, opacity / 100));
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(stickerImageRef.current, -placement.box.w / 2, -placement.box.h / 2, placement.box.w, placement.box.h);
            ctx.restore();
            return;
        }

        if (tool === "stencil") {
            const stencilPoint = stencilAnchor || point;
            if (!text || !stencilPoint) return;
            const placement = stencilPlacementForPoint(stencilPoint);
            drawCardboardStencil(ctx, text, placement, placementRotation, {
                mask: getStencilMaskCanvas(placement),
                pinned: !!stencilAnchor,
                alpha: stencilAnchor ? 0.88 : 0.72,
            });
            return;
        }

        if (tool === "glyph") {
            if (!activeGlyph) return;
            const img = glyphImageMapRef.current.get(activeGlyph.id);
            const placement = glyphPlacementForPoint(point);
            if (!img || !placement) {
                if (!placement || glyphLoadState !== "READY") {
                    return;
                }
            }
            drawPreviewBox(placement, "rgba(179, 255, 0, 0.78)");
            ctx.save();
            ctx.translate(placement.cx, placement.cy);
            ctx.rotate((placementRotation * Math.PI) / 180);
            if (img) {
                ctx.globalAlpha = Math.max(0.12, Math.min(0.78, opacity / 100));
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, -placement.box.w / 2, -placement.box.h / 2, placement.box.w, placement.box.h);
            }
            ctx.restore();
            return;
        }

        if (tool !== "type" || !text) return;

        const placement = typePlacementForPoint(point);
        drawPreviewBox(placement);
        ctx.save();
        ctx.translate(placement.cx, placement.cy);
        ctx.rotate((placementRotation * Math.PI) / 180);
        drawThinGlyphText(ctx, text, -placement.box.w / 2, -placement.box.h / 2, {
            color: paintColor,
            size: placement.size,
            lineWidth: Math.max(1, pixelSize * 1.35),
            opacity: Math.min(0.62, Math.max(0.22, (opacity / 100) * 0.58)),
            maxWidth: TYPE_MAX_WIDTH,
            speckles: false,
        });
        ctx.restore();
    };

    useEffect(() => {
        if (tool !== "type" && tool !== "sticker" && tool !== "glyph" && tool !== "stencil") {
            typePreviewPointRef.current = null;
            clearTypePreview();
            return;
        }
        drawTypePreview(typePreviewPointRef.current);
    }, [
        tool,
        typeText,
        typeSize,
        placementScale,
        placementRotation,
        pendingSticker,
        stencilAnchor,
        paintColor,
        opacity,
        pixelSize,
        glyphLoadState,
        activeGlyph,
    ]);

    const drawGlyph = (point) => {
        const glyph = activeGlyph;
        const img = glyph ? glyphImageMapRef.current.get(glyph.id) : null;
        const placement = glyphPlacementForPoint(point);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });
        if (!glyph || !img || !placement || !canvas || !ctx) {
            setStatus("DINGBATS READY: PICK ONE FROM MATRIX");
            return;
        }
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(placement.cx, placement.cy);
        ctx.rotate((placementRotation * Math.PI) / 180);
        ctx.globalAlpha = opacity / 100;
        ctx.drawImage(img, -placement.box.w / 2, -placement.box.h / 2, placement.box.w, placement.box.h);
        ctx.restore();
        setMarks((m) => m + 1);
        setStatus(`DINGBAT ${glyph.label}`);
        scheduleSave();
    };

    const paintSprayToContext = (ctx, point, erasing = false, dynamics = {}) => {
        const rgb = hexToRgb(paintColor);
        const size = spraySize;
        const px = Math.max(1, pixelSize);
        const speedT = clamp(Number(dynamics.speedT) || 0, 0, 1);
        const radius = Math.max(px * 2.5, size * (spread / 100) * (1 - speedT * 0.48));
        const baseDotCount = Math.max(12, Math.round((density / 100) * (size * 0.9)));
        const dotCount = Math.max(8, Math.round(baseDotCount * (0.96 - speedT * 0.54)));
        const alphaScale = erasing ? 1 : 1 - speedT * 0.38;
        const dripScale = 1 - speedT * 0.82;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalCompositeOperation = erasing ? "destination-out" : "source-over";
        for (let i = 0; i < dotCount; i += 1) {
            const dist = Math.abs(randomSigned()) * radius * (0.35 + Math.random() * 1.55);
            const angle = Math.random() * Math.PI * 2;
            const x = point.x + Math.cos(angle) * dist;
            const y = point.y + Math.sin(angle) * dist;
            const falloff = clamp(1 - (dist / (radius * 1.6)), 0.05, 1);
            const alpha = erasing ? 0.7 : (opacity / 100) * falloff * (0.2 + Math.random() * 0.75) * alphaScale;
            const dot = Math.max(1, Math.round(px * (0.7 + Math.random() * 2.6) * falloff));
            ctx.globalAlpha = alpha;
            ctx.fillStyle = erasing
                ? "#000"
                : `rgb(${clamp(rgb.r + randomSigned() * 28, 0, 255)}, ${clamp(rgb.g + randomSigned() * 28, 0, 255)}, ${clamp(rgb.b + randomSigned() * 28, 0, 255)})`;
            const squareDust = px <= 2 && dot <= px * 2.2 && Math.random() < 0.34;
            if (squareDust) ctx.fillRect(Math.round(x), Math.round(y), dot, dot);
            else {
                ctx.beginPath();
                ctx.arc(Math.round(x), Math.round(y), Math.max(0.8, dot * 0.72), 0, Math.PI * 2);
                ctx.fill();
            }
        }
        if (!erasing && !dynamics.noDrips && Math.random() < (drip / 110) * dripScale) {
            const dripX = point.x + randomSigned() * radius;
            const dripLen = 18 + Math.random() * (drip * 0.95);
            const w = Math.max(1, Math.round(px * (0.8 + Math.random() * 1.2)));
            ctx.globalAlpha = (opacity / 100) * (0.35 + Math.random() * 0.3) * alphaScale;
            ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
            for (let yy = 0; yy < dripLen; yy += px + 1) {
                if (Math.random() < yy / dripLen) continue;
                ctx.fillRect(Math.round(dripX + randomSigned() * 2), Math.round(point.y + yy), w, px + 1);
            }
        }
        ctx.restore();
        return radius;
    };

    const drawSpray = (point, erasing = false, dynamics = {}) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });
        if (!canvas || !ctx) return;
        paintSprayToContext(ctx, point, erasing, dynamics);
        if (dynamics.countMark !== false) setMarks((m) => m + 1);
    };

    const drawPaintPenStroke = (from, to, eventTime = performance.now()) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });
        if (!canvas || !ctx) return;

        const start = from || { ...to, t: eventTime - 16 };
        const dx = to.x - start.x;
        const dy = to.y - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const elapsedMs = Math.max(8, eventTime - (start.t || eventTime - 16));
        const speedT = clamp((distance / (elapsedMs / 1000)) / 1600, 0, 1);
        const rgb = hexToRgb(paintColor);
        const width = clamp(1.6 + pixelSize * 0.85 + spraySize * 0.01, 2, 7) * (1 - speedT * 0.28);

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = opacity / 100;
        ctx.strokeStyle = paintColor;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();

        const wobbleSteps = Math.max(1, Math.min(18, Math.ceil(distance / 18)));
        ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        for (let i = 0; i <= wobbleSteps; i += 1) {
            const t = wobbleSteps === 0 ? 1 : i / wobbleSteps;
            const x = start.x + dx * t + randomSigned() * width * 0.85;
            const y = start.y + dy * t + randomSigned() * width * 0.85;
            ctx.globalAlpha = (opacity / 100) * (0.16 + Math.random() * 0.2);
            ctx.beginPath();
            ctx.arc(Math.round(x), Math.round(y), Math.max(0.7, width * (0.18 + Math.random() * 0.2)), 0, Math.PI * 2);
            ctx.fill();
        }

        const littleDripChance = clamp((drip / 100) * 0.06 * Math.max(1, distance / 34), 0, 0.18);
        if (Math.random() < littleDripChance) {
            const t = 0.2 + Math.random() * 0.72;
            const x = start.x + dx * t + randomSigned() * width;
            const y = start.y + dy * t;
            const dripLen = 5 + Math.random() * clamp(drip * 0.16, 2, 16);
            ctx.globalAlpha = (opacity / 100) * 0.5;
            ctx.strokeStyle = paintColor;
            ctx.lineWidth = Math.max(1, width * 0.42);
            ctx.beginPath();
            ctx.moveTo(Math.round(x), Math.round(y));
            ctx.lineTo(Math.round(x + randomSigned() * 2), Math.round(y + dripLen));
            ctx.stroke();
        }
        ctx.restore();
        setMarks((m) => m + 1);
    };

    const drawSprayStroke = (from, to, erasing = false, eventTime = performance.now()) => {
        if (!from) {
            drawSpray(to, erasing, { speedT: 0 });
            return;
        }

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const elapsedMs = Math.max(8, eventTime - (from.t || eventTime - 16));
        const speed = distance / (elapsedMs / 1000);
        const speedT = clamp(speed / 1300, 0, 1);
        const radius = Math.max(pixelSize * 2.5, spraySize * (spread / 100) * (1 - speedT * 0.48));
        const spacing = clamp(radius * 0.18, Math.max(1.5, pixelSize * 1.2), 8);
        const steps = Math.max(1, Math.min(140, Math.ceil(distance / spacing)));

        for (let i = 1; i <= steps; i += 1) {
            const t = i / steps;
            drawSpray(
                {
                    x: from.x + dx * t,
                    y: from.y + dy * t,
                },
                erasing,
                { speedT, countMark: false }
            );
        }
        setMarks((m) => m + 1);
    };

    const getStencilScratchCanvas = () => {
        if (!stencilScratchRef.current) {
            stencilScratchRef.current = document.createElement("canvas");
        }
        const canvas = stencilScratchRef.current;
        if (canvas.width !== WALL_W) canvas.width = WALL_W;
        if (canvas.height !== WALL_H) canvas.height = WALL_H;
        return canvas;
    };

    const drawStencilDrips = (ctx, point, placement, maskCanvas, dynamics = {}) => {
        const speedT = clamp(Number(dynamics.speedT) || 0, 0, 1);
        const dripStrength = clamp((drip / 100) * (1 - speedT * 0.55), 0, 1);
        if (dripStrength <= 0 || Math.random() > 0.42 + dripStrength * 0.5) return;

        const rgb = hexToRgb(paintColor);
        const px = Math.max(1, pixelSize);
        const sprayRadius = Math.max(px * 2.5, spraySize * (spread / 100) * (1 - speedT * 0.48));
        const count = Math.max(1, Math.round(dripStrength * 4));

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

        for (let i = 0; i < count; i += 1) {
            let start = null;
            for (let attempt = 0; attempt < 18; attempt += 1) {
                const dist = Math.abs(randomSigned()) * sprayRadius * 1.2;
                const angle = Math.random() * Math.PI * 2;
                const candidate = {
                    x: point.x + Math.cos(angle) * dist,
                    y: point.y + Math.sin(angle) * dist,
                };
                if (stencilMaskContainsPoint(candidate, placement, maskCanvas)) {
                    start = candidate;
                    break;
                }
            }
            if (!start) continue;

            const len = 10 + Math.random() * (18 + drip * 0.75);
            const w = Math.max(1, Math.round(px * (0.8 + Math.random() * 1.3)));
            ctx.globalAlpha = (opacity / 100) * (0.28 + Math.random() * 0.32);
            for (let yy = 0; yy < len; yy += px + 1) {
                if (yy > 4 && Math.random() < yy / (len * 1.08)) continue;
                ctx.fillRect(
                    Math.round(start.x + randomSigned() * 2),
                    Math.round(start.y + yy),
                    w,
                    px + 1
                );
            }
        }
        ctx.restore();
    };

    const drawStencilSpray = (point, dynamics = {}) => {
        if (!stencilAnchor) return false;
        const text = typeText.trim();
        if (!text) return false;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });
        if (!canvas || !ctx) return false;

        const placement = stencilPlacementForPoint(stencilAnchor);
        const maskCanvas = getStencilMaskCanvas(placement);
        const scratch = getStencilScratchCanvas();
        const scratchCtx = scratch.getContext("2d", { willReadFrequently: true });
        scratchCtx.clearRect(0, 0, scratch.width, scratch.height);
        scratchCtx.imageSmoothingEnabled = false;
        paintSprayToContext(scratchCtx, point, false, { ...dynamics, noDrips: true });

        scratchCtx.save();
        scratchCtx.globalCompositeOperation = "destination-in";
        drawStencilMaskToContext(scratchCtx, placement, maskCanvas);
        scratchCtx.restore();

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(scratch, 0, 0);
        drawStencilDrips(ctx, point, placement, maskCanvas, dynamics);
        ctx.restore();
        return true;
    };

    const drawStencilSprayStroke = (from, to, eventTime = performance.now()) => {
        if (!from) return drawStencilSpray(to, { speedT: 0 });

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const elapsedMs = Math.max(8, eventTime - (from.t || eventTime - 16));
        const speed = distance / (elapsedMs / 1000);
        const speedT = clamp(speed / 1300, 0, 1);
        const radius = Math.max(pixelSize * 2.5, spraySize * (spread / 100) * (1 - speedT * 0.48));
        const spacing = clamp(radius * 0.18, Math.max(1.5, pixelSize * 1.2), 8);
        const steps = Math.max(1, Math.min(140, Math.ceil(distance / spacing)));
        let painted = false;

        for (let i = 1; i <= steps; i += 1) {
            const t = i / steps;
            painted = drawStencilSpray(
                {
                    x: from.x + dx * t,
                    y: from.y + dy * t,
                },
                { speedT }
            ) || painted;
        }
        if (painted) setMarks((m) => m + 1);
        return painted;
    };

    const drawTypedGlyph = (point) => {
        const text = typeText.trim();
        if (!text) {
            setStatus("TYPE SOMETHING FIRST");
            return;
        }
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });
        if (!canvas || !ctx) return;
        ctx.imageSmoothingEnabled = false;
        const placement = typePlacementForPoint(point);
        ctx.save();
        ctx.translate(placement.cx, placement.cy);
        ctx.rotate((placementRotation * Math.PI) / 180);
        drawThinGlyphText(ctx, text, -placement.box.w / 2, -placement.box.h / 2, {
            color: paintColor,
            size: placement.size,
            lineWidth: Math.max(1, pixelSize * 1.6),
            opacity: opacity / 100,
            maxWidth: TYPE_MAX_WIDTH,
        });
        ctx.restore();
        setMarks((m) => m + 1);
        setStatus(`DINGBAT STAMP ${Math.round(placement.size)}PX @ ${placementRotation}DEG`);
        scheduleSave();
    };

    const drawSticker = (point) => {
        const img = stickerImageRef.current;
        const placement = stickerPlacementForPoint(point);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });
        if (!img || !placement || !canvas || !ctx) {
            setStatus("UPLOAD STICKER FIRST");
            return;
        }
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(placement.cx, placement.cy);
        ctx.rotate((placementRotation * Math.PI) / 180);
        ctx.globalAlpha = opacity / 100;
        ctx.drawImage(img, -placement.box.w / 2, -placement.box.h / 2, placement.box.w, placement.box.h);
        ctx.restore();
        setMarks((m) => m + 1);
        setStatus(`STICKER PLACED @ ${placementRotation}DEG`);
        scheduleSave();
    };

    const handlePointerDown = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        const point = pointFromEvent(e);
        if (tool === "type") {
            drawTypedGlyph(point);
            typePreviewPointRef.current = point;
            drawTypePreview(point);
            return;
        }
        if (tool === "sticker") {
            drawSticker(point);
            typePreviewPointRef.current = point;
            drawTypePreview(point);
            return;
        }
        if (tool === "glyph") {
            drawGlyph(point);
            typePreviewPointRef.current = point;
            drawTypePreview(point);
            return;
        }
        if (tool === "stencil") {
            if (!typeText.trim()) {
                setStatus("TYPE STENCIL TEXT FIRST");
                return;
            }
            if (!stencilAnchor) {
                setStencilAnchor(point);
                typePreviewPointRef.current = point;
                window.setTimeout(() => drawTypePreview(point), 0);
                setStatus("STENCIL PINNED - SPRAY THE CUTOUT");
                return;
            }
            drawingRef.current = true;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            sprayStrokeRef.current = { ...point, t: e.timeStamp || performance.now() };
            const painted = drawStencilSpray(point, { speedT: 0 });
            if (painted) setMarks((m) => m + 1);
            setStatus("SPRAYING STENCIL");
            return;
        }
        if (tool === "select") {
            dragStartRef.current = point;
            sprayStrokeRef.current = null;
            setSelection({ x: point.x, y: point.y, w: 0, h: 0 });
            drawingRef.current = true;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            return;
        }
        if (tool !== "spray" && tool !== "erase" && tool !== "pen") return;
        drawingRef.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        sprayStrokeRef.current = { ...point, t: e.timeStamp || performance.now() };
        if (tool === "pen") drawPaintPenStroke(null, point, e.timeStamp || performance.now());
        else drawSpray(point, tool === "erase", { speedT: 0 });
        setStatus(tool === "erase" ? "ERASING" : tool === "pen" ? "PAINT PEN" : "SPRAYING");
    };

    const handlePointerMove = (e) => {
        const point = pointFromEvent(e);
        if (tool === "type" || tool === "sticker" || tool === "glyph" || (tool === "stencil" && !drawingRef.current)) {
            typePreviewPointRef.current = point;
            drawTypePreview(point);
            return;
        }
        if (!drawingRef.current) return;
        if (tool === "select") {
            const start = dragStartRef.current || point;
            setSelection({ x: start.x, y: start.y, w: point.x - start.x, h: point.y - start.y });
            return;
        }
        if (tool === "spray" || tool === "erase" || tool === "pen") {
            const now = e.timeStamp || performance.now();
            if (tool === "pen") drawPaintPenStroke(sprayStrokeRef.current, point, now);
            else drawSprayStroke(sprayStrokeRef.current, point, tool === "erase", now);
            sprayStrokeRef.current = { ...point, t: now };
        } else if (tool === "stencil") {
            const now = e.timeStamp || performance.now();
            drawStencilSprayStroke(sprayStrokeRef.current, point, now);
            sprayStrokeRef.current = { ...point, t: now };
        }
    };

    const stopDrawing = (e) => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        dragStartRef.current = null;
        sprayStrokeRef.current = null;
        setStatus(tool === "select" ? "SELECTION READY" : tool === "stencil" ? "STENCIL READY" : "READY");
        scheduleSave();
    };

    const handlePointerLeave = () => {
        if (tool === "stencil" && stencilAnchor) {
            typePreviewPointRef.current = null;
            drawTypePreview(null);
            return;
        }
        typePreviewPointRef.current = null;
        clearTypePreview();
    };

    const applyStickerCut = async (samplePoint, tolerance = stickerBgTolerance, autoWhite = false) => {
        const sourceImg = stickerSourceImageRef.current;
        if (!sourceImg) {
            setStatus("UPLOAD STICKER FIRST");
            return;
        }
        const fallbackDataUrl = pendingSticker?.sourceDataUrl || pendingSticker?.dataUrl || sourceImg.src;
        const prepared = await prepareStickerImage(sourceImg, fallbackDataUrl, {
            samplePoint,
            tolerance,
            autoWhite,
        });
        stickerImageRef.current = prepared.image;
        setPendingSticker((current) => current ? ({
            ...current,
            width: prepared.image.width,
            height: prepared.image.height,
            dataUrl: prepared.dataUrl,
            cutout: prepared.cutout,
            cutMode: prepared.cutMode,
            sampleColor: prepared.cutMode === "sample" ? prepared.sampleColor : null,
        }) : current);
        setStatus(
            prepared.cutMode === "sample"
                ? `BG CUT TOL ${Math.round(tolerance)}`
                : prepared.cutMode === "auto-white"
                    ? "AUTO WHITE CUT"
                    : "STICKER ORIGINAL"
        );
        window.setTimeout(() => drawTypePreview(typePreviewPointRef.current), 0);
    };

    const scheduleStickerCut = (samplePoint = stickerBgSample, tolerance = stickerBgTolerance) => {
        window.clearTimeout(stickerCutTimerRef.current);
        stickerCutTimerRef.current = window.setTimeout(() => {
            if (samplePoint) applyStickerCut(samplePoint, tolerance, false);
        }, 120);
    };

    const handleStickerToleranceChange = (value) => {
        setStickerBgTolerance(value);
        if (stickerBgSample) scheduleStickerCut(stickerBgSample, value);
    };

    const stickerPreviewPointFromEvent = (e) => {
        const img = stickerPreviewImgRef.current;
        const sticker = pendingSticker;
        if (!img || !sticker) return null;
        const wrapRect = e.currentTarget.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();
        if (!imgRect.width || !imgRect.height) return null;
        return {
            x: clamp(e.clientX - wrapRect.left, 0, wrapRect.width),
            y: clamp(e.clientY - wrapRect.top, 0, wrapRect.height),
            imgX: clamp(Math.round(((e.clientX - imgRect.left) / imgRect.width) * sticker.width), 0, sticker.width - 1),
            imgY: clamp(Math.round(((e.clientY - imgRect.top) / imgRect.height) * sticker.height), 0, sticker.height - 1),
        };
    };

    const handleStickerThumbClick = (e) => {
        if (stickerCutTool !== "magic") return;
        const sourceImg = stickerSourceImageRef.current;
        if (!sourceImg) return;
        const mapped = stickerPreviewPointFromEvent(e);
        if (!mapped) return;
        const samplePoint = { x: mapped.imgX, y: mapped.imgY };
        setStickerBgSample(samplePoint);
        applyStickerCut(samplePoint, stickerBgTolerance, false);
    };

    const applyStickerLassoCut = async (points = stickerLassoPoints) => {
        const currentImg = stickerImageRef.current;
        if (!currentImg || !pendingSticker) {
            setStatus("UPLOAD STICKER FIRST");
            return;
        }
        const imagePoints = points.map((point) => ({ x: point.imgX, y: point.imgY }));
        if (imagePoints.length < 3) {
            setStatus("DRAW A BIGGER LASSO");
            return;
        }
        const fallbackDataUrl = pendingSticker.dataUrl || pendingSticker.sourceDataUrl || currentImg.src;
        const prepared = await prepareStickerLassoImage(currentImg, fallbackDataUrl, imagePoints);
        stickerImageRef.current = prepared.image;
        setStickerBgSample(null);
        setStickerLassoPoints([]);
        setPendingSticker((current) => current ? ({
            ...current,
            width: prepared.image.width,
            height: prepared.image.height,
            dataUrl: prepared.dataUrl,
            cutout: prepared.cutout,
            cutMode: prepared.cutMode,
            sampleColor: null,
        }) : current);
        setStatus("LASSO CUTOUT READY");
        window.setTimeout(() => drawTypePreview(typePreviewPointRef.current), 0);
    };

    const handleStickerLassoPointerDown = (e) => {
        if (stickerCutTool !== "lasso" || !pendingSticker) return;
        e.preventDefault();
        const point = stickerPreviewPointFromEvent(e);
        if (!point) return;
        stickerLassoDrawingRef.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setStickerLassoPoints([point]);
        setStatus("DRAWING LASSO");
    };

    const handleStickerLassoPointerMove = (e) => {
        if (!stickerLassoDrawingRef.current || stickerCutTool !== "lasso") return;
        e.preventDefault();
        const point = stickerPreviewPointFromEvent(e);
        if (!point) return;
        setStickerLassoPoints((points) => {
            const last = points[points.length - 1];
            if (last && Math.hypot(point.x - last.x, point.y - last.y) < 3) return points;
            return [...points, point].slice(-800);
        });
    };

    const handleStickerLassoPointerUp = (e) => {
        if (!stickerLassoDrawingRef.current) return;
        e.preventDefault();
        stickerLassoDrawingRef.current = false;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        setStickerLassoPoints((points) => {
            if (points.length >= 3) {
                window.setTimeout(() => applyStickerLassoCut(points), 0);
            } else {
                setStatus("DRAW A BIGGER LASSO");
            }
            return points;
        });
    };

    const resetStickerCut = () => {
        const sourceImg = stickerSourceImageRef.current;
        if (!sourceImg || !pendingSticker) return;
        stickerImageRef.current = sourceImg;
        setStickerBgSample(null);
        setStickerLassoPoints([]);
        setPendingSticker((current) => current ? ({
            ...current,
            width: sourceImg.width,
            height: sourceImg.height,
            dataUrl: current.sourceDataUrl || sourceImg.src,
            cutout: false,
            cutMode: "none",
            sampleColor: null,
        }) : current);
        setStatus("STICKER ORIGINAL");
        window.setTimeout(() => drawTypePreview(typePreviewPointRef.current), 0);
    };

    const autoWhiteStickerCut = () => {
        setStickerBgSample(null);
        applyStickerCut(null, stickerBgTolerance, true);
    };

    const handleUploadFile = (file) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setStatus("IMAGE FILES ONLY");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = async () => {
                stickerSourceImageRef.current = img;
                setStickerBgSample(null);
                setStickerLassoPoints([]);
                setStickerCutTool("magic");
                const prepared = await prepareStickerImage(img, String(reader.result || ""));
                stickerImageRef.current = prepared.image;
                setPendingSticker({
                    name: file.name,
                    width: prepared.image.width,
                    height: prepared.image.height,
                    dataUrl: prepared.dataUrl,
                    sourceDataUrl: String(reader.result || ""),
                    cutout: prepared.cutout,
                    cutMode: prepared.cutMode,
                    sampleColor: prepared.sampleColor,
                });
                setTool("sticker");
                setStatus(`${prepared.cutout ? "CUTOUT " : ""}STICKER READY: ${file.name.slice(0, 18)}`);
                window.setTimeout(() => drawTypePreview(typePreviewPointRef.current), 0);
            };
            img.src = String(reader.result || "");
        };
        reader.readAsDataURL(file);
    };

    const composeSnapshot = async () => {
        const marksCanvas = canvasRef.current;
        if (!marksCanvas) return null;
        const canvas = document.createElement("canvas");
        canvas.width = WALL_W;
        canvas.height = WALL_H;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.imageSmoothingEnabled = false;
        if (surface === "brick") {
            try {
                const img = await imageFromUrl(BRICK_URL);
                ctx.drawImage(img, 0, 0, WALL_W, WALL_H);
            } catch {
                ctx.fillStyle = "#3a1f18";
                ctx.fillRect(0, 0, WALL_W, WALL_H);
            }
        } else {
            ctx.fillStyle = surface === "black" ? "#050505" : "#f8f8f3";
            ctx.fillRect(0, 0, WALL_W, WALL_H);
        }
        ctx.drawImage(marksCanvas, 0, 0);
        return canvas.toDataURL("image/png");
    };

    const saveSnapshot = async () => {
        const dataUrl = await composeSnapshot();
        if (!dataUrl) return;
        try {
            localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ surface, dataUrl, createdAt: new Date().toISOString() }));
            setStatus("SNAPSHOT SAVED LOCALLY");
            toast.success("wall snapshot saved", { description: "stored locally for this dev session" });
        } catch {
            setStatus("SNAPSHOT TOO BIG");
            toast.error("snapshot too big for local storage");
        }
    };

    const applyCap = (preset) => {
        setSpraySize(preset.size);
        setSpread(Math.round(preset.spread * 100));
        setDensity(Math.round(preset.density * 100));
        setDrip(Math.round(preset.drip * 100));
        setPixelSize(preset.pixelSize);
        if (preset.tool) setTool(preset.tool);
        setStatus(preset.label);
    };

    const surfaceStyle = surface === "brick"
        ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.22), rgba(0,0,0,0.14)), url(${BRICK_URL})`, backgroundSize: "cover" }
        : surface === "black"
            ? { background: "radial-gradient(circle at 50% 35%, #151515, #030303 75%)" }
            : { background: "linear-gradient(135deg, #ffffff, #eeeeea)" };

    const cursor = tool === "spray" || tool === "pen" || tool === "glyph"
        ? "crosshair"
        : tool === "erase"
            ? "cell"
            : tool === "type"
                ? "text"
                : tool === "sticker"
                    ? "grab"
                    : "crosshair";
    const toolModeButtonStyle = (mode, disabled = false) => ({
        background: tool === mode && !disabled ? "#000080" : undefined,
        color: tool === mode && !disabled ? "#fff" : undefined,
        borderColor: tool === mode && !disabled ? "#000 #fff #fff #000" : undefined,
        boxShadow: tool === mode && !disabled ? "inset 2px 2px 0 #000, inset -1px -1px 0 #fff, 0 0 0 2px #00ffff" : undefined,
        fontWeight: tool === mode && !disabled ? "bold" : undefined,
    });

    return (
        <Win95Window
            title="wall.exe"
            testId="wall-exe-window"
            initialX={initialX}
            initialY={initialY}
            width={1160}
            height={790}
            onClose={onClose}
            requestFocus={requestFocus}
            resizable
            minWidth={900}
            minHeight={620}
            icon={<span style={{ color: "#b24dff" }}>▥</span>}
        >
            <div className="flex flex-col h-full" style={{ background: "var(--w95-bg)", minHeight: 0 }}>
                <div className="flex items-center gap-4 px-3 py-1 font-mono-retro" style={{ fontSize: 17 }}>
                    <span>File</span><span>Edit</span><span>View</span><span>Surface</span><span>Paint</span><span>Upload</span><span>Community</span><span>Help</span>
                </div>

                <div className="w95-bevel-inset flex items-center gap-2 p-2" style={{ flex: "0 0 auto" }}>
                    <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                        {TOOLS.map((item) => {
                            const onClick = item.id === "upload"
                                ? () => fileInputRef.current?.click()
                                : item.id === "snapshot"
                                    ? saveSnapshot
                                    : item.id === "clear"
                                        ? clearCanvas
                                        : () => setTool(item.id);
                            return <ToolButton key={item.id} tool={item} active={tool === item.id} onClick={onClick} />;
                        })}
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => handleUploadFile(e.target.files?.[0])}
                    />
                    <div className="w95-bevel-inset p-2 ml-auto" style={{ minWidth: 190 }}>
                        <div className="font-pixel mb-1" style={{ fontSize: 8 }}>SURFACE</div>
                        <div className="flex gap-1">
                            {SURFACES.map((s) => (
                                <button
                                    key={s.id}
                                    className={`w95-button ${surface === s.id ? "active" : ""}`}
                                    onClick={() => changeSurface(s.id)}
                                    title={s.title}
                                    style={{ fontSize: 12, background: surface === s.id ? "#000080" : undefined, color: surface === s.id ? "#fff" : undefined }}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="px-4 text-right" style={{ minWidth: 260 }}>
                        <div className="font-pixel" style={{ fontSize: 14, letterSpacing: "0.08em" }}>DRIPNET PUBLIC WALL</div>
                        <div className="font-mono-retro" style={{ fontSize: 16, color: "#666" }}>leave your mark</div>
                    </div>
                </div>

                <div className="flex flex-1" style={{ minHeight: 0 }}>
                    <div className="flex-1 p-1" style={{ minWidth: 0 }}>
                        <div
                            className="w95-bevel-inset relative overflow-hidden h-full"
                            style={{ ...surfaceStyle, touchAction: "none" }}
                            data-testid="wall-canvas-wrap"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                handleUploadFile(e.dataTransfer.files?.[0]);
                            }}
                        >
                            <canvas
                                ref={canvasRef}
                                width={WALL_W}
                                height={WALL_H}
                                data-testid="wall-canvas"
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={stopDrawing}
                                onPointerCancel={stopDrawing}
                                onPointerLeave={handlePointerLeave}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    display: "block",
                                    imageRendering: "pixelated",
                                    cursor,
                                }}
                            />
                            <canvas
                                ref={previewCanvasRef}
                                width={WALL_W}
                                height={WALL_H}
                                data-testid="wall-type-preview"
                                aria-hidden
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    width: "100%",
                                    height: "100%",
                                    display: "block",
                                    imageRendering: "pixelated",
                                    pointerEvents: "none",
                                    mixBlendMode: surface === "black" ? "screen" : "normal",
                                }}
                            />
                            {selection && (
                                <div
                                    data-testid="wall-selection-rect"
                                    style={{
                                        position: "absolute",
                                        left: `${(Math.min(selection.x, selection.x + selection.w) / WALL_W) * 100}%`,
                                        top: `${(Math.min(selection.y, selection.y + selection.h) / WALL_H) * 100}%`,
                                        width: `${(Math.abs(selection.w) / WALL_W) * 100}%`,
                                        height: `${(Math.abs(selection.h) / WALL_H) * 100}%`,
                                        border: "2px dashed #00ffff",
                                        background: "rgba(0,255,255,0.08)",
                                        boxShadow: "0 0 0 1px #000",
                                        pointerEvents: "none",
                                    }}
                                />
                            )}
                            <div className="absolute left-2 top-2 font-pixel" style={{ color: "rgba(255,255,255,0.75)", fontSize: 9, textShadow: "1px 1px #000" }}>
                                wall.exe :: {surface.toUpperCase()} :: {tool.toUpperCase()}
                            </div>
                        </div>
                    </div>

                    <aside className="w95-bevel-inset m-1 p-2 flex flex-col gap-3" style={{ width: 248, overflow: "auto" }}>
                        <div className="font-pixel px-2 py-1" style={{ background: "#000080", color: "#fff", fontSize: 9 }}>TOOL OPTIONS</div>
                        <Slider label="SPRAY SIZE" value={spraySize} min={18} max={220} step={1} onChange={setSpraySize} />
                        <Slider label="SPREAD" value={spread} min={10} max={100} step={1} onChange={setSpread} suffix="%" />
                        <Slider label="DENSITY" value={density} min={10} max={100} step={1} onChange={setDensity} suffix="%" />
                        <Slider label="OPACITY" value={opacity} min={10} max={100} step={1} onChange={setOpacity} suffix="%" />
                        <Slider label="DRIP" value={drip} min={0} max={100} step={1} onChange={setDrip} suffix="%" />
                        <Slider label="PIXEL SIZE" value={pixelSize} min={1} max={8} step={1} onChange={setPixelSize} suffix="px" />

                        <div>
                            <div className="font-pixel px-2 py-1 mb-2" style={{ background: "#000080", color: "#fff", fontSize: 9 }}>CAP PRESETS</div>
                            <div className="grid grid-cols-2 gap-1">
                                {CAP_PRESETS.map((preset) => (
                                    <button key={preset.id} className="w95-button" onClick={() => applyCap(preset)} style={{ minHeight: 42 }}>
                                        <span className="font-pixel" style={{ fontSize: 8 }}>{preset.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="font-pixel px-2 py-1 mb-2" style={{ background: "#000080", color: "#fff", fontSize: 9 }}>COLOR</div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w95-bevel-inset" style={{ width: 46, height: 28, background: paintColor }} />
                                <input className="w95-input flex-1" value={color.toUpperCase()} onChange={(e) => setColor(e.target.value.slice(0, 7))} />
                                <input type="color" value={paintColor} onChange={(e) => setColor(e.target.value)} style={{ width: 32, height: 28 }} />
                            </div>
                            <div className="grid grid-cols-11 gap-1">
                                {PALETTE.map((c) => (
                                    <button
                                        key={c}
                                        title={c}
                                        onClick={() => setColor(c)}
                                        className="w95-button"
                                        style={{ height: 20, minWidth: 0, background: c, border: paintColor === c ? "2px solid #000" : undefined }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="font-pixel px-2 py-1 mb-2" style={{ background: "#000080", color: "#fff", fontSize: 9 }}>THIN GLYPH TYPE</div>
                            <Slider label="TEXT SIZE" value={typeSize} min={12} max={320} step={1} onChange={setTypeSize} suffix="px" />
                            <textarea
                                className="w95-input w-full"
                                value={typeText}
                                onChange={(e) => setTypeText(e.target.value.toUpperCase())}
                                rows={3}
                                maxLength={80}
                                placeholder="TYPE TAG TEXT"
                                style={{ resize: "none", fontSize: 18 }}
                            />
                            <button
                                className={`w95-button w-full mt-1 ${tool === "type" ? "active" : ""}`}
                                onClick={() => setTool("type")}
                                aria-pressed={tool === "type"}
                                style={toolModeButtonStyle("type")}
                            >
                                {tool === "type" ? "✓ TYPE TOOL ON" : "TYPE TOOL: CLICK WALL"}
                            </button>
                        </div>

                        <div>
                            <div className="font-pixel px-2 py-1 mb-2" style={{ background: "#000080", color: "#fff", fontSize: 9 }}>PLACEMENT</div>
                            <Slider label="ELEMENT SCALE" value={placementScale} min={10} max={400} step={1} onChange={setPlacementScale} suffix="%" />
                            <Slider label="ROTATE" value={placementRotation} min={-180} max={180} step={1} onChange={setPlacementRotation} suffix="deg" />
                            <div className="w95-bevel-inset mt-2 p-2 font-mono-retro" style={{ fontSize: 14, color: "#444" }}>
                                {tool === "sticker" && pendingSticker
                                    ? `sticker: ${pendingSticker.name.slice(0, 22)}`
                                    : "hover wall to preview, click to apply"}
                            </div>
                            <button
                                className={`w95-button w-full mt-1 ${tool === "sticker" ? "active" : ""}`}
                                disabled={!pendingSticker}
                                onClick={() => setTool("sticker")}
                                aria-pressed={tool === "sticker"}
                                style={toolModeButtonStyle("sticker", !pendingSticker)}
                            >
                                {tool === "sticker" ? "✓ STICKER TOOL ON" : "STICKER TOOL: CLICK WALL"}
                            </button>
                        </div>

                            <div>
                            <div className="font-pixel px-2 py-1 mb-2" style={{ background: "#000080", color: "#fff", fontSize: 9 }}>
                                DINGBAT MATRIX ({glyphCatalog.length})
                            </div>
                            <button
                                className={`w95-button w-full ${tool === "glyph" ? "active" : ""}`}
                                disabled={glyphCatalog.length === 0}
                                onClick={() => setTool("glyph")}
                                aria-pressed={tool === "glyph"}
                                style={toolModeButtonStyle("glyph", glyphCatalog.length === 0)}
                            >
                                {tool === "glyph" ? "✓ DINGBATS ON" : "DINGBATS STAMP"}
                            </button>
                            <div
                                className="w95-bevel-inset mt-2"
                                style={{
                                    maxHeight: 340,
                                    overflowY: "auto",
                                    overflowX: "hidden",
                                    background:
                                        "linear-gradient(45deg, #d4d0c8 25%, #f4f4f4 25%, #f4f4f4 50%, #d4d0c8 50%, #d4d0c8 75%, #f4f4f4 75%)",
                                    backgroundSize: "16px 16px",
                                }}
                            >
                                        <div
                                            className="p-1"
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                                                gap: 6,
                                                alignItems: "stretch",
                                            }}
                                        >
                                    {glyphCatalog.map((glyph) => {
                                        const selected = activeGlyphId === glyph.id;
                                        return (
                                            <button
                                                key={glyph.id}
                                                title={glyph.label}
                                                onClick={() => setActiveGlyphId(glyph.id)}
                                                className={`w95-button ${selected ? "active" : ""}`}
                                                style={{
                                                    padding: 2,
                                                    minHeight: 60,
                                                    minWidth: 0,
                                                    border: selected ? "2px solid #ff00ff" : "2px solid #333",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    background: "#fff",
                                                }}
                                            >
                                                <img
                                                    src={glyph.url}
                                                    alt={glyph.label}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        maxWidth: 62,
                                                        maxHeight: 52,
                                                        objectFit: "contain",
                                                        imageRendering: "pixelated",
                                                    }}
                                                    draggable={false}
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {glyphLoadError && (
                                <div className="font-mono-retro mt-1" style={{ fontSize: 10, color: "#a00", lineHeight: 1.2 }}>
                                    {glyphLoadError}
                                </div>
                            )}
                            {glyphLoadState === "LOADING" && !glyphLoadError && (
                                <div className="font-mono-retro mt-1" style={{ fontSize: 10, color: "#444", lineHeight: 1.2 }}>
                                    loading 120 glyphs...
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="font-pixel px-2 py-1 mb-2" style={{ background: "#000080", color: "#fff", fontSize: 9 }}>UPLOAD / STICKER</div>
                            <button className="w95-button w-full" onClick={() => fileInputRef.current?.click()}>UPLOAD IMAGE</button>
                            {pendingSticker && (
                                <div className="mt-2">
                                    <div className="grid grid-cols-2 gap-1 mb-1">
                                        <button
                                            type="button"
                                            className={`w95-button ${stickerCutTool === "magic" ? "active" : ""}`}
                                            onClick={() => {
                                                setStickerCutTool("magic");
                                                setStickerLassoPoints([]);
                                            }}
                                            style={{
                                                minHeight: 30,
                                                background: stickerCutTool === "magic" ? "#000080" : undefined,
                                                color: stickerCutTool === "magic" ? "#fff" : undefined,
                                                boxShadow: stickerCutTool === "magic" ? "inset 2px 2px 0 #000, inset -1px -1px 0 #fff, 0 0 0 2px #00ffff" : undefined,
                                            }}
                                        >
                                            <span className="font-pixel" style={{ fontSize: 8 }}>MAGIC BG</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`w95-button ${stickerCutTool === "lasso" ? "active" : ""}`}
                                            onClick={() => {
                                                setStickerCutTool("lasso");
                                                setStickerLassoPoints([]);
                                                setStatus("LASSO: DRAW A LOOP");
                                            }}
                                            style={{
                                                minHeight: 30,
                                                background: stickerCutTool === "lasso" ? "#000080" : undefined,
                                                color: stickerCutTool === "lasso" ? "#fff" : undefined,
                                                boxShadow: stickerCutTool === "lasso" ? "inset 2px 2px 0 #000, inset -1px -1px 0 #fff, 0 0 0 2px #00ffff" : undefined,
                                            }}
                                        >
                                            <span className="font-pixel" style={{ fontSize: 8 }}>LASSO CUT</span>
                                        </button>
                                    </div>
                                    <div
                                        className="w95-bevel-inset p-1"
                                        title={stickerCutTool === "lasso"
                                            ? "draw around the part to keep"
                                            : "click the sticker background color to cut it out"}
                                        onClick={handleStickerThumbClick}
                                        onPointerDown={handleStickerLassoPointerDown}
                                        onPointerMove={handleStickerLassoPointerMove}
                                        onPointerUp={handleStickerLassoPointerUp}
                                        onPointerCancel={handleStickerLassoPointerUp}
                                        style={{
                                            position: "relative",
                                            height: 138,
                                            display: "grid",
                                            placeItems: "center",
                                            cursor: stickerCutTool === "lasso" ? "cell" : "crosshair",
                                            userSelect: "none",
                                            touchAction: "none",
                                            background:
                                                "linear-gradient(45deg, #d4d0c8 25%, #f4f4f4 25%, #f4f4f4 50%, #d4d0c8 50%, #d4d0c8 75%, #f4f4f4 75%)",
                                            backgroundSize: "16px 16px",
                                        }}
                                    >
                                        <img
                                            ref={stickerPreviewImgRef}
                                            src={pendingSticker.dataUrl}
                                            alt=""
                                            draggable={false}
                                            style={{
                                                maxWidth: "100%",
                                                maxHeight: "126px",
                                                objectFit: "contain",
                                                imageRendering: "pixelated",
                                                pointerEvents: "none",
                                            }}
                                        />
                                        {stickerCutTool === "lasso" && stickerLassoPoints.length > 0 && (
                                            <svg
                                                aria-hidden
                                                style={{
                                                    position: "absolute",
                                                    inset: 0,
                                                    width: "100%",
                                                    height: "100%",
                                                    pointerEvents: "none",
                                                    overflow: "visible",
                                                }}
                                            >
                                                {stickerLassoPoints.length > 2 && (
                                                    <polygon
                                                        points={stickerLassoPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                                                        fill="rgba(0,255,255,0.16)"
                                                        stroke="none"
                                                    />
                                                )}
                                                <polyline
                                                    points={stickerLassoPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                                                    fill="none"
                                                    stroke="#00ffff"
                                                    strokeWidth="2"
                                                    strokeDasharray="5 3"
                                                />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="font-mono-retro mt-1" style={{ fontSize: 13, color: "#555" }}>
                                        {stickerCutTool === "lasso"
                                            ? "draw loop around sticker area to keep"
                                            : "click preview bg to magic-cut"}
                                    </div>
                                    <Slider label="BG TOLERANCE" value={stickerBgTolerance} min={0} max={170} step={1} onChange={handleStickerToleranceChange} />
                                    <div className="flex gap-1 mt-1">
                                        <button className="w95-button flex-1" onClick={autoWhiteStickerCut}>AUTO WHITE</button>
                                        <button className="w95-button flex-1" onClick={resetStickerCut}>RESET CUT</button>
                                    </div>
                                    <div className="w95-bevel-inset mt-1 p-1 font-mono-retro flex items-center gap-2" style={{ fontSize: 13, color: "#444" }}>
                                        <span
                                            style={{
                                                width: 14,
                                                height: 14,
                                                display: "inline-block",
                                                border: "1px solid #000",
                                                background: pendingSticker.sampleColor
                                                    ? `rgb(${pendingSticker.sampleColor.r}, ${pendingSticker.sampleColor.g}, ${pendingSticker.sampleColor.b})`
                                                    : "#d4d0c8",
                                            }}
                                        />
                                        {pendingSticker.cutMode === "sample"
                                            ? "sample cut active"
                                            : pendingSticker.cutMode === "auto-white"
                                                ? "auto white cut"
                                                : "no bg cut"}
                                    </div>
                                </div>
                            )}
                            <div className="w95-bevel-inset mt-2 p-2 text-center font-mono-retro" style={{ fontSize: 15, color: "#666" }}>
                                drag image onto wall<br />.png .gif .jpg
                            </div>
                        </div>
                    </aside>
                </div>

                <div className="w95-bevel-inset mx-1 mb-1">
                    <div className="font-pixel px-2 py-1" style={{ background: "#000080", color: "#fff", fontSize: 9 }}>ACTIVE ARTISTS ({artists.length})</div>
                    <div className="flex gap-2 p-2 overflow-x-auto" data-testid="wall-active-artists">
                        {artists.map((artist) => (
                            <div key={artist.id} className="w95-bevel-inset relative p-1 text-center" style={{ width: 76, flex: "0 0 auto", background: "#d4d0c8" }}>
                                <div className="absolute" style={{ right: 3, top: 3, width: 8, height: 8, background: artist.fake ? "#9cff00" : "#00ff55", border: "1px solid #063" }} />
                                <div style={{ width: 58, height: 58, margin: "0 auto", background: artist.color, border: "2px solid #000", overflow: "hidden", display: "grid", placeItems: "center" }}>
                                    {artist.avatarUrl ? (
                                        <img src={artist.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated" }} draggable={false} />
                                    ) : artist.animId ? (
                                        <img src={`/anim/${artist.animId}/idle_0.png`} alt="" style={{ maxWidth: "90%", maxHeight: "90%", imageRendering: "pixelated" }} draggable={false} />
                                    ) : (
                                        <span className="font-pixel" style={{ fontSize: 15 }}>{artist.name.slice(0, 2)}</span>
                                    )}
                                </div>
                                <div className="font-pixel truncate mt-1" style={{ fontSize: 7 }} title={artist.name}>{artist.name}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex w95-bevel-inset mx-1 mb-1 font-mono-retro" style={{ height: 30, fontSize: 16 }}>
                    <div className="px-3 flex items-center" style={{ flex: 1 }}>CONNECTED: 238 ARTISTS ONLINE</div>
                    <div className="px-3 flex items-center" style={{ flex: 1, borderLeft: "1px solid #808080" }}>SURFACE: {surface.toUpperCase()} WALL</div>
                    <div className="px-3 flex items-center" style={{ flex: 1, borderLeft: "1px solid #808080" }}>TOOL: {tool.toUpperCase()}</div>
                    <div className="px-3 flex items-center" style={{ flex: 1, borderLeft: "1px solid #808080" }}><span style={{ color: paintColor, marginRight: 6 }}>■</span> COLOR: {paintColor.toUpperCase()}</div>
                    <div className="px-3 flex items-center" style={{ flex: 1, borderLeft: "1px solid #808080" }}>STATUS: {status} {marks ? `(${marks})` : ""}</div>
                </div>
            </div>
        </Win95Window>
    );
}
