import { api, listRooms } from "./api";

const ADMIN_NICKNAME = "rich ford";

export function normalizeAdminNickname(nickname) {
    return String(nickname || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isAdminUser(user) {
    return normalizeAdminNickname(user?.nickname) === ADMIN_NICKNAME;
}

export function adminHeaders(user) {
    return {
        "x-g00d-admin-user-id": user?.user_id || "",
        "x-g00d-admin-nickname": user?.nickname || "",
    };
}

export async function getAdminRooms(user) {
    const { data } = await api.get("/admin/rooms", { headers: adminHeaders(user) });
    return data.rooms || [];
}

export async function clearAdminRoomTags(user, roomId) {
    const { data } = await api.delete(`/admin/rooms/${encodeURIComponent(roomId)}/tags`, {
        headers: adminHeaders(user),
    });
    return data;
}

export async function getPreviewAdminRooms() {
    const rooms = await listRooms();
    return rooms.map((room) => ({
        id: room.id,
        name: room.name,
        tag_count: 0,
        live_users: 0,
    }));
}
