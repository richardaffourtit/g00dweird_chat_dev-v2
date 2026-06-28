import { useEffect, useRef, useState, useCallback } from "react";
import { wsUrl } from "./api";

const PREVIEW_MOCK = process.env.REACT_APP_PREVIEW_MOCK === "1";

const PREVIEW_WEIRDBOT_SAYINGS = [
    "PSA: the chairs are gossiping about the ceiling.",
    "breaking news: a tiny wizard was spotted in the vending machine.",
    "attention citizens: the soup has become self aware.",
    "reminder: never trust a doorway that blinks first.",
    "status update: the moon just left me on read.",
    "important: somebody fed static to the signal again.",
];

const PREVIEW_WEIRDBOT_THINKS = [
    "i just heard a lamp apologize to the moon",
    "the carpet is remembering your footsteps",
    "someone microwaved a prophecy",
    "i found a staircase hiding inside a soup",
    "the hallway is chewing bubblegum again",
    "the void is wearing eyeliner tonight",
];

const PREVIEW_WEIRDBOT_SPEECH_MS = 180000;
const PREVIEW_WEIRDBOT_FIRST_SPEECH_MS = PREVIEW_WEIRDBOT_SPEECH_MS;
const PREVIEW_WEIRDBOT_AMBIENT_MS = 7200;
const PREVIEW_WEIRDBOT_NEXT_THOUGHT_MS = 16000;
const PREVIEW_WEIRDBOT_THOUGHT_MS = 45000;
const PREVIEW_WEIRDBOT_THOUGHT_HOLD_MS = 11000;
const PREVIEW_WEIRDBOT_BOUNDS = { minX: 125, maxX: 875, minY: 205, maxY: 430 };
const PREVIEW_WEIRDBOT_MOVE_MIN = 92;
const PREVIEW_WEIRDBOT_MOVE_X_RANGE = 260;
const PREVIEW_WEIRDBOT_MOVE_Y_RANGE = 125;
const PREVIEW_TAG_STORAGE_PREFIX = "gw_preview_tags:";

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function pickPreviewBotAction() {
    const weighted = ["walk", "walk", "walk", "walk", "walk", "walk", "glitch", "idle"];
    return pick(weighted);
}

function facingFromMove(prev, nextX, fallback = null) {
    if (fallback === "left" || fallback === "right") return fallback;
    if (!prev || typeof prev.x !== "number") return "right";
    const dx = nextX - prev.x;
    if (Math.abs(dx) < 1) return prev.facing || "right";
    return dx < 0 ? "left" : "right";
}

function clampPreviewBotValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function pickPreviewBotTarget(bot) {
    const currentX = Number.isFinite(bot?.x) ? bot.x : 250;
    const currentY = Number.isFinite(bot?.y) ? bot.y : 250;
    for (let attempt = 0; attempt < 4; attempt += 1) {
        const nextX = clampPreviewBotValue(
            currentX + (Math.random() * PREVIEW_WEIRDBOT_MOVE_X_RANGE * 2 - PREVIEW_WEIRDBOT_MOVE_X_RANGE),
            PREVIEW_WEIRDBOT_BOUNDS.minX,
            PREVIEW_WEIRDBOT_BOUNDS.maxX,
        );
        const nextY = clampPreviewBotValue(
            currentY + (Math.random() * PREVIEW_WEIRDBOT_MOVE_Y_RANGE * 2 - PREVIEW_WEIRDBOT_MOVE_Y_RANGE),
            PREVIEW_WEIRDBOT_BOUNDS.minY,
            PREVIEW_WEIRDBOT_BOUNDS.maxY,
        );
        const dx = nextX - currentX;
        const dy = nextY - currentY;
        if ((dx * dx) + (dy * dy) >= PREVIEW_WEIRDBOT_MOVE_MIN * PREVIEW_WEIRDBOT_MOVE_MIN) {
            return { x: nextX, y: nextY };
        }
    }
    const roomMidX = (PREVIEW_WEIRDBOT_BOUNDS.minX + PREVIEW_WEIRDBOT_BOUNDS.maxX) / 2;
    const nextX = currentX < roomMidX ? PREVIEW_WEIRDBOT_BOUNDS.maxX : PREVIEW_WEIRDBOT_BOUNDS.minX;
    const nextY = clampPreviewBotValue(
        currentY + (Math.random() * PREVIEW_WEIRDBOT_MOVE_Y_RANGE * 2 - PREVIEW_WEIRDBOT_MOVE_Y_RANGE),
        PREVIEW_WEIRDBOT_BOUNDS.minY,
        PREVIEW_WEIRDBOT_BOUNDS.maxY,
    );
    return { x: nextX, y: nextY };
}

