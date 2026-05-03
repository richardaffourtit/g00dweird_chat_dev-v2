import { useEffect, useMemo, useState } from "react";

export const SPRAY_ASSET_SCHEMA = "g00dweird.sprayAsset.v1";
export const SPRAY_ASSETS_EVENT = "gw:spray-assets-changed";
export const WALL_SNAPSHOTS_EVENT = "gw:wall-snapshots-changed";

const ASSET_STORAGE_KEY = "gw_spray_assets_v1";
const SNAPSHOT_STORAGE_KEY = "gw_wall_snapshots_v1";
const MAX_ASSETS = 80;
const MAX_SNAPSHOTS = 12;

export const SPRAY_LIBRARY_SECTIONS = [
    { id: "brushes", label: "Brushes" },
    { id: "my-tags", label: "My Tags" },
    { id: "wall-cuts", label: "Wall Cuts" },
    { id: "uploads", label: "Uploads" },
    { id: "recent", label: "Recent" },
];

export const WALL_SOURCE_IMAGES = [
    { id: "tags1", label: "tags1 sheet", url: "/spray/sources/tags1.png" },
    { id: "tags2", label: "tags2 sheet", url: "/spray/sources/tags2.png" },
];

function nowIso() {
    return new Date().toISOString();
}

function makeId(prefix = "spray") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeRead(key, fallback) {
    if (typeof window === "undefined") return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}

function safeWrite(key, value, eventName) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
        window.dispatchEvent(new CustomEvent(eventName, { detail: value }));
    } catch (error) {
        console.warn(`[g00dweird] could not persist ${key}`, error);
    }
}

function normalizeAsset(input) {
    const createdAt = input.createdAt || nowIso();
    const kind = input.kind || "wall-cut";
    const name = String(input.name || input.title || kind).trim().slice(0, 40) || "wall cut";
    return {
        schema: SPRAY_ASSET_SCHEMA,
        id: input.id || makeId(kind),
        name,
        kind,
        source: input.source || "wall.exe",
        surface: input.surface || "unknown",
        style: input.style || input.extractionMode || "as-seen",
        imageUrl: input.imageUrl || input.dataUrl || "",
        thumbUrl: input.thumbUrl || input.imageUrl || input.dataUrl || "",
        width: Math.max(1, Math.round(Number(input.width) || 1)),
        height: Math.max(1, Math.round(Number(input.height) || 1)),
        selection: input.selection || null,
        createdAt,
        updatedAt: input.updatedAt || createdAt,
        lastUsedAt: input.lastUsedAt || null,
    };
}

export function getSprayAssets() {
    return safeRead(ASSET_STORAGE_KEY, []).filter((asset) => asset?.schema === SPRAY_ASSET_SCHEMA && asset.imageUrl);
}

export function saveSprayAsset(input) {
    const asset = normalizeAsset(input);
    const next = [asset, ...getSprayAssets().filter((item) => item.id !== asset.id)].slice(0, MAX_ASSETS);
    safeWrite(ASSET_STORAGE_KEY, next, SPRAY_ASSETS_EVENT);
    return asset;
}

export function removeSprayAsset(id) {
    const next = getSprayAssets().filter((asset) => asset.id !== id);
    safeWrite(ASSET_STORAGE_KEY, next, SPRAY_ASSETS_EVENT);
    return next;
}

export function recordSprayAssetUse(id) {
    const assets = getSprayAssets();
    let changed = false;
    const next = assets.map((asset) => {
        if (asset.id !== id) return asset;
        changed = true;
        return { ...asset, lastUsedAt: nowIso(), updatedAt: nowIso() };
    });
    if (changed) safeWrite(ASSET_STORAGE_KEY, next, SPRAY_ASSETS_EVENT);
}

export function compactSprayAssetForTag(asset) {
    if (!asset?.imageUrl) return null;
    return {
        schema: SPRAY_ASSET_SCHEMA,
        id: asset.id,
        name: asset.name,
        kind: asset.kind,
        source: asset.source,
        surface: asset.surface,
        style: asset.style,
        imageUrl: asset.imageUrl,
        width: asset.width,
        height: asset.height,
    };
}

export function getWallSnapshots() {
    return safeRead(SNAPSHOT_STORAGE_KEY, []);
}

export function saveWallSnapshot(input) {
    const createdAt = nowIso();
    const snapshot = {
        id: input.id || makeId("wall-snapshot"),
        source: "wall.exe",
        surface: input.surface || "unknown",
        imageUrl: input.imageUrl || input.dataUrl || "",
        width: Math.max(1, Math.round(Number(input.width) || 1)),
        height: Math.max(1, Math.round(Number(input.height) || 1)),
        createdAt,
        note: input.note || "full wall snapshot",
    };
    const next = [snapshot, ...getWallSnapshots().filter((item) => item.id !== snapshot.id)].slice(0, MAX_SNAPSHOTS);
    safeWrite(SNAPSHOT_STORAGE_KEY, next, WALL_SNAPSHOTS_EVENT);
    return snapshot;
}

export function useSprayAssets() {
    const [assets, setAssets] = useState(() => getSprayAssets());

    useEffect(() => {
        const refresh = () => setAssets(getSprayAssets());
        window.addEventListener(SPRAY_ASSETS_EVENT, refresh);
        window.addEventListener("storage", refresh);
        return () => {
            window.removeEventListener(SPRAY_ASSETS_EVENT, refresh);
            window.removeEventListener("storage", refresh);
        };
    }, []);

    const sections = useMemo(() => ({
        "my-tags": assets.filter((asset) => asset.kind === "tag"),
        "wall-cuts": assets.filter((asset) => asset.kind === "wall-cut" || asset.kind === "sticker"),
        uploads: assets.filter((asset) => asset.kind === "upload"),
        recent: [...assets]
            .filter((asset) => asset.lastUsedAt || asset.createdAt)
            .sort((a, b) => String(b.lastUsedAt || b.createdAt).localeCompare(String(a.lastUsedAt || a.createdAt)))
            .slice(0, 12),
    }), [assets]);

    return { assets, sections, removeAsset: removeSprayAsset, refresh: () => setAssets(getSprayAssets()) };
}
