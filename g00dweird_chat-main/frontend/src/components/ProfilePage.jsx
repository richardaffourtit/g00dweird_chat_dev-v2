import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { getPublicProfile, fileUrl } from "../lib/api";
import AnimSprite, { ANIM_CREATURES } from "./AnimSprite";
import { Sprite, SPRITES } from "../lib/sprites";

const ALIVE_BG = `linear-gradient(180deg,#1d0c2c 0%,#2c1148 22%,#3b1660 44%,#1f0834 100%)`;

function StatChip({ label, value, testId }) {
    return (
        <div
            className="w95-bevel-inset font-mono-retro px-3 py-1"
            data-testid={testId}
            style={{ background: "#0a0a18", color: "#b3ff00", fontSize: 16, minWidth: 110 }}
        >
            <div style={{ color: "#888", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {label}
            </div>
            <div style={{ color: "#b3ff00", fontSize: 18, lineHeight: 1.1 }}>{value}</div>
        </div>
    );
}

function LiveDot() {
    return (
        <span
            className="inline-block"
            style={{
                width: 10,
                height: 10,
                background: "#ff003c",
                boxShadow: "0 0 6px #ff003c, 0 0 14px #ff003c",
                animation: "alive-pulse 0.9s ease-in-out infinite",
                marginRight: 6,
                verticalAlign: "middle",
            }}
        />
    );
}

function pickAvatarRender(profile) {
    if (profile.avatar_path) {
        return (
            <img
                src={fileUrl(profile.avatar_path)}
                alt={`${profile.nickname} avatar`}
                style={{ width: 128, height: 128, imageRendering: "pixelated", objectFit: "contain" }}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
                data-testid="profile-page-avatar-img"
            />
        );
    }
    if (profile.anim_id && ANIM_CREATURES.includes(profile.anim_id)) {
        return (
            <AnimSprite
                creature={profile.anim_id}
                state="idle"
                size={128}
                fps={6}
                testId="profile-page-avatar-anim"
            />
        );
    }
    if (profile.sprite_id && SPRITES[profile.sprite_id]) {
        return (
            <div
                style={{
                    width: 128, height: 128, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    background: "#1a0a30",
                }}
                data-testid="profile-page-avatar-static"
            >
                <Sprite id={profile.sprite_id} size={96} title={profile.nickname} />
            </div>
        );
    }
    return (
        <div
            style={{
                width: 128, height: 128,
                background: "#222", color: "#888",
                fontFamily: "Silkscreen, monospace",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14,
            }}
        >
            no body
        </div>
    );
}

function memberSince(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function relativeTime(iso) {
    if (!iso) return "never";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "never";
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
}

function TagChip({ tag, testId }) {
    return (
        <div
            data-testid={testId}
            className="font-pixel"
            style={{
                display: "inline-block",
                padding: "6px 10px",
                margin: "0 6px 6px 0",
                background: "rgba(255,255,255,0.08)",
                border: "1px dashed #ff6ec7",
                color: "#ff6ec7",
                fontSize: 12,
                textShadow: "0 0 6px #ff6ec7",
                transform: `rotate(${(tag.rot || (Math.random() * 8 - 4)).toFixed(1)}deg)`,
            }}
        >
            <span style={{ color: "#ff6ec7" }}>"{tag.tag || "?"}"</span>
            <span style={{ color: "#888", marginLeft: 6, fontSize: 10 }}>
                @{tag.room_id}
            </span>
        </div>
    );
}

function UploadRow({ rec, testId }) {
    const isImg = rec.kind === "avatar" || rec.kind === "banner";
    const isVid = rec.kind === "video";
    const url = fileUrl(rec.storage_path);
    return (
        <a
            href={url}
            target="_blank"
            rel="noreferrer"
            data-testid={testId}
            className="font-mono-retro"
            style={{
                display: "flex", gap: 10, alignItems: "center",
                padding: "6px 8px",
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                fontSize: 14,
                textDecoration: "none",
            }}
        >
            <span
                style={{
                    width: 38, height: 38, flex: "0 0 auto",
                    background: isImg ? "#222" : (isVid ? "#330018" : "#001830"),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: isVid ? "#ff003c" : (isImg ? "#b3ff00" : "#00ffff"),
                    fontSize: 22,
                }}
                aria-hidden
            >
                {isImg ? "▣" : isVid ? "▶" : "♪"}
            </span>
            <div style={{ overflow: "hidden", flex: 1 }}>
                <div style={{ fontSize: 14, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {rec.original_filename}
                </div>
                <div style={{ fontSize: 11, color: "#888" }}>
                    {rec.kind} · {Math.round((rec.size || 0) / 1024)} kb · {relativeTime(rec.created_at)}
                </div>
            </div>
        </a>
    );
}

export default function ProfilePage() {
    const { nickname } = useParams();
    const [searchParams] = useSearchParams();
    const userIdHint = searchParams.get("u") || null;
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getPublicProfile(nickname, userIdHint)
            .then((p) => { if (!cancelled) { setProfile(p); setError(null); } })
            .catch((e) => {
                if (!cancelled) {
                    if (e?.response?.status === 404) setError("not_found");
                    else setError("error");
                }
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [nickname, userIdHint]);

    const tagsByRoom = useMemo(() => {
        const groups = {};
        (profile?.tags || []).forEach((t) => {
            (groups[t.room_id] = groups[t.room_id] || []).push(t);
        });
        return groups;
    }, [profile]);

    const copyShare = async () => {
        const url = profile?.user_id
            ? `${window.location.origin}/u/${encodeURIComponent(nickname)}?u=${encodeURIComponent(profile.user_id)}`
            : `${window.location.origin}/u/${encodeURIComponent(nickname)}`;
        try {
            await navigator.clipboard.writeText(url);
            toast.success("profile link copied", { description: url });
        } catch {
            toast.message("copy failed", { description: url });
        }
    };

    if (loading) {
        return (
            <div
                data-testid="profile-page-loading"
                className="font-pixel"
                style={{
                    minHeight: "100vh", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    background: ALIVE_BG, color: "#b3ff00", fontSize: 18,
                }}
            >
                connecting to /u/{nickname}…
            </div>
        );
    }

    if (error === "not_found") {
        return (
            <div
                data-testid="profile-page-not-found"
                className="font-mono-retro"
                style={{
                    minHeight: "100vh", display: "flex",
                    flexDirection: "column", alignItems: "center", justifyContent: "center",
                    background: ALIVE_BG, color: "#ff6ec7", fontSize: 22, gap: 12,
                }}
            >
                <div className="font-pixel" style={{ fontSize: 28, color: "#ff003c" }}>404 ~ ghost</div>
                <div>nobody by the handle "{nickname}"</div>
                <button
                    className="w95-button"
                    onClick={() => navigate("/")}
                    data-testid="profile-page-home-cta"
                    style={{ marginTop: 16 }}
                >
                    return to g00dweird
                </button>
            </div>
        );
    }

    if (!profile) return null;

    const tagCount = profile.tags?.length || 0;
    const uploadCount = profile.uploads?.length || 0;
    const isLive = !!profile.live_room_id;

    return (
        <div
            data-testid="profile-page"
            style={{
                minHeight: "100vh",
                width: "100vw",
                background: ALIVE_BG,
                color: "#fff",
                overflowX: "hidden",
                cursor: "auto",
                paddingBottom: 80,
            }}
        >
            <style>{`
                @keyframes alive-pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.4); }
                }
                @keyframes alive-marquee {
                    0% { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                }
                .alive-grain {
                    position: absolute; inset: 0; pointer-events: none; opacity: 0.06;
                    background-image:
                      radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px);
                    background-size: 3px 3px;
                }
                .alive-glow-ring {
                    box-shadow:
                      0 0 0 2px #fff,
                      0 0 0 4px #ff003c,
                      0 0 24px 4px rgba(255,0,60,0.6);
                }
                .alive-card {
                    background: rgba(20,8,40,0.65);
                    border: 1px solid rgba(255,110,199,0.35);
                    backdrop-filter: blur(6px);
                    -webkit-backdrop-filter: blur(6px);
                }
            `}</style>

            <div className="alive-grain" aria-hidden />

            {/* Top marquee */}
            <div
                className="font-pixel"
                style={{
                    background: "#000", color: "#0f0",
                    height: 24, overflow: "hidden",
                    borderBottom: "1px solid #b3ff00",
                    fontSize: 12, letterSpacing: "0.1em",
                }}
            >
                <div
                    style={{
                        display: "inline-block", whiteSpace: "nowrap",
                        animation: "alive-marquee 28s linear infinite",
                        paddingLeft: "100%", lineHeight: "24px",
                    }}
                    data-testid="profile-page-marquee"
                >
                    ◆ g00dweird.com ◆ profile of @{profile.nickname} ◆ {tagCount} tags · {uploadCount} uploads ◆ joined {memberSince(profile.created_at)} ◆
                    {isLive ? ` ◆ LIVE NOW IN ${profile.live_room_name?.toUpperCase()} ◆` : " ◆ currently elsewhere ◆"}
                </div>
            </div>

            <div
                style={{
                    maxWidth: 920, margin: "0 auto", padding: "32px 24px",
                    display: "grid", gridTemplateColumns: "180px 1fr", gap: 28,
                    alignItems: "start",
                }}
            >
                {profile.banner_path && (
                    <div
                        style={{
                            gridColumn: "1 / -1",
                            height: 150,
                            overflow: "hidden",
                            border: "1px solid rgba(179,255,0,0.45)",
                            boxShadow: "0 0 22px rgba(255,110,199,0.25)",
                            background: "#000",
                        }}
                        data-testid="profile-page-banner"
                    >
                        <img
                            src={fileUrl(profile.banner_path)}
                            alt={`${profile.nickname} banner`}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                    </div>
                )}

                {/* LEFT: Avatar / Sprite */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div
                        className={isLive ? "alive-glow-ring" : ""}
                        style={{
                            width: 144, height: 144,
                            background: "#000",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: isLive ? undefined : "2px solid #444",
                        }}
                        data-testid="profile-page-avatar-frame"
                    >
                        {pickAvatarRender(profile)}
                    </div>
                    {isLive ? (
                        <Link
                            to={`/r/${profile.live_room_id}`}
                            className="font-pixel"
                            data-testid="profile-page-live-cta"
                            style={{
                                fontSize: 12, color: "#ff003c", textDecoration: "none",
                                padding: "6px 8px",
                                border: "1px solid #ff003c",
                                background: "rgba(255,0,60,0.12)",
                                textAlign: "center", width: "100%",
                            }}
                        >
                            <LiveDot />LIVE · {profile.live_room_name}
                            <div style={{ color: "#ff6ec7", fontSize: 10, marginTop: 2 }}>tap to join →</div>
                        </Link>
                    ) : (
                        <div
                            className="font-pixel"
                            data-testid="profile-page-offline"
                            style={{
                                fontSize: 11, color: "#888", textAlign: "center",
                                padding: "6px 8px", border: "1px dashed #444",
                                width: "100%",
                            }}
                        >
                            offline · last seen {relativeTime(profile.last_seen_at)}
                            {profile.last_room_id && (
                                <Link
                                    to={`/r/${profile.last_room_id}`}
                                    style={{ color: "#ff6ec7", display: "block", marginTop: 4, fontSize: 10 }}
                                    data-testid="profile-page-last-room"
                                >
                                    visit their last room →
                                </Link>
                            )}
                        </div>
                    )}
                </div>

                {/* RIGHT: header + bio + stats */}
                <div>
                    <div className="font-pixel" style={{ color: "#b3ff00", fontSize: 13, letterSpacing: "0.2em" }}>
                        WELCOME TO
                    </div>
                    <h1
                        className="font-pixel"
                        data-testid="profile-page-handle"
                        style={{
                            margin: "4px 0 6px",
                            fontSize: 48,
                            background: "linear-gradient(90deg,#ff6ec7,#b3ff00,#00ffff)",
                            WebkitBackgroundClip: "text", color: "transparent",
                            textShadow: "0 0 18px rgba(255,110,199,0.4)",
                            wordBreak: "break-all",
                        }}
                    >
                        @{profile.nickname}
                    </h1>
                    <div className="font-mono-retro" style={{ color: "#aaa", fontSize: 16, marginBottom: 18 }}>
                        member since {memberSince(profile.created_at)}
                    </div>

                    <div className="alive-card" style={{ padding: 14, marginBottom: 16 }}>
                        <div className="font-pixel" style={{ color: "#ff6ec7", fontSize: 11, letterSpacing: "0.15em", marginBottom: 6 }}>
                            BIO
                        </div>
                        <div
                            className="font-mono-retro"
                            data-testid="profile-page-bio"
                            style={{
                                fontSize: 18, color: profile.bio ? "#fff" : "#777",
                                whiteSpace: "pre-wrap", wordBreak: "break-word",
                                fontStyle: profile.bio ? "normal" : "italic",
                            }}
                        >
                            {profile.bio || "no bio yet — they're keeping it cryptic"}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                        <StatChip label="TAGS" value={tagCount} testId="profile-stat-tags" />
                        <StatChip label="UPLOADS" value={uploadCount} testId="profile-stat-uploads" />
                        <StatChip
                            label="STATUS"
                            value={isLive ? "LIVE" : "AFK"}
                            testId="profile-stat-status"
                        />
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
                        <button
                            className="w95-button"
                            onClick={() => navigate("/")}
                            data-testid="profile-page-enter-cta"
                        >
                            enter g00dweird →
                        </button>
                        <button
                            className="w95-button"
                            onClick={copyShare}
                            data-testid="profile-page-share-cta"
                        >
                            copy share link
                        </button>
                    </div>
                </div>
            </div>

            {/* Tag wall */}
            <div style={{ maxWidth: 920, margin: "0 auto", padding: "0 24px 24px" }}>
                <div
                    className="font-pixel"
                    style={{ color: "#b3ff00", fontSize: 13, letterSpacing: "0.2em", marginBottom: 10 }}
                >
                    GRAFFITI · {tagCount} TAGS
                </div>
                <div
                    className="alive-card"
                    style={{ padding: 14, minHeight: 70 }}
                    data-testid="profile-page-tags"
                >
                    {tagCount === 0 && (
                        <div className="font-mono-retro" style={{ color: "#666", fontStyle: "italic" }}>
                            hasn't sprayed any walls yet.
                        </div>
                    )}
                    {Object.entries(tagsByRoom).map(([roomId, list]) => (
                        <div key={roomId} style={{ marginBottom: 8 }}>
                            <Link
                                to={`/r/${roomId}`}
                                className="font-pixel"
                                style={{ color: "#00ffff", fontSize: 11, letterSpacing: "0.1em", textDecoration: "none" }}
                                data-testid={`profile-room-link-${roomId}`}
                            >
                                ▸ {roomId}
                            </Link>
                            <div style={{ marginTop: 4 }}>
                                {list.map((t, i) => (
                                    <TagChip key={t.id || i} tag={t} testId={`profile-tag-${roomId}-${i}`} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Uploads */}
            <div style={{ maxWidth: 920, margin: "0 auto", padding: "0 24px 24px" }}>
                <div
                    className="font-pixel"
                    style={{ color: "#b3ff00", fontSize: 13, letterSpacing: "0.2em", marginBottom: 10 }}
                >
                    DROPS · {uploadCount} FILES
                </div>
                <div
                    className="alive-card"
                    style={{ padding: 14, display: "grid", gap: 6, gridTemplateColumns: "1fr" }}
                    data-testid="profile-page-uploads"
                >
                    {uploadCount === 0 && (
                        <div className="font-mono-retro" style={{ color: "#666", fontStyle: "italic" }}>
                            no media drops yet.
                        </div>
                    )}
                    {(profile.uploads || []).map((u, i) => (
                        <UploadRow key={u.id || i} rec={u} testId={`profile-upload-${i}`} />
                    ))}
                </div>
            </div>

            <div
                className="font-mono-retro"
                style={{
                    textAlign: "center", color: "#555", fontSize: 14, padding: "12px 0",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
            >
                ◆ a g00dweird.com profile · the alive web is back ◆
            </div>
        </div>
    );
}
