import {
    getHalloweenLightningFrame,
    HALLOWEEN_LIGHTNING_CYCLE_MS,
    HALLOWEEN_LIGHTNING_DELAY_MS,
    HALLOWEEN_LIGHTNING_EVENT_MS,
} from "./halloweenLightning";

const calm = { phase: "calm", darkness: 0, flash: 0, bolt: 0, strike: 0, shadow: 0 };
const atEvent = (time, options) => getHalloweenLightningFrame(HALLOWEEN_LIGHTNING_DELAY_MS + time, options);

describe("Halloween Town lightning clock", () => {
    test("starts with eight calm seconds, then the lights fail before the first strike", () => {
        expect(HALLOWEEN_LIGHTNING_DELAY_MS).toBe(8000);
        expect(getHalloweenLightningFrame(0)).toEqual(calm);
        expect(getHalloweenLightningFrame(7999)).toEqual(calm);
        const outage = [0, 80, 160, 240, 719].map((time) => atEvent(time));
        expect(outage.every((frame) => frame.phase === "blackout" && frame.flash === 0)).toBe(true);
        expect(outage.map((frame) => frame.darkness)).toEqual([0.20, 0.48, 0.72, 0.94, 0.94]);
        expect(atEvent(720)).toMatchObject({ phase: "flash", strike: 0, flash: 1 });
    });

    test("has only two 130ms flashes, with over a second of separation and distinct bolts", () => {
        const windows = [];
        let previous = false;
        for (let time = 0; time <= HALLOWEEN_LIGHTNING_EVENT_MS; time += 1) {
            const frame = atEvent(time);
            const flashing = frame.flash > 0;
            if (flashing && !previous) windows.push({ start: time, strike: frame.strike });
            if (!flashing && previous) windows[windows.length - 1].end = time;
            previous = flashing;
            if (flashing && (frame.phase !== "flash" || frame.bolt <= 0 || frame.shadow <= 0)) {
                throw new Error("A visible strike must have a bolt and cast shadow");
            }
        }
        expect(windows).toEqual([
            { start: 720, end: 850, strike: 0 },
            { start: 2120, end: 2250, strike: 1 },
        ]);
        expect(windows[1].start - windows[0].end).toBeGreaterThanOrEqual(1000);
        for (const window of windows) expect(window.end - window.start).toBe(130);
        expect(atEvent(850)).toMatchObject({ phase: "afterglow", flash: 0, bolt: 0 });
        expect(atEvent(1080)).toMatchObject({ phase: "blackout", flash: 0 });
        expect(atEvent(2250)).toMatchObject({ phase: "afterglow", flash: 0, bolt: 0 });
    });

    test("recovers in steps and repeats every 38 seconds without scene interaction state", () => {
        expect(HALLOWEEN_LIGHTNING_EVENT_MS).toBe(4500);
        expect(HALLOWEEN_LIGHTNING_CYCLE_MS).toBe(38000);
        const recovery = [3500, 3700, 3900, 4100, 4300].map((time) => atEvent(time));
        expect(recovery.every((frame) => frame.phase === "recovery" && frame.flash === 0)).toBe(true);
        expect(recovery.map((frame) => frame.darkness)).toEqual([0.72, 0.52, 0.34, 0.18, 0.06]);
        expect(atEvent(4500)).toEqual(calm);
        expect(atEvent(37999)).toEqual(calm);
        for (const time of [0, 400, 720, 800, 850, 2120, 2250, 3500, 4499, 4500]) {
            const first = atEvent(time);
            // Sampling other moments must never restart or advance the storm.
            atEvent(720);
            atEvent(40000);
            expect(atEvent(time)).toEqual(first);
            expect(atEvent(time + HALLOWEEN_LIGHTNING_CYCLE_MS)).toEqual(first);
        }
    });

    test("reduced motion stays calm throughout the complete event and following cycle", () => {
        for (let time = 0; time < 2 * HALLOWEEN_LIGHTNING_CYCLE_MS; time += 17) {
            expect(getHalloweenLightningFrame(time, { reducedMotion: true })).toEqual(calm);
        }
    });

    test("keeps strengths bounded and invalid or negative clocks calm", () => {
        for (const time of [-1000, -1, NaN, Infinity, -Infinity, undefined]) {
            expect(getHalloweenLightningFrame(time)).toEqual(calm);
        }
        const phases = new Set();
        for (let time = 0; time <= 2 * HALLOWEEN_LIGHTNING_CYCLE_MS; time += 17) {
            const frame = getHalloweenLightningFrame(time);
            phases.add(frame.phase);
            for (const field of ["darkness", "flash", "bolt", "shadow"]) {
                if (!Number.isFinite(frame[field]) || frame[field] < 0 || frame[field] > 1) {
                    throw new Error(field + " is outside its opacity range");
                }
            }
            if (frame.strike !== 0 && frame.strike !== 1) throw new Error("Unexpected bolt variant");
        }
        expect(phases).toEqual(new Set(["calm", "blackout", "flash", "afterglow", "recovery"]));
    });
});
