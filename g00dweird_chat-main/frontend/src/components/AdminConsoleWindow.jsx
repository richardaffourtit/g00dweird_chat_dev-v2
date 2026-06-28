import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Win95Window from "./Win95Window";
import { clearAdminRoomTags, getAdminRooms, getPreviewAdminRooms } from "../lib/admin";

export default function AdminConsoleWindow({
    user,
    rooms = [],
    activeRoomId,
    onClose,
    onRoomCleared,
    initialX = 180,
    initialY = 96,
    requestFocus = 0,
}) {
    const [summaries, setSummaries] = useState([]);
    const [selectedRoomId, setSelectedRoomId] = useState(activeRoomId || "");
    const [loading, setLoading] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [status, setStatus] = useState("");

    const selectedRoom = useMemo(
        () => summaries.find((room) => room.id === selectedRoomId) || rooms.find((room) => room.id === selectedRoomId),
        [rooms, selectedRoomId, summaries]
    );

    const load = async ({ preserveStatus = false } = {}) => {
        setLoading(true);
        if (!preserveStatus) setStatus("");
        try {
            const next = await getAdminRooms(user);
            setSummaries(next);
            if (!selectedRoomId && next[0]) setSelectedRoomId(next[0].id);
        } catch (error) {
            if (!error?.response) {
                const preview = await getPreviewAdminRooms();
                setSummaries(preview);
                if (!selectedRoomId && preview[0]) setSelectedRoomId(preview[0].id);
                setStatus("backend offline - preview room list only");
            } else {
                setStatus(error?.response?.data?.detail || "admin check failed");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (activeRoomId) setSelectedRoomId(activeRoomId);
    }, [activeRoomId]);

    const clearTags = async () => {
        if (!selectedRoomId || clearing) return;
        const name = selectedRoom?.name || selectedRoomId;
        setClearing(true);
        setStatus(`clearing ${name}...`);
        try {
            const result = await clearAdminRoomTags(user, selectedRoomId);
            setStatus(`cleared ${result.deleted_count || 0} tags from ${name}`);
            toast.success("room tags cleared", { description: name });
            onRoomCleared?.(selectedRoomId);
            await load({ preserveStatus: true });
        } catch (error) {
            const detail = error?.response?.data?.detail || error?.message || "clear failed";
            setStatus(detail);
            toast.error("admin clear failed", { description: detail });
        } finally {
            setClearing(false);
        }
    };

    return (
        <Win95Window
            title="AdminConsole.exe"
            testId="admin-console"
            initialX={initialX}
            initialY={initialY}
            width={560}
            height={430}
            onClose={onClose}
            requestFocus={requestFocus}
            icon={<span style={{ color: "#ff0033" }}>!</span>}
        >
            <div className="flex flex-col h-full p-2 gap-2" style={{ background: "var(--w95-bg)" }}>
                <div className="w95-bevel-inset px-2 py-1 font-mono-retro" style={{ fontSize: 15 }}>
                    owner tools for room upkeep. destructive controls affect live backend state.
                </div>

                <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 150px" }}>
                    <label className="flex flex-col gap-1 font-pixel" style={{ fontSize: 10 }}>
                        ROOM
                        <select
                            className="w95-input"
                            value={selectedRoomId}
                            onChange={(e) => setSelectedRoomId(e.target.value)}
                            data-testid="admin-room-select"
                            style={{ fontFamily: "'VT323', monospace", fontSize: 18 }}
                        >
                            {summaries.map((room) => (
                                <option key={room.id} value={room.id}>
                                    {room.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button
                        className="w95-button"
                        onClick={load}
                        disabled={loading}
                        data-testid="admin-refresh"
                        style={{ alignSelf: "end", minHeight: 34 }}
                    >
                        {loading ? "refreshing..." : "refresh"}
                    </button>
                </div>

                <div className="w95-bevel-inset p-2" style={{ minHeight: 132 }}>
                    <div className="font-pixel mb-2" style={{ fontSize: 10 }}>
                        ROOM STATUS
                    </div>
                    <div className="grid gap-1 font-mono-retro" style={{ fontSize: 18 }}>
                        <div>name: {selectedRoom?.name || "-"}</div>
                        <div>id: {selectedRoom?.id || "-"}</div>
                        <div>sprays/tags: {selectedRoom?.tag_count ?? "-"}</div>
                        <div>live users: {selectedRoom?.live_users ?? "-"}</div>
                    </div>
                </div>

                <div className="w95-bevel p-2" style={{ background: "#d8d8d8" }}>
                    <div className="font-pixel mb-2" style={{ fontSize: 10, color: "#800000" }}>
                        DESTRUCTIVE ROOM ACTIONS
                    </div>
                    <button
                        className="w95-button"
                        onClick={clearTags}
                        disabled={!selectedRoomId || clearing}
                        data-testid="admin-clear-tags"
                        style={{ width: "100%", minHeight: 38, background: clearing ? undefined : "#ffdddd" }}
                    >
                        {clearing ? "clearing..." : "clear sprays / tags in selected room"}
                    </button>
                </div>

                <div
                    className="w95-bevel-inset px-2 py-1 font-mono-retro"
                    data-testid="admin-status"
                    style={{ minHeight: 30, fontSize: 15, color: status.includes("failed") ? "#aa0000" : "#004400" }}
                >
                    {status || "ready"}
                </div>
            </div>
        </Win95Window>
    );
}