function isFullfunk(msg) {
    return !!(msg?.fullfunk || msg?.is_fullfunk);
}

function clearMappedTimer(timerMap, key) {
    const timerId = timerMap.get(key);
    if (!timerId) return;
    window.clearTimeout(timerId);
    timerMap.delete(key);
}

function tagBelongsToRoom(tag, roomId) {
    if (!tag || !roomId) return false;
    return !tag.room_id || tag.room_id === roomId;
}

function previewTagStorageKey(roomId) {
    return `${PREVIEW_TAG_STORAGE_PREFIX}${roomId || "unknown"}`;
}

function readPreviewTags(roomId) {
    if (!roomId || typeof window === "undefined") return [];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(previewTagStorageKey(roomId)) || "[]");
        return Array.isArray(parsed)
            ? parsed.filter((tag) => tagBelongsToRoom(tag, roomId)).slice(-80)
            : [];
    } catch {
        return [];
    }
}

function writePreviewTags(roomId, nextTags) {
    if (!roomId || typeof window === "undefined") return;
    try {
        window.localStorage.setItem(previewTagStorageKey(roomId), JSON.stringify(nextTags.slice(-80)));
    } catch {
        /* ignore preview storage failures */
    }
}

export function useChatSocket({ user, room, avatarUrl, spriteId, animId }) {
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [connected, setConnected] = useState(false);
    const [localPreview, setLocalPreview] = useState(false);
    const [currentAudio, setCurrentAudio] = useState(null);
    const [currentVideo, setCurrentVideo] = useState(null);
    const [audioQueue, setAudioQueue] = useState([]);
    const [videoQueue, setVideoQueue] = useState([]);
    const [typingUsers, setTypingUsers] = useState({});
    const [tags, setTags] = useState([]);
    const [currentYoutube, setCurrentYoutube] = useState(null);
    const [youtubeQueue, setYoutubeQueue] = useState([]);
    const [basketballShots, setBasketballShots] = useState([]);
    const wsRef = useRef(null);
    const attackTimersRef = useRef(new Map());
    const previewHitCountsRef = useRef(new Map());
    const roomId = room?.id;

    useEffect(() => {
        setLocalPreview(false);
    }, [roomId, user?.user_id]);

    useEffect(() => () => {
        attackTimersRef.current.forEach((timerId) => clearTimeout(timerId));
        attackTimersRef.current.clear();
    }, []);

    const send = useCallback((obj) => {
        if (obj.type === "avatar") {
            setUsers((u) => u.map((x) => x.user_id === user?.user_id
                ? { ...x, avatar_url: obj.avatar_url || null }
                : x));
        } else if (obj.type === "sprite") {
            setUsers((u) => u.map((x) => x.user_id === user?.user_id
                ? { ...x, avatar_url: null, sprite_id: obj.sprite_id || null, anim_id: null, anim_stance: "idle" }
                : x));
        } else if (obj.type === "anim") {
            setUsers((u) => u.map((x) => x.user_id === user?.user_id
                ? { ...x, avatar_url: null, anim_id: obj.anim_id || null, anim_stance: "idle" }
                : x));
        }
        if (PREVIEW_MOCK || localPreview) {
            if (obj.type === "chat" && obj.text) {
                const text = obj.text.trim();
                const fullfunk = isFullfunk(obj);
                if (text.startsWith("*think ") || text === "*think") {
                    const thought = text.startsWith("*think ") ? text.slice(7).trim() : "";
                    setUsers((u) => u.map((x) => x.user_id === user?.user_id
                        ? { ...x, thought: thought || null, thought_fullfunk: thought ? fullfunk : false }
                        : x));
                    return;
                }
                const ts = new Date().toISOString();
                setMessages((m) => [...m.slice(-200), {
                    type: "chat",
                    user_id: user?.user_id,
                    nickname: user?.nickname,
                    text,
                    ts,
                    fullfunk,
                    is_fullfunk: fullfunk,
                }]);
                setUsers((u) => u.map((x) => x.user_id === user?.user_id
                    ? { ...x, thought: null, last_message: { text, ts, fullfunk } }
                    : x));
            } else if (obj.type === "move") {
                setUsers((u) => u.map((x) => x.user_id === user?.user_id
                    ? { ...x, x: obj.x, y: obj.y, facing: facingFromMove(x, obj.x, obj.facing) }
                    : x));
            } else if (obj.type === "tag_spray" && obj.tag) {
                const rec = {
                    tag: String(obj.tag).trim().slice(0, 32),
                    custom: !!obj.custom,
                    x: Number.isFinite(obj.x) ? Math.max(10, Math.min(990, obj.x)) : 500,
                    y: Number.isFinite(obj.y) ? Math.max(10, Math.min(490, obj.y)) : 250,
                    rot: Number.isFinite(obj.rot) ? Math.max(-45, Math.min(45, obj.rot)) : 0,
                    scale: Number.isFinite(obj.scale) ? Math.max(0.3, Math.min(3, obj.scale)) : 1,
                    id: `preview-tag-${roomId || "room"}-${Date.now()}`,
                    image_url: obj.image_url || null,
                    image_name: obj.image_name || null,
                    room_id: roomId,
                    user_id: user?.user_id,
                    nickname: user?.nickname || "preview",
                    created_at: new Date().toISOString(),
                };
                setTags((t) => {
                    const next = [...t.filter((tag) => tagBelongsToRoom(tag, roomId)).slice(-79), rec];
                    writePreviewTags(roomId, next);
                    return next;
                });
            } else if (obj.type === "tag_clear") {
                setTags([]);
                writePreviewTags(roomId, []);
            } else if (obj.type === "basketball_shot") {
                setBasketballShots((shots) => [...shots.slice(-24), {
                    type: "basketball_shot",
                    id: obj.id || `preview-hoop-${Date.now()}`,
                    user_id: user?.user_id,
                    nickname: user?.nickname || "preview",
                    x: Number.isFinite(obj.x) ? Math.max(0, Math.min(1000, obj.x)) : 500,
                    y: Number.isFinite(obj.y) ? Math.max(0, Math.min(500, obj.y)) : 250,
                    vx: Number.isFinite(obj.vx) ? Math.max(-650, Math.min(650, obj.vx)) : 220,
                    vy: Number.isFinite(obj.vy) ? Math.max(-760, Math.min(320, obj.vy)) : -320,
                    target_x: Number.isFinite(obj.target_x) ? Math.max(0, Math.min(1000, obj.target_x)) : 500,
                    target_y: Number.isFinite(obj.target_y) ? Math.max(0, Math.min(500, obj.target_y)) : 250,
                    ts: new Date().toISOString(),
                }]);
            } else if (obj.type === "attack" && obj.target_id) {
                const attackerId = user?.user_id;
                const targetId = obj.target_id;
                if (!attackerId || targetId === attackerId) return;

                const nextHits = (previewHitCountsRef.current.get(targetId) || 0) + 1;
                const killed = nextHits >= 3;
                const targetStance = killed ? "die" : "hurt";
                previewHitCountsRef.current.set(targetId, killed ? 0 : nextHits);

                clearMappedTimer(attackTimersRef.current, `${attackerId}:attack`);
                clearMappedTimer(attackTimersRef.current, `${targetId}:hit`);

                setUsers((u) => u.map((x) => {
                    if (x.user_id === attackerId) {
                        return { ...x, anim_stance: "attack", thought: null };
                    }
                    if (x.user_id === targetId && !x.dead) {
                        return { ...x, anim_stance: targetStance, dead: killed, thought: null };
                    }
                    return x;
                }));

                const attackTimer = window.setTimeout(() => {
                    setUsers((u) => u.map((x) => (
                        x.user_id === attackerId && x.anim_stance === "attack"
                            ? { ...x, anim_stance: "idle" }
                            : x
                    )));
                    attackTimersRef.current.delete(`${attackerId}:attack`);
                }, 760);
                attackTimersRef.current.set(`${attackerId}:attack`, attackTimer);

                const targetTimer = window.setTimeout(() => {
                    setUsers((u) => u.map((x) => (
                        x.user_id === targetId && x.anim_stance === targetStance
                            ? { ...x, anim_stance: "idle", dead: false }
                            : x
                    )));
                    attackTimersRef.current.delete(`${targetId}:hit`);
                }, killed ? 1800 : 920);
                attackTimersRef.current.set(`${targetId}:hit`, targetTimer);
            } else if (obj.type === "stance") {
                const uid = user?.user_id;
                const stance = obj.stance || "idle";
                setUsers((u) => u.map((x) => x.user_id === uid ? { ...x, anim_stance: stance } : x));
            }
            return;
        }
        if (wsRef.current && wsRef.current.readyState === 1) {
            wsRef.current.send(JSON.stringify(obj));
        }
    }, [localPreview, roomId, user?.nickname, user?.user_id]);

    useEffect(() => {
        if (!roomId || !user) return undefined;
        if (PREVIEW_MOCK || localPreview) {
            const botUid = `weirdbot-${roomId}`;
            const timers = new Set();
            const schedule = (fn, ms) => {
                const id = window.setTimeout(() => {
                    timers.delete(id);
                    fn();
                }, ms);
                timers.add(id);
                return id;
            };
            const setBot = (updater) => {
                setUsers((prev) => prev.map((x) => (
                    x.user_id === botUid ? updater(x) : x
                )));
            };
            const setBotIdleLater = (stance, delay = 5200) => {
                schedule(() => {
                    setBot((bot) => (
                        bot.anim_stance === stance ? { ...bot, anim_stance: "idle" } : bot
                    ));
                }, delay);
            };
            const runBotAction = (forcedAction = null) => {
                const action = forcedAction || pickPreviewBotAction();
                if (action === "walk") {
                    setBot((bot) => {
                        const { x: nextX, y: nextY } = pickPreviewBotTarget(bot);
                        return {
                            ...bot,
                            x: nextX,
                            y: nextY,
                            facing: facingFromMove(bot, nextX),
                            anim_stance: "walk",
                            thought: null,
                        };
                    });
                    setBotIdleLater("walk", 4200);
                } else if (action === "glitch") {
                    setBot((bot) => ({ ...bot, anim_stance: "glitch", thought: null }));
                    setBotIdleLater("glitch", 2400);
                } else {
                    setBot((bot) => ({ ...bot, anim_stance: "idle" }));
                }
            };
            const runBotThought = () => {
                const thought = pick(PREVIEW_WEIRDBOT_THINKS);
                setBot((bot) => ({
                    ...bot,
                    anim_stance: "think",
                    thought,
                    thought_fullfunk: false,
                }));
                schedule(() => {
                    setBot((bot) => (
                        bot.thought === thought
                            ? { ...bot, thought: null, anim_stance: "idle" }
                            : bot
                    ));
                }, PREVIEW_WEIRDBOT_THOUGHT_HOLD_MS);
            };
            const runBotSpeech = () => {
                const text = pick(PREVIEW_WEIRDBOT_SAYINGS);
                const ts = new Date().toISOString();
                setBot((bot) => ({
                    ...bot,
                    anim_stance: "talk",
                    thought: null,
                    last_message: { text, ts, fullfunk: false },
                }));
                setMessages((m) => [...m.slice(-200), {
                    type: "chat",
                    user_id: botUid,
                    nickname: "weirdbot",
                    text,
                    ts,
                    is_fullfunk: false,
                    is_system: false,
                }]);
                setBotIdleLater("talk", 5200);
            };
            const firstThought = pick(PREVIEW_WEIRDBOT_THINKS);
            setConnected(true);
            setMessages([{
                type: "chat",
                user_id: "system",
                nickname: "system",
                text: "local static preview running",
                ts: new Date().toISOString(),
                is_system: true,
            }]);
            setUsers([
                {
                    user_id: user.user_id,
                    nickname: user.nickname,
                    avatar_url: avatarUrl || null,
                    sprite_id: spriteId || "ghost_cute",
                    anim_id: animId || null,
                    anim_stance: "idle",
                    facing: "right",
                    x: 42,
                    y: 58,
                },
                {
                    user_id: botUid,
                    nickname: "weirdbot",
                    avatar_url: null,
                    sprite_id: null,
                    anim_id: "weirdbot",
                    anim_stance: "think",
                    facing: "right",
                    x: 250,
                    y: 250,
                    thought: firstThought,
                    thought_fullfunk: false,
                },
            ]);
            setBasketballShots([]);
            setTags(readPreviewTags(roomId));
            schedule(() => {
                setBot((bot) => (
                    bot.thought === firstThought
                        ? { ...bot, thought: null, anim_stance: "idle" }
                        : bot
                ));
            }, PREVIEW_WEIRDBOT_THOUGHT_HOLD_MS);
            schedule(runBotThought, PREVIEW_WEIRDBOT_NEXT_THOUGHT_MS);
            schedule(runBotSpeech, PREVIEW_WEIRDBOT_FIRST_SPEECH_MS);
            const botAmbientInterval = window.setInterval(runBotAction, PREVIEW_WEIRDBOT_AMBIENT_MS);
            const botSpeechInterval = window.setInterval(runBotSpeech, PREVIEW_WEIRDBOT_SPEECH_MS);
            const botThoughtInterval = window.setInterval(runBotThought, PREVIEW_WEIRDBOT_THOUGHT_MS);
            return () => {
                window.clearInterval(botAmbientInterval);
                window.clearInterval(botSpeechInterval);
                window.clearInterval(botThoughtInterval);
                for (const timer of timers) window.clearTimeout(timer);
                timers.clear();
                setConnected(false);
            };
        }
        setMessages([]);
        setUsers([]);
        setTypingUsers({});
        setTags([]);
        setBasketballShots([]);
        const url = wsUrl(roomId, {
            user_id: user.user_id,
            nickname: user.nickname,
            avatar_url: avatarUrl || undefined,
            sprite_id: spriteId || undefined,
            anim_id: animId || undefined,
        });
        const ws = new WebSocket(url);
        let opened = false;
        wsRef.current = ws;
        const isCurrentSocket = () => wsRef.current === ws;
        ws.onopen = () => {
            opened = true;
            if (isCurrentSocket()) setConnected(true);
        };
        ws.onclose = () => {
            if (isCurrentSocket()) {
                setConnected(false);
                if (!opened) setLocalPreview(true);
            }
        };
        ws.onerror = () => {
            if (isCurrentSocket()) {
                setConnected(false);
                if (!opened) setLocalPreview(true);
            }
        };
        ws.onmessage = (ev) => {
            if (!isCurrentSocket()) return;
            let msg;
            try { msg = JSON.parse(ev.data); } catch { return; }
            switch (msg.type) {
                case "snapshot":
                    setUsers(msg.users || []);
                    setCurrentAudio(msg.current_audio || null);
                    setCurrentVideo(msg.current_video || null);
                    setAudioQueue(msg.audio_queue || []);
                    setVideoQueue(msg.video_queue || []);
                    setCurrentYoutube(msg.current_youtube || null);
                    setYoutubeQueue(msg.youtube_queue || []);
                    if (Array.isArray(msg.history)) setMessages(msg.history.slice(-200));
                    if (Array.isArray(msg.tags)) {
                        setTags(msg.tags.filter((tag) => tagBelongsToRoom(tag, roomId)));
                    }
                    break;
                case "chat":
                    setMessages((m) => [...m.slice(-200), msg]);
                    if (msg.user_id && msg.user_id !== "system") {
                        setUsers((u) => u.map((x) =>
                            x.user_id === msg.user_id
                                ? { ...x, thought: null, last_message: { text: msg.text, ts: msg.ts, fullfunk: isFullfunk(msg) } }
                                : x
                        ));
                    }
                    break;
                case "thought":
                    setUsers((u) => u.map((x) =>
                        x.user_id === msg.user_id
                            ? { ...x, thought: msg.thought, thought_fullfunk: isFullfunk(msg) }
                            : x
                    ));
                    break;
                case "typing": {
                    const nick = msg.nickname;
                    setTypingUsers((prev) => {
                        const next = { ...prev };
                        if (msg.typing) next[nick] = Date.now();
                        else delete next[nick];
                        return next;
                    });
                    break;
                }
                case "user_joined":
                    setUsers((u) => u.find(x => x.user_id === msg.user.user_id) ? u : [...u, msg.user]);
                    break;
                case "user_left":
                    setUsers((u) => u.filter(x => x.user_id !== msg.user_id));
                    break;
                case "move":
                    setUsers((u) => u.map(x => x.user_id === msg.user_id
                        ? { ...x, x: msg.x, y: msg.y, facing: facingFromMove(x, msg.x, msg.facing) }
                        : x));
                    break;
                case "avatar":
                    setUsers((u) => u.map(x => x.user_id === msg.user_id ? { ...x, avatar_url: msg.avatar_url } : x));
                    break;
                case "sprite":
                    setUsers((u) => u.map(x => x.user_id === msg.user_id ? { ...x, sprite_id: msg.sprite_id } : x));
                    break;
                case "anim":
                    setUsers((u) => u.map(x => x.user_id === msg.user_id ? { ...x, anim_id: msg.anim_id } : x));
                    break;
                case "stance":
                    setUsers((u) => u.map(x => x.user_id === msg.user_id ? { ...x, anim_stance: msg.stance } : x));
                    break;
                case "attack":
                    // Optional cosmetic event — already drives 'stance' broadcasts; nothing to update
                    break;
                case "die":
                    setUsers((u) => u.map(x => x.user_id === msg.user_id ? { ...x, anim_stance: "die", dead: true } : x));
                    break;
                case "respawn":
                    setUsers((u) => u.map(x => x.user_id === msg.user_id
                        ? { ...x, x: msg.x, y: msg.y, facing: facingFromMove(x, msg.x, msg.facing), anim_stance: "idle", dead: false }
                        : x));
                    break;
                case "kill_mode":
                    setUsers((u) => u.map(x => x.user_id === msg.user_id ? { ...x, kill_mode: !!msg.on } : x));
                    break;
                case "jukebox_play":
                    if (msg.kind === "audio") setCurrentAudio(msg.track);
                    else if (msg.kind === "video") setCurrentVideo(msg.track);
                    break;
                case "jukebox_stop":
                    if (msg.kind === "audio") setCurrentAudio(null);
                    else if (msg.kind === "video") setCurrentVideo(null);
                    break;
                case "jukebox_queue":
                    if (msg.kind === "audio") setAudioQueue(msg.queue || []);
                    else if (msg.kind === "video") setVideoQueue(msg.queue || []);
                    break;
                case "tag_spray":
                    if (msg.tag && tagBelongsToRoom(msg.tag, roomId)) {
                        setTags((t) => [...t.filter((tag) => tagBelongsToRoom(tag, roomId)).slice(-79), msg.tag]);
                    }
                    break;
                case "tag_clear":
                    setTags([]);
                    break;
                case "basketball_shot":
                    setBasketballShots((shots) => [...shots.slice(-24), msg]);
                    break;
                case "youtube_play":
                    setCurrentYoutube(msg.track || null);
                    break;
                case "youtube_stop":
                    setCurrentYoutube(null);
                    break;
                case "youtube_queue":
                    setYoutubeQueue(msg.queue || []);
                    break;
                default:
                    break;
            }
        };
        return () => {
            if (isCurrentSocket()) setConnected(false);
            try { ws.close(); } catch { /* ignore */ }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localPreview, roomId, user?.user_id, user?.nickname]);

    useEffect(() => {
        if (!connected) return;
        send({ type: "avatar", avatar_url: avatarUrl || null });
    }, [avatarUrl, connected, send]);

    useEffect(() => {
        if (!connected) return;
        send({ type: "sprite", sprite_id: spriteId || null });
    }, [spriteId, connected, send]);

    useEffect(() => {
        if (!connected) return;
        send({ type: "anim", anim_id: animId || null });
    }, [animId, connected, send]);

    useEffect(() => {
        const i = setInterval(() => {
            setTypingUsers((prev) => {
                const now = Date.now();
                const next = {};
                for (const [k, v] of Object.entries(prev)) {
                    if (now - v < 4000) next[k] = v;
                }
                return next;
            });
        }, 1500);
        return () => clearInterval(i);
    }, []);

    return {
        messages, users, connected,
        currentAudio, currentVideo,
        audioQueue, videoQueue,
        currentYoutube, youtubeQueue,
        typingUsers, tags, basketballShots,
        send,
        setMessages, setUsers, setTags,
    };
}
