import axios from "axios";

const PREVIEW_MOCK = process.env.REACT_APP_PREVIEW_MOCK === "1";

const PREVIEW_ROOMS = [
    { id: "hello", name: "HELLO WORLD", tagline: "good weird starts here", theme: "hello", bg_url: "/worlds/hello.png" },
    { id: "jello", name: "JELLO LOUNGE", tagline: "wiggly social gelatin", theme: "jello", bg_url: "/worlds/jello.png" },
    { id: "heaven", name: "HEAVEN GATE", tagline: "clouds, halos, questionable snacks", theme: "heaven", bg_url: "/worlds/heaven.png" },
    { id: "mars", name: "MARS YARD", tagline: "red dust transmission", theme: "mars", bg_url: "/worlds/mars.png" },
    { id: "neoclassick-world", name: "NEOCLASSICK WORLD", tagline: "where we play golf at a high level", theme: "neoclassick-world", bg_url: "/worlds/neoclassick-world.png" },
    { id: "wwworld", name: "WWWORLD", tagline: "let's get meta", theme: "wwworld", bg_url: "/worlds/wwworld.png" },
    { id: "regular-cafe", name: "REGULAR CAFE", tagline: "almost normal", theme: "regular-cafe", bg_url: "/worlds/regular-cafe.png" },
    { id: "toxic-void", name: "TOXIC VOID", tagline: "hazardous signal is alive", theme: "toxic-void", bg_url: "/worlds/toxic-void.png" },
    { id: "basketball-court", name: "BASKETBALL COURT", tagline: "court of strange rebounds", theme: "basketball-court", bg_url: "/worlds/basketball-court.png" },
    { id: "food-court", name: "FOOD COURT", tagline: "mall snacks, shared static", theme: "food-court", bg_url: "/worlds/food-court.png" },
    { id: "jungle", name: "JUNGLE", tagline: "green signal overgrowth", theme: "jungle", bg_url: "/worlds/jungle.png" },
    { id: "spiderweb", name: "SPIDERWEB", tagline: "sticky hallway of whispers", theme: "spiderweb", bg_url: "/worlds/spiderweb.png" },
    { id: "liminal-backroom", name: "LIMINAL BACKROOM", tagline: "final form: the room remembers wrong", theme: "liminal-backroom", bg_url: "/worlds/liminal-backroom.png" },
    { id: "inspiration-theatre", name: "INSPIRATION THEATRE", tagline: "groupwatch weird together", theme: "inspiration-theatre", bg_url: "/worlds/inspiration-theatre.png" },
];

function getBackendUrl() {
    const configured = process.env.REACT_APP_BACKEND_URL?.trim();
    if (configured) return configured.replace(/\/+$/, "");
    if (typeof window === "undefined") return "http://localhost:8001";
    const { protocol, hostname, port, origin } = window.location;
    if (port === "3000") return `${protocol}//${hostname}:8001`;
    return origin;
}

const BACKEND_URL = getBackendUrl();
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

const warnedPreviewFallbacks = new Set();

function canUsePreviewFallback(error) {
    return process.env.NODE_ENV !== "production" && !error?.response;
}

function warnPreviewFallback(label, error) {
    if (warnedPreviewFallbacks.has(label)) return;
    warnedPreviewFallbacks.add(label);
    console.warn(
        `[g00dweird] backend unavailable for ${label}; using local preview fallback`,
        error?.message || error
    );
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("could not read file"));
        reader.readAsDataURL(file);
    });
}

function makePreviewProfile(nickname, userId = null) {
    return {
        user_id: userId || `preview-${nickname}`,
        nickname,
        bio: "preview profile",
        created_at: new Date().toISOString(),
        last_room_id: "hello",
        last_seen_at: new Date().toISOString(),
        sprite_id: "ghost_cute",
        anim_id: null,
        avatar_path: null,
        banner_path: null,
        live_room_id: "hello",
        live_room_name: "HELLO WORLD",
        tags: [],
        uploads: [],
    };
}

async function uploadPreviewFile({ file, user_id, nickname, kind, onProgress }) {
    const localUrl = file?.type?.startsWith("image/")
        ? await readFileAsDataUrl(file).catch(() => "")
        : "";
    onProgress?.(100);
    return {
        id: `preview-upload-${Date.now()}`,
        user_id,
        nickname,
        kind,
        storage_path: localUrl,
        original_filename: file?.name || "preview-upload",
        content_type: file?.type || "application/octet-stream",
        size: file?.size || 0,
        created_at: new Date().toISOString(),
    };
}

