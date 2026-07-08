import fs from "fs";
import path from "path";

describe("room media playback shell", () => {
    test("Desktop mounts a shared room media player outside the jukebox and video windows", () => {
        const source = fs.readFileSync(path.join(__dirname, "Desktop.jsx"), "utf8");

        expect(source).toMatch(/import RoomMediaPlayers from "\.\/RoomMediaPlayers"/);
        expect(source).toMatch(/<RoomMediaPlayers[\s\S]*currentAudio=\{socket\.currentAudio\}/);
        expect(source).toMatch(/currentVideo=\{socket\.currentVideo\}/);
        expect(source).toMatch(/showVideoMonitor=\{!openWindows\.video\}/);
    });

    test("Jukebox audio window delegates playback to the shared room player", () => {
        const source = fs.readFileSync(path.join(__dirname, "Desktop.jsx"), "utf8");

        expect(source).toMatch(/<JukeboxWindow kind="audio"[\s\S]*activePlayback=\{false\}/);
    });

    test("Start menu exposes the YouTube Theatre controls", () => {
        const source = fs.readFileSync(path.join(__dirname, "Desktop.jsx"), "utf8");

        expect(source).toMatch(/<StartItem label="Theatre"[\s\S]*toggle\("youtube", true\)[\s\S]*testId="start-youtube"/);
    });
});
