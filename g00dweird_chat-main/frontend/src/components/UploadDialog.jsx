import React, { useRef, useState } from "react";
import Win95Window from "./Win95Window";
import { uploadFile } from "../lib/api";

const KIND_ACCEPT = {
    avatar: "image/*",
    banner: "image/*",
    audio: "audio/*",
    video: "video/*",
};

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("could not load image"));
        };
        img.src = url;
    });
}

function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("could not process image"));
        }, "image/png");
    });
}

function colorDistanceSq(data, offset, color) {
    const dr = data[offset] - color.r;
    const dg = data[offset + 1] - color.g;
    const db = data[offset + 2] - color.b;
    return dr * dr + dg * dg + db * db;
}

async function removeImageBackground(file, tolerance) {
    const img = await loadImage(file);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);

    const { width, height } = canvas;
    const image = ctx.getImageData(0, 0, width, height);
    const { data } = image;
    const idx = (x, y) => (y * width + x) * 4;
    const samplePoints = [
        [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
        [Math.floor(width / 2), 0], [Math.floor(width / 2), height - 1],
        [0, Math.floor(height / 2)], [width - 1, Math.floor(height / 2)],
    ];
    const bgColors = samplePoints
        .map(([x, y]) => idx(x, y))
        .filter((i) => data[i + 3] > 12)
        .map((i) => ({ r: data[i], g: data[i + 1], b: data[i + 2] }));
    if (bgColors.length === 0) return file;

    const toleranceSq = tolerance * tolerance;
    const visited = new Uint8Array(width * height);
    const queue = [];
    const enqueue = (x, y) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        queue.push(y * width + x);
    };
    const matchesBackground = (p) => {
        const off = p * 4;
        if (data[off + 3] < 12) return true;
        return bgColors.some((color) => colorDistanceSq(data, off, color) <= toleranceSq);
    };

    for (let x = 0; x < width; x += 1) {
        enqueue(x, 0);
        enqueue(x, height - 1);
    }
    for (let y = 0; y < height; y += 1) {
        enqueue(0, y);
        enqueue(width - 1, y);
    }

    while (queue.length) {
        const p = queue.pop();
        if (visited[p]) continue;
        visited[p] = 1;
        if (!matchesBackground(p)) continue;

        data[p * 4 + 3] = 0;
        const x = p % width;
        const y = Math.floor(p / width);
        enqueue(x + 1, y);
        enqueue(x - 1, y);
        enqueue(x, y + 1);
        enqueue(x, y - 1);
    }

    ctx.putImageData(image, 0, 0);
    const blob = await canvasToBlob(canvas);
    const name = file.name.replace(/\.[^.]+$/, "") || "avatar";
    return new File([blob], `${name}-bg-removed.png`, { type: "image/png" });
}

