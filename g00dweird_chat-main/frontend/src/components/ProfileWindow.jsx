import React, { useEffect, useRef, useState } from "react";
import Win95Window from "./Win95Window";
import { getUserMedia, fileUrl, getUserBio, setUserBio, uploadFile } from "../lib/api";
import { toast } from "sonner";

const BANNER_TARGET_HEIGHT = 78;
const BANNER_TARGET_WIDTH = 560;
const BANNER_TARGET_TEXT = `Banners should be around ${BANNER_TARGET_WIDTH} × ${BANNER_TARGET_HEIGHT} px (or a similar wide ratio)`;

function readImageAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("could not read image"));
        reader.readAsDataURL(file);
    });
}

function readImageDimensions(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
            URL.revokeObjectURL(url);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("could not read image dimensions"));
        };
        img.src = url;
    });
}

export default function ProfileWindow({
    user,
    currentAvatar,
    onPickAvatar,
    onClose,
    onOpenUpload,
    onOpenSprites,
    initialX = 280,
    initialY = 200,
    requestFocus = 0,
}) {
    const [media, setMedia] = useState([]);
    const [loading, setLoading] = useState(false);
    const [bio, setBio] = useState("");
    const [bioDirty, setBioDirty] = useState(false);
    const [savingBio, setSavingBio] = useState(false);
    const [bannerUrl, setBannerUrl] = useState("");
    const [bannerBusy, setBannerBusy] = useState(false);
    const [bannerFrameSize, setBannerFrameSize] = useState({ width: BANNER_TARGET_WIDTH, height: BANNER_TARGET_HEIGHT });
    const [uploadedBannerMeta, setUploadedBannerMeta] = useState(null);
    const bannerInputRef = useRef(null);
    const bannerPreviewRef = useRef(null);
    const bannerStorageKey = `gw_profile_banner_${user.user_id || user.nickname}`;

    const reload = async () => {
        setLoading(true);
        try {
            const [d, b] = await Promise.all([
                getUserMedia(user.user_id),
                getUserBio(user.user_id).catch(() => ({ bio: "" })),
            ]);
            setMedia(d);
            setBio(b.bio || "");
            setBioDirty(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user.user_id]);

    useEffect(() => {
        const saved = localStorage.getItem(bannerStorageKey);
        if (saved) {
            setBannerUrl(saved);
            setUploadedBannerMeta(null);
            return;
        }
        const latestBanner = media.find((m) => m.kind === "banner" && m.storage_path);
        setBannerUrl(latestBanner ? fileUrl(latestBanner.storage_path) : "");
    }, [bannerStorageKey, media]);

    useEffect(() => {
        const node = bannerPreviewRef.current;
        if (!node) return;

        const measure = () => {
            const w = Math.round(node.clientWidth);
            const h = Math.round(node.clientHeight);
            if (w > 0 && h > 0) {
                setBannerFrameSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
            }
        };

        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(node);
        return () => ro.disconnect();
    }, []);

    const onBioChange = (e) => {
        const v = e.target.value.slice(0, 500);
        setBio(v);
        setBioDirty(true);
    };

    const saveBio = async () => {
        setSavingBio(true);
        try {
            await setUserBio(user.user_id, bio);
            setBioDirty(false);
            toast.success("bio saved");
        } catch (err) {
            toast.error("could not save bio", { description: err.message });
        } finally {
            setSavingBio(false);
        }
    };

    const pickBanner = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type?.startsWith("image/")) {
            toast.error("banner must be an image");
            e.target.value = "";
            return;
        }

        setBannerBusy(true);
        try {
            const previewUrl = await readImageAsDataUrl(file);
            setBannerUrl(previewUrl);
            const bannerDimensions = await readImageDimensions(file);
            setUploadedBannerMeta(bannerDimensions);
            try {
                localStorage.setItem(bannerStorageKey, previewUrl);
            } catch {
                toast.message("banner preview set", { description: "large image may not survive refresh in preview" });
            }

            const rec = await uploadFile({
                file,
                user_id: user.user_id,
                nickname: user.nickname,
                kind: "banner",
            });

            if (rec?.storage_path) {
                const savedUrl = fileUrl(rec.storage_path);
                setBannerUrl(savedUrl);
                localStorage.setItem(bannerStorageKey, savedUrl);
                setMedia((m) => [rec, ...m.filter((x) => x.id !== rec.id)]);
                toast.success("banner uploaded", { description: rec.original_filename });
            } else {
                toast.success("banner set", { description: "saved in this browser preview" });
            }
        } catch (err) {
            toast.error("could not set banner", { description: err?.response?.data?.detail || err.message });
        } finally {
            setBannerBusy(false);
            e.target.value = "";
        }
    };

    const clearBanner = () => {
        localStorage.removeItem(bannerStorageKey);
        setBannerUrl("");
        toast.message("banner hidden on this device");
        setUploadedBannerMeta(null);
    };

    const bannerTargetRatio = BANNER_TARGET_WIDTH / BANNER_TARGET_HEIGHT;
    const bannerUploadStatus = uploadedBannerMeta
        ? uploadedBannerMeta.width && uploadedBannerMeta.height
            ? `selected image: ${uploadedBannerMeta.width}×${uploadedBannerMeta.height}`
                + (Math.abs((uploadedBannerMeta.width / uploadedBannerMeta.height) - bannerTargetRatio) > 0.2 ? " (non-ideal ratio)" : "")
            : null
        : null;

    const grouped = {
        banner: media.filter((m) => m.kind === "banner"),
        avatar: media.filter((m) => m.kind === "avatar"),
        audio: media.filter((m) => m.kind === "audio"),
        video: media.filter((m) => m.kind === "video"),
    };

    return (
        <Win95Window
            title={`My Profile - ${user.nickname}`}
            testId="profile-window"
            initialX={initialX}
            initialY={initialY}
            width={580}
            height={540}
            onClose={onClose}
            requestFocus={requestFocus}
            icon={<span style={{ color: "#ffff00" }}>☻</span>}
        >
            <div className="flex flex-col h-full p-2 gap-2" style={{ background: "var(--w95-bg)" }}>
                <div className="w95-bevel-inset p-2" style={{ background: "#fff" }}>
                    <div
                        ref={bannerPreviewRef}
                        className="w95-bevel-inset relative mb-2"
                        style={{
                            height: 78,
                            overflow: "hidden",
                            background: bannerUrl
                                ? "#000"
                                : "repeating-linear-gradient(135deg,#06184f 0 10px,#0d2d8c 10px 20px)",
                        }}
                        data-testid="profile-banner"
                    >
                        {bannerUrl ? (
                            <img
                                src={bannerUrl}
                                alt={`${user.nickname} banner`}
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                data-testid="profile-banner-img"
                            />
                        ) : (
                            <div
                                className="font-mono-retro"
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#00ffff",
                                    fontSize: 11,
                                    textShadow: "1px 1px 0 #000",
                                }}
                            >
                                ADD PROFILE BANNER
                            </div>
                        )}
                        <div
                            className="absolute left-1 bottom-1 font-pixel px-1"
                            style={{ background: "#000", color: "#b3ff00", fontSize: 9 }}
                        >
                            PROFILE BANNER
                        </div>
                        <div className="absolute right-1 top-1 flex gap-1">
                            <button
                                className="w95-button"
                                onClick={() => bannerInputRef.current?.click()}
                                disabled={bannerBusy}
                                style={{ minHeight: 22, padding: "1px 6px", fontSize: 13 }}
                                data-testid="profile-banner-upload"
                            >
                                {bannerBusy ? "..." : "+ Banner"}
                            </button>
                            {bannerUrl && (
                                <button
                                    className="w95-button"
                                    onClick={clearBanner}
                                    disabled={bannerBusy}
                                    title="hide banner on this device"
                                    style={{ minHeight: 22, padding: "1px 6px", fontSize: 13 }}
                                    data-testid="profile-banner-clear"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        <input
                            ref={bannerInputRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={pickBanner}
                            data-testid="profile-banner-input"
                        />
                    </div>
                    <div
                        className="font-mono-retro mb-1"
                        style={{
                            padding: "4px 6px",
                            border: "1px dashed #666",
                            background: "#f8f8f8",
                            color: "#003",
                            fontSize: 10,
                            lineHeight: 1.35,
                        }}
                    >
                        <div>{BANNER_TARGET_TEXT}</div>
                        <div>
                            current target slot: {bannerFrameSize.width}×{bannerFrameSize.height}px
                            (ratio {(bannerFrameSize.width / Math.max(1, bannerFrameSize.height)).toFixed(2)}:1)
                        </div>
                        {bannerUploadStatus && (
                            <div style={{ marginTop: 2 }}>
                                {bannerUploadStatus}
                                {uploadedBannerMeta?.width && uploadedBannerMeta?.height
                                    ? ` • ratio ${(uploadedBannerMeta.width / uploadedBannerMeta.height).toFixed(2)}`
                                    : ""}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 items-center">
                        {currentAvatar ? (
                            <img
                                src={fileUrl(currentAvatar.storage_path)}
                                alt="avatar"
                                className="pixel-avatar"
                                style={{ width: 64, height: 64, objectFit: "cover" }}
                                data-testid="profile-avatar"
                            />
                        ) : (
                            <div
                                className="pixel-avatar flex items-center justify-center font-pixel"
                                style={{ width: 64, height: 64, background: "#ff00ff", fontSize: 28 }}
                            >
                                {user.nickname[0]?.toUpperCase()}
                            </div>
                        )}
                        <div className="flex-1">
                            <div className="font-pixel" style={{ fontSize: 14 }}>
                                {user.nickname}
                            </div>
                            <div className="font-mono-retro" style={{ fontSize: 16, color: "#555" }}>
                                id: {user.user_id.slice(0, 8)}...
                                <br />
                                {media.length} files in the vault
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <button className="w95-button" onClick={onOpenSprites} data-testid="profile-sprites">
                                ☻ Sprites
                            </button>
                            <button className="w95-button" onClick={onOpenUpload} data-testid="profile-upload">
                                + Upload
                            </button>
                            <button
                                className="w95-button"
                                onClick={async () => {
                                    const url = `${window.location.origin}/u/${encodeURIComponent(user.nickname)}?u=${encodeURIComponent(user.user_id)}`;
                                    try {
                                        await navigator.clipboard.writeText(url);
                                        toast.success("profile link copied", { description: url });
                                    } catch {
                                        toast.message("copy failed", { description: url });
                                    }
                                }}
                                data-testid="profile-share"
                                title="copy a public link to your profile"
                            >
                                ↗ Share
                            </button>
                            <button className="w95-button" onClick={reload} data-testid="profile-refresh">
                                ↻
                            </button>
                        </div>
                    </div>
                </div>

                {/* BIO editor */}
                <div className="w95-bevel-inset p-2" style={{ background: "#fff" }} data-testid="profile-bio">
                    <div
                        className="font-pixel mb-1 flex items-center justify-between"
                        style={{ fontSize: 10, color: "#000080" }}
                    >
                        <span>▣ BIO</span>
                        <span style={{ color: "#888" }}>{bio.length}/500</span>
                    </div>
                    <textarea
                        className="w95-input"
                        rows={3}
                        placeholder="say something weird about yourself..."
                        value={bio}
                        onChange={onBioChange}
                        data-testid="profile-bio-input"
                        style={{ width: "100%", resize: "vertical", fontFamily: "inherit", fontSize: 16 }}
                    />
                    <div className="flex justify-end mt-1">
                        <button
                            className="w95-button"
                            onClick={saveBio}
                            disabled={!bioDirty || savingBio}
                            data-testid="profile-bio-save"
                        >
                            {savingBio ? "saving..." : bioDirty ? "save bio" : "saved"}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto w95-bevel-inset p-2" style={{ background: "#fff" }}>
                    {loading && <div className="font-mono-retro">loading...</div>}

                    <Section title="AVATARS (uploaded)">
                        {grouped.avatar.length === 0 && <Empty text="no uploaded avatars — use SpritePicker for pixel sprites" />}
                        <div className="grid grid-cols-6 gap-2">
                            {grouped.avatar.map((f) => (
                                <button
                                    key={f.id}
                                    className="pixel-avatar"
                                    onClick={() => onPickAvatar?.(f)}
                                    title={`use ${f.original_filename} as avatar`}
                                    style={{
                                        width: 56,
                                        height: 56,
                                        padding: 0,
                                        background: "#fff",
                                        outline:
                                            currentAvatar?.id === f.id
                                                ? "3px solid #ff00ff"
                                                : "none",
                                    }}
                                    data-testid="profile-avatar-choice"
                                >
                                    <img
                                        src={fileUrl(f.storage_path)}
                                        alt={f.original_filename}
                                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                    />
                                </button>
                            ))}
                        </div>
                    </Section>

                    <Section title="AUDIO">
                        {grouped.audio.length === 0 && <Empty text="no audio" />}
                        {grouped.audio.map((f) => (
                            <div
                                key={f.id}
                                className="py-1"
                                style={{ borderBottom: "1px dashed #999" }}
                                data-testid="profile-audio-item"
                            >
                                <div className="font-mono-retro" style={{ fontSize: 16 }}>
                                    ♪ {f.original_filename}
                                </div>
                                <audio controls src={fileUrl(f.storage_path)} style={{ width: "100%" }} />
                            </div>
                        ))}
                    </Section>

                    <Section title="VIDEO">
                        {grouped.video.length === 0 && <Empty text="no video" />}
                        <div className="grid grid-cols-2 gap-2">
                            {grouped.video.map((f) => (
                                <div key={f.id} data-testid="profile-video-item">
                                    <div className="font-mono-retro truncate" style={{ fontSize: 14 }}>
                                        ▶ {f.original_filename}
                                    </div>
                                    <video
                                        controls
                                        src={fileUrl(f.storage_path)}
                                        className="w95-bevel-inset"
                                        style={{ width: "100%", maxHeight: 140, background: "#000" }}
                                    />
                                </div>
                            ))}
                        </div>
                    </Section>
                </div>
            </div>
        </Win95Window>
    );
}

function Section({ title, children }) {
    return (
        <div className="mb-3">
            <div
                className="font-pixel px-1 py-0.5"
                style={{
                    background: "#000080",
                    color: "#fff",
                    fontSize: 10,
                    marginBottom: 4,
                }}
            >
                ▣ {title}
            </div>
            {children}
        </div>
    );
}

function Empty({ text }) {
    return (
        <div className="font-mono-retro" style={{ color: "#888", fontSize: 16 }}>
            {text}
        </div>
    );
}
