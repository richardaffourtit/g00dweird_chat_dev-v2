// One short outage, then a long quiet interval. All times are milliseconds.
export const HALLOWEEN_LIGHTNING_CYCLE_MS = 38000;
export const HALLOWEEN_LIGHTNING_DELAY_MS = 8000;
export const HALLOWEEN_LIGHTNING_EVENT_MS = 4500;

const CALM = Object.freeze({
    phase: "calm", darkness: 0, flash: 0, bolt: 0, strike: 0, shadow: 0,
});

function step(at, phase, darkness, { flash = 0, bolt = 0, strike = 0, shadow = 0 } = {}) {
    return { at, frame: Object.freeze({ phase, darkness, flash, bolt, strike, shadow }) };
}

// Each flash has three descending exposures over 130ms. Strike 0 and 1 let the
// renderer choose different bolt shapes/colors without using a random clock.
// Afterglow keeps a little light in the scene, without adding another flash.
const STORM = [
    step(0, "blackout", 0.20),
    step(80, "blackout", 0.48),
    step(160, "blackout", 0.72),
    step(240, "blackout", 0.94),
    step(720, "flash", 0.94, { flash: 1, bolt: 1, shadow: 0.90 }),
    step(760, "flash", 0.94, { flash: 0.62, bolt: 0.78, shadow: 0.65 }),
    step(810, "flash", 0.94, { flash: 0.28, bolt: 0.38, shadow: 0.32 }),
    step(850, "afterglow", 0.84, { shadow: 0.18 }),
    step(970, "afterglow", 0.90, { shadow: 0.07 }),
    step(1080, "blackout", 0.94),
    step(2120, "flash", 0.94, { flash: 0.88, bolt: 1, strike: 1, shadow: 1 }),
    step(2160, "flash", 0.94, { flash: 0.56, bolt: 0.72, strike: 1, shadow: 0.64 }),
    step(2210, "flash", 0.94, { flash: 0.24, bolt: 0.34, strike: 1, shadow: 0.30 }),
    step(2250, "afterglow", 0.84, { strike: 1, shadow: 0.18 }),
    step(2370, "afterglow", 0.90, { strike: 1, shadow: 0.07 }),
    step(2480, "blackout", 0.94, { strike: 1 }),
    step(3500, "recovery", 0.72),
    step(3700, "recovery", 0.52),
    step(3900, "recovery", 0.34),
    step(4100, "recovery", 0.18),
    step(4300, "recovery", 0.06),
];

/**
 * Read a storm frame from elapsed scene time. Lantern clicks and other scene
 * reactions do not affect this clock. The renderer may pause the clock when
 * hidden; reduced motion disables both darkness changes and lightning.
 */
export function getHalloweenLightningFrame(elapsedMs, { reducedMotion = false } = {}) {
    if (reducedMotion || !Number.isFinite(elapsedMs) || elapsedMs < HALLOWEEN_LIGHTNING_DELAY_MS) {
        return CALM;
    }

    const eventTime = (elapsedMs - HALLOWEEN_LIGHTNING_DELAY_MS) % HALLOWEEN_LIGHTNING_CYCLE_MS;
    if (eventTime >= HALLOWEEN_LIGHTNING_EVENT_MS) return CALM;

    for (let index = STORM.length - 1; index >= 0; index -= 1) {
        if (eventTime >= STORM[index].at) return STORM[index].frame;
    }
    return CALM;
}
