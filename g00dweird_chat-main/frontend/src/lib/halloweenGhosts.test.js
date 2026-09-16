import fs from "fs";
import path from "path";
import {
    halloweenGhostCycle,
    halloweenGhostFrame,
    halloweenGhostHeight,
    halloweenGhostPose,
    halloweenGhostsFromManifest,
} from "./halloweenGhosts";

const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/assets/halloween/ghosts/manifest.json"), "utf8"));
const ghosts = halloweenGhostsFromManifest(manifest);

describe("Halloween Town's visiting ghosts", () => {
    test("uses all four packaged sheets and keeps every animation inside its atlas", () => {
        expect(ghosts).toHaveLength(4);
        for (const ghost of ghosts) {
            expect(fs.existsSync(path.join(process.cwd(), "public", ghost.sheet))).toBe(true);
            for (let time = 0; time < 70000; time += 43) {
                const pose = halloweenGhostPose(ghost.routeIndex, time);
                const { row, frame } = halloweenGhostFrame(ghost, pose);
                expect(row).toBeGreaterThanOrEqual(0);
                expect(row).toBeLessThan(4);
                expect(frame).toBeGreaterThanOrEqual(0);
                expect(frame).toBeLessThan(4);
            }
        }
    });

    test("roams across the plaza without jumping at animation or lifecycle boundaries", () => {
        for (let index = 0; index < 4; index += 1) {
            let previous = halloweenGhostPose(index, 0);
            const positions = [];
            const states = new Set();
            for (let time = 17; time < 180000; time += 17) {
                const pose = halloweenGhostPose(index, time);
                expect(pose.x).toBeGreaterThanOrEqual(0.18);
                expect(pose.x).toBeLessThanOrEqual(0.82);
                expect(pose.y).toBeGreaterThanOrEqual(0.36);
                expect(pose.y).toBeLessThanOrEqual(0.70);
                // At 60 Hz a discontinuity would visibly jump, including on return visits.
                expect(Math.hypot(pose.x - previous.x, pose.y - previous.y)).toBeLessThan(0.002);
                positions.push(pose);
                states.add(pose.state);
                previous = pose;
            }
            expect(Math.max(...positions.map((pose) => pose.x)) - Math.min(...positions.map((pose) => pose.x))).toBeGreaterThan(0.3);
            expect(Math.max(...positions.map((pose) => pose.y)) - Math.min(...positions.map((pose) => pose.y))).toBeGreaterThan(0.08);
            expect(states).toEqual(new Set(["rise", "float", "haunt", "vanish", "hidden"]));
        }
    });

    test("staggered arrivals emerge and sink at the same ground contacts used by flight", () => {
        expect(halloweenGhostPose(0, 1).state).toBe("rise");
        for (let index = 0; index < 4; index += 1) {
            const timing = halloweenGhostCycle(index);
            if (index > 0) expect(halloweenGhostPose(index, 0).state).toBe("hidden");
            for (const phaseStart of [timing.delay, timing.delay + timing.rise + timing.flight]) {
                const pose = halloweenGhostPose(index, (phaseStart + 0.001) * 1000);
                expect(pose.x).toBeCloseTo(pose.groundX, 6);
                expect(pose.y).toBeCloseTo(pose.groundY, 6);
            }
            const visiting = halloweenGhostPose(index, (timing.delay + timing.rise + timing.flight * 0.3 + 0.1) * 1000);
            expect(visiting.state).toBe("haunt");
            expect(visiting.groundOpacity).toBe(0);
        }
    });

    test("reduced motion keeps four visible still poses and honors the approved size", () => {
        for (let index = 0; index < 4; index += 1) {
            const still = halloweenGhostPose(index, 0, true);
            expect(still).toEqual(halloweenGhostPose(index, 600000, true));
            expect(still.state).toBe("float");
            expect(still.opacity).toBeGreaterThan(0);
        }
        expect(halloweenGhostHeight(600)).toBeCloseTo(63);
        expect(halloweenGhostHeight(300)).toBeCloseTo(40.5);
        expect(halloweenGhostHeight(1600)).toBeCloseTo(111);
    });

    test("missing or malformed assets leave the other ghost routes intact", () => {
        expect(halloweenGhostsFromManifest(null)).toEqual([]);
        expect(halloweenGhostsFromManifest({ ghosts: [] })).toEqual([]);
        const partial = { ghosts: [manifest.ghosts[3], { ...manifest.ghosts[0], frameWidth: 12 }] };
        expect(halloweenGhostsFromManifest(partial).map(({ id, routeIndex }) => ({ id, routeIndex })))
            .toEqual([{ id: "ghost4", routeIndex: 3 }]);
    });
});
