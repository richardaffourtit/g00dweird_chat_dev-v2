describe("frontend API environment config", () => {
    const originalEnv = process.env;

    afterEach(() => {
        jest.resetModules();
        process.env = originalEnv;
    });

    test("uses VITE_BACKEND_URL for production API and websocket URLs", () => {
        process.env = {
            ...originalEnv,
            VITE_BACKEND_URL: "https://api.g00dweird.com/",
            REACT_APP_BACKEND_URL: "",
        };

        const { API, wsUrl } = require("./api");

        expect(API).toBe("https://api.g00dweird.com/api");
        expect(wsUrl("hello", { user_id: "u 1", nickname: "rich ford" })).toBe(
            "wss://api.g00dweird.com/api/ws/hello?user_id=u+1&nickname=rich+ford"
        );
    });

    test("legacy REACT_APP_BACKEND_URL remains supported", () => {
        process.env = {
            ...originalEnv,
            VITE_BACKEND_URL: "",
            REACT_APP_BACKEND_URL: "https://legacy-api.g00dweird.com/",
        };

        const { API } = require("./api");

        expect(API).toBe("https://legacy-api.g00dweird.com/api");
    });

    test("Halloween Town is available in the local preview room picker", async () => {
        process.env = {
            ...originalEnv,
            VITE_PREVIEW_MOCK: "1",
        };

        const { listRooms } = require("./api");
        const rooms = await listRooms();

        expect(rooms.filter((room) => room.id === "halloween")).toEqual([
            {
                id: "halloween",
                name: "Halloween Town",
                tagline: "crooked rooftops, pumpkin grins, midnight mischief",
                theme: "halloween",
                bg_url: "/worlds/halloween.png",
                icon_url: "/assets/world-icons/halloween.png",
            },
        ]);
    });
});