export async function joinWithNickname(nickname) {
    if (PREVIEW_MOCK) {
        return { user_id: `preview-${Date.now()}`, nickname };
    }
    try {
        const { data } = await api.post("/join", { nickname });
        return data;
    } catch (error) {
        if (canUsePreviewFallback(error)) {
            warnPreviewFallback("join", error);
            return { user_id: `preview-${Date.now()}`, nickname };
        }
        throw error;
    }
}

export async function listRooms() {
    if (PREVIEW_MOCK) return PREVIEW_ROOMS;
    try {
        const { data } = await api.get("/rooms");
        return data;
    } catch (error) {
        if (canUsePreviewFallback(error)) {
            warnPreviewFallback("rooms", error);
            return PREVIEW_ROOMS;
        }
        throw error;
    }
}

export async function uploadFile({ file, user_id, nickname, kind, onProgress }) {
    if (PREVIEW_MOCK) {
        return uploadPreviewFile({ file, user_id, nickname, kind, onProgress });
    }
    const form = new FormData();
    form.append("file", file);
    form.append("user_id", user_id);
    form.append("nickname", nickname);
    form.append("kind", kind);
    try {
        const { data } = await api.post("/upload", form, {
            onUploadProgress: (e) => {
                if (onProgress && e.total)
                    onProgress(Math.round((e.loaded * 100) / e.total));
            },
        });
        return data;
    } catch (error) {
        if (canUsePreviewFallback(error)) {
            warnPreviewFallback("upload", error);
            return uploadPreviewFile({ file, user_id, nickname, kind, onProgress });
        }
        throw error;
    }
}

export async function getUserMedia(user_id) {
    if (PREVIEW_MOCK) return [];
    try {
        const { data } = await api.get(`/users/${user_id}/media`);
        return data;
    } catch (error) {
        if (canUsePreviewFallback(error)) {
            warnPreviewFallback("user media", error);
            return [];
        }
        throw error;
    }
}

export async function getUserBio(user_id) {
    if (PREVIEW_MOCK) return { user_id, bio: "preview mode: profile storage comes online with the real backend" };
    try {
        const { data } = await api.get(`/users/${user_id}/bio`);
        return data;
    } catch (error) {
        if (canUsePreviewFallback(error)) {
            warnPreviewFallback("user bio", error);
            return { user_id, bio: "" };
        }
        throw error;
    }
}

export async function setUserBio(user_id, bio) {
    if (PREVIEW_MOCK) return { user_id, bio };
    try {
        const { data } = await api.put(`/users/${user_id}/bio`, { bio });
        return data;
    } catch (error) {
        if (canUsePreviewFallback(error)) {
            warnPreviewFallback("set user bio", error);
            return { user_id, bio };
        }
        throw error;
    }
}

export async function getRecentMedia(kind) {
    if (PREVIEW_MOCK) return [];
    const url = kind ? `/media/recent?kind=${kind}` : "/media/recent";
    try {
        const { data } = await api.get(url);
        return data;
    } catch (error) {
        if (canUsePreviewFallback(error)) {
            warnPreviewFallback("recent media", error);
            return [];
        }
        throw error;
    }
}

export async function getPublicProfile(nickname, userId = null) {
    if (PREVIEW_MOCK) {
        return makePreviewProfile(nickname, userId);
    }
    const url = userId
        ? `/profile/${encodeURIComponent(nickname)}?user_id=${encodeURIComponent(userId)}`
        : `/profile/${encodeURIComponent(nickname)}`;
    try {
        const { data } = await api.get(url);
        return data;
    } catch (error) {
        if (canUsePreviewFallback(error)) {
            warnPreviewFallback("public profile", error);
            return makePreviewProfile(nickname, userId);
        }
        throw error;
    }
}

export function fileUrl(storage_path) {
    if (!storage_path) return "";
    if (/^(data:|blob:|https?:\/\/|\/)/.test(storage_path)) return storage_path;
    return `${API}/files/${storage_path}`;
}

export function wsUrl(room_id, { user_id, nickname, avatar_url, sprite_id, anim_id }) {
    const base = BACKEND_URL.replace(/^http/, "ws");
    const params = new URLSearchParams({ user_id, nickname });
    if (avatar_url) params.set("avatar_url", avatar_url);
    if (sprite_id) params.set("sprite_id", sprite_id);
    if (anim_id) params.set("anim_id", anim_id);
    return `${base}/api/ws/${room_id}?${params.toString()}`;
}
