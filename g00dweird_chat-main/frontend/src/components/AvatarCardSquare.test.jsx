import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import AvatarCardSquare from "./AvatarCardSquare";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderIntoDocument(element) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
        root.render(element);
    });

    return {
        container,
        root,
        getByTestId(testId) {
            const node = container.querySelector(`[data-testid="${testId}"]`);
            if (!node) throw new Error(`Missing test id: ${testId}`);
            return node;
        },
        queryByTestId(testId) {
            return container.querySelector(`[data-testid="${testId}"]`);
        },
        getByAltText(alt) {
            const node = container.querySelector(`img[alt="${alt}"]`);
            if (!node) throw new Error(`Missing alt text: ${alt}`);
            return node;
        },
    };
}

afterEach(() => {
    document.body.innerHTML = "";
});

describe("AvatarCardSquare", () => {
    test("renders stock card art with initials and opens large card", () => {
        const view = renderIntoDocument(<AvatarCardSquare nickname="rich ford" animId="ape" size={80} testId="card-square" />);

        expect(view.getByTestId("card-square").getAttribute("data-card-id")).toBe("ape");
        expect(view.getByTestId("avatar-card-initials").textContent).toBe("RF");

        act(() => {
            view.getByTestId("card-square").dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        expect(view.getByTestId("avatar-card-modal")).toBeTruthy();
        expect(view.getByAltText("APE card").getAttribute("src")).toBe("/assets/avatar-cards/full/ape.png");
    });

    test("uploaded avatar wins and does not open a stock modal", () => {
        const view = renderIntoDocument(
            <AvatarCardSquare
                nickname="rich ford"
                avatarUrl="/uploads/rich.png"
                animId="ape"
                size={80}
                testId="card-square"
            />
        );

        expect(view.getByTestId("avatar-card-uploaded").getAttribute("src")).toBe("/uploads/rich.png");
        act(() => {
            view.getByTestId("card-square").dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        expect(view.queryByTestId("avatar-card-modal")).toBeNull();
    });

    test("unknown avatar falls back to initials tile", () => {
        const view = renderIntoDocument(<AvatarCardSquare nickname="single" animId="missing" size={80} testId="card-square" />);

        expect(view.getByTestId("avatar-card-fallback").textContent).toBe("S");
        expect(view.getByTestId("card-square").getAttribute("aria-disabled")).toBe("true");
    });
});