export default function UploadDialog({
    user,
    onClose,
    onUploaded,
    initialX = 200,
    initialY = 160,
    requestFocus = 0,
}) {
    const [kind, setKind] = useState("avatar");
    const [file, setFile] = useState(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("");
    const [busy, setBusy] = useState(false);
    const [removeBg, setRemoveBg] = useState(true);
    const [bgTolerance, setBgTolerance] = useState(32);
    const inputRef = useRef(null);

    const pick = (e) => {
        const f = e.target.files?.[0];
        if (f) setFile(f);
    };

    const onDrop = (e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) setFile(f);
    };

    const submit = async () => {
        if (!file) {
            setStatus("pick a file first weirdo");
            return;
        }
        setBusy(true);
        setProgress(0);
        setStatus("uploading...");
        try {
            let uploadCandidate = file;
            if (kind === "avatar" && removeBg && file.type?.startsWith("image/")) {
                setStatus("removing avatar background...");
                uploadCandidate = await removeImageBackground(file, bgTolerance);
                setStatus("uploading cleaned avatar...");
            }
            const rec = await uploadFile({
                file: uploadCandidate,
                user_id: user.user_id,
                nickname: user.nickname,
                kind,
                onProgress: (p) => setProgress(p),
            });
            setStatus(`ok: ${rec.original_filename}`);
            setProgress(100);
            if (onUploaded) onUploaded(rec);
            setFile(null);
            if (inputRef.current) inputRef.current.value = "";
        } catch (e) {
            setStatus(e?.response?.data?.detail || "upload failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Win95Window
            title="UploadZone.exe"
            testId="upload-dialog"
            initialX={initialX}
            initialY={initialY}
            width={460}
            onClose={onClose}
            requestFocus={requestFocus}
            icon={<span style={{ color: "#ff0" }}>⇪</span>}
        >
            <div className="p-3 flex flex-col gap-3" style={{ background: "var(--w95-bg)" }}>
                <div className="flex gap-2 items-center">
                    <span className="font-pixel" style={{ fontSize: 11 }}>
                        TYPE:
                    </span>
                    {["avatar", "banner", "audio", "video"].map((k) => (
                        <label
                            key={k}
                            className="font-mono-retro flex items-center gap-1"
                            style={{ fontSize: 18 }}
                        >
                            <input
                                type="radio"
                                name="kind"
                                value={k}
                                checked={kind === k}
                                onChange={() => setKind(k)}
                                data-testid={`upload-kind-${k}`}
                            />
                            {k}
                        </label>
                    ))}
                </div>

                {kind === "avatar" && (
                    <div
                        className="w95-bevel-inset p-2"
                        style={{ background: "#fff" }}
                        data-testid="upload-avatar-bg-remove"
                    >
                        <label
                            className="font-mono-retro flex items-center gap-2"
                            style={{ fontSize: 17 }}
                        >
                            <input
                                type="checkbox"
                                checked={removeBg}
                                onChange={(e) => setRemoveBg(e.target.checked)}
                                data-testid="upload-avatar-remove-bg-toggle"
                            />
                            remove avatar bg from edges
                        </label>
                        {removeBg && (
                            <div className="flex items-center gap-2 mt-2">
                                <span className="font-pixel" style={{ fontSize: 9 }}>
                                    TOL
                                </span>
                                <input
                                    type="range"
                                    min="8"
                                    max="70"
                                    value={bgTolerance}
                                    onChange={(e) => setBgTolerance(Number(e.target.value))}
                                    style={{ flex: 1 }}
                                    data-testid="upload-avatar-bg-tolerance"
                                />
                                <span className="font-mono-retro" style={{ fontSize: 14, width: 28, textAlign: "right" }}>
                                    {bgTolerance}
                                </span>
                            </div>
                        )}
                        <div className="font-mono-retro" style={{ fontSize: 14, color: "#666", lineHeight: 1.1 }}>
                            flood-fills matching edge pixels only, so interior sprite colors stay intact.
                        </div>
                    </div>
                )}

                <div
                    className="drop-zone font-mono-retro"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                    onClick={() => inputRef.current?.click()}
                    style={{ fontSize: 18, cursor: "pointer" }}
                    data-testid="upload-dropzone"
                >
                    {file ? (
                        <>
                            <div>{file.name}</div>
                            <div style={{ fontSize: 14, color: "#555" }}>
                                {(file.size / 1024).toFixed(1)} KB &middot; {file.type || "unknown"}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="font-pixel" style={{ fontSize: 11 }}>
                                ▲ DROP FILE HERE ▼
                            </div>
                            <div style={{ fontSize: 14, color: "#555" }}>
                                or click to pick. max 50MB.
                            </div>
                        </>
                    )}
                    <input
                        type="file"
                        ref={inputRef}
                        hidden
                        accept={KIND_ACCEPT[kind]}
                        onChange={pick}
                        data-testid="upload-file-input"
                    />
                </div>

                {busy && (
                    <div
                        className="w95-bevel-inset"
                        style={{ height: 20, padding: 2 }}
                        data-testid="upload-progress"
                    >
                        <div
                            style={{
                                width: `${progress}%`,
                                height: "100%",
                                background:
                                    "repeating-linear-gradient(90deg,#000080 0 6px,#1084d0 6px 12px)",
                            }}
                        />
                    </div>
                )}

                {status && (
                    <div
                        className="w95-bevel-inset px-2 py-1 font-mono-retro"
                        style={{ fontSize: 16 }}
                        data-testid="upload-status"
                    >
                        {status}
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button
                        className="w95-button"
                        onClick={submit}
                        disabled={busy}
                        data-testid="upload-submit"
                    >
                        {busy ? "uploading..." : "Upload"}
                    </button>
                    <button
                        className="w95-button"
                        onClick={onClose}
                        data-testid="upload-close"
                    >
                        Close
                    </button>
                </div>
            </div>
        </Win95Window>
    );
}
