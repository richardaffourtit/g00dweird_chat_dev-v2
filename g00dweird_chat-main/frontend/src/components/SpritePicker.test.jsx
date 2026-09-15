import React, { act } from "react";
import { createRoot } from "react-dom/client";
import SpritePicker from "./SpritePicker";

jest.mock("./AnimSprite", () => ({
    __esModule: true,
    ...jest.requireActual("./AnimSprite"),
    default: () => null,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("PRESENT. can be selected by his exact name and exposes all four emotes", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const onPickAnim = jest.fn();
    const onPickStance = jest.fn();
    try {
        act(() => root.render(
            <SpritePicker animId="present" onPickAnim={onPickAnim} onPickStance={onPickStance} />
        ));
        const tile = host.querySelector('[data-testid="anim-pick-present"]');
        expect(tile.textContent).toBe("PRESENT.");
        expect(tile.title).toBe("PRESENT.");
        act(() => tile.dispatchEvent(new MouseEvent("click", { bubbles: true })));
        expect(onPickAnim).toHaveBeenCalledWith("present");
        ["♥", "?", "✨", "♫"].forEach((label, index) => {
            const state = `emote_${"abcd"[index]}`;
            const button = host.querySelector(`[data-testid="stance-${state}"]`);
            expect(button.textContent).toBe(label);
            act(() => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
            expect(onPickStance).toHaveBeenLastCalledWith(state);
        });
        expect(host.querySelector('[data-testid="stance-attack"]')).toBeNull();
    } finally {
        act(() => root.unmount());
    }
});
