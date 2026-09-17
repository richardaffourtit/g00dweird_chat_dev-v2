// Local browser regression check. Uses preview mock data; never posts to chat.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("../frontend/node_modules/playwright");

const baseURL = process.env.HALLOWEEN_PREVIEW_URL || "http://127.0.0.1:3003";
const reportDir = path.resolve(__dirname, "../reports/halloween-lightning");

(async () => {
    await fs.mkdir(reportDir, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const failures = [];
    const page = await browser.newPage({ viewport: { width: 1366, height: 950 } });
    page.on("pageerror", (error) => failures.push(error.message));
    await page.routeWebSocket("**", (socket) => socket.close());
    await page.route("**/api/**", (route) => ["GET", "HEAD"].includes(route.request().method()) ? route.continue() : route.abort());
    await page.addInitScript(() => localStorage.setItem("gw_user", JSON.stringify({ user_id: "preview-lightning-check", nickname: "lightningcheck" })));
    await page.clock.install({ time: new Date("2026-09-17T12:00:00Z") });
    await page.clock.pauseAt(new Date("2026-09-17T12:00:00Z"));
    await page.goto(`${baseURL}/r/halloween`);
    const lighting = page.getByTestId("halloween-lighting");
    await lighting.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-testid="halloween-lighting"]')?.dataset.ready === "true");
    const states = [];
    const capture = async (name, expectedPhase) => {
        // Visibility assertions alone miss opaque scenery covering a message.
        // Include the normally click-through art in a hit-test to check paint
        // order, then restore its event behavior before continuing.
        const chatOnTop = await page.getByTestId("chat-messages").evaluate((panel) => {
            const art = document.querySelector(".halloween-lighting");
            const previous = art.style.pointerEvents;
            try {
                art.style.pointerEvents = "auto";
                const bounds = panel.getBoundingClientRect();
                const front = document.elementFromPoint(bounds.left + 16, bounds.top + 20);
                return panel.contains(front);
            } finally {
                art.style.pointerEvents = previous;
            }
        });
        assert.equal(chatOnTop, true, `${name}: chat must paint above the room artwork`);
        const state = await lighting.evaluate((node) => ({
            phase: node.dataset.phase,
            strike: node.dataset.strike,
            darkness: node.parentElement.style.getPropertyValue("--halloween-darkness"),
            lanternFilter: getComputedStyle(node.querySelector(".halloween-lantern-light")).filter,
            foregroundFilter: getComputedStyle(node.querySelector(".halloween-foreground")).filter,
            backgroundFilter: getComputedStyle(node.querySelector(".halloween-background")).filter,
            boltOpacity: getComputedStyle(node.querySelector(".halloween-bolts")).opacity,
        }));
        assert.equal(state.phase, expectedPhase, name);
        assert.equal(state.lanternFilter, "none", "lantern pixels are never tinted or darkened");
        states.push({ name, ...state });
        await page.screenshot({ path: path.join(reportDir, `${name}.png`) });
    };
    await capture("calm", "calm");
    await page.clock.runFor(8460);
    await capture("blackout", "blackout");
    await page.clock.runFor(300);
    await capture("first-flash", "flash");
    await page.clock.runFor(600);
    await capture("dark-pause", "blackout");
    await page.clock.runFor(800);
    await capture("second-flash", "flash");
    assert.equal(states.at(-1).strike, "1");
    await page.clock.runFor(1800);
    await capture("recovery", "recovery");
    await page.clock.runFor(1000);
    await capture("restored", "calm");

    // Existing interactive scenery remains usable above the weather layers.
    await page.getByTestId("halloween-secret-clock").dispatchEvent("click");
    assert.match(await page.getByTestId("halloween-whisper").textContent(), /MIDNIGHT/);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.runFor(40000);
    await capture("reduced-motion", "calm");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.runFor(100);
    await capture("mobile", "calm");
    assert.equal(await page.getByTestId("halloween-ghosts").count(), 1);
    const ghostCount = await page.locator(".halloween-ghost-actor").count();
    assert.equal(ghostCount, 4);

    // Failed optional art leaves the original room usable and never flashes.
    await page.route("**/assets/halloween/scene/foreground.png", (route) => route.abort());
    await page.reload();
    await lighting.waitFor();
    await page.clock.runFor(14000);
    assert.equal(await lighting.getAttribute("data-ready"), "false");
    assert.equal(await lighting.getAttribute("data-phase"), "calm");
    assert.match(await page.getByTestId("iso-world-plane").evaluate((node) => node.style.backgroundImage), /halloween/);
    assert.deepEqual(failures, []);
    const report = { baseURL, states, ghostCount, failedAssetFallback: true, errors: failures };
    await fs.writeFile(path.join(reportDir, "check.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
