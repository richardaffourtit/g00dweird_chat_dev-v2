import { shouldClearThoughtBubblePixel } from "./thoughtBubbleMatte";

describe("thought bubble matte clearing", () => {
    test("clears sheet matte and guide-label colors", () => {
        expect(shouldClearThoughtBubblePixel(220, 20, 12)).toBe(true);
        expect(shouldClearThoughtBubblePixel(155, 12, 8)).toBe(true);
        expect(shouldClearThoughtBubblePixel(255, 248, 0)).toBe(true);
        expect(shouldClearThoughtBubblePixel(232, 132, 0)).toBe(true);
    });

    test("keeps cloud art colors", () => {
        expect(shouldClearThoughtBubblePixel(255, 255, 248)).toBe(false);
        expect(shouldClearThoughtBubblePixel(196, 178, 210)).toBe(false);
        expect(shouldClearThoughtBubblePixel(0, 0, 0)).toBe(false);
    });
});
