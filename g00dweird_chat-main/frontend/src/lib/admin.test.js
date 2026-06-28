import { adminHeaders, isAdminUser, normalizeAdminNickname } from "./admin";

describe("admin helpers", () => {
    test("recognizes rich ford as the owner admin handle", () => {
        expect(normalizeAdminNickname(" Rich   Ford ")).toBe("rich ford");
        expect(isAdminUser({ nickname: "rich ford" })).toBe(true);
        expect(isAdminUser({ nickname: "RICH FORD" })).toBe(true);
        expect(isAdminUser({ nickname: "rich" })).toBe(false);
        expect(isAdminUser(null)).toBe(false);
    });

    test("sends explicit admin identity headers for backend owner checks", () => {
        expect(adminHeaders({ user_id: "owner-1", nickname: "rich ford" })).toEqual({
            "x-g00d-admin-user-id": "owner-1",
            "x-g00d-admin-nickname": "rich ford",
        });
    });
});
