import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import YouTubeWindow from "./YouTubeWindow";

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
    };
}

function changeInput(input, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    act(() => {
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
    });
}

afterEach(() => {
    document.body.innerHTML = "";
});

describe("YouTubeWindow", () => {
    test("recovers from an invalid paste without using the error as the video title", () => {
        const sendWS = jest.fn();
        const view = renderIntoDocument(
            <YouTubeWindow
                user={{ nickname: "tester" }}
                currentYoutube={null}
                youtubeQueue={[]}
                sendWS={sendWS}
            />
        );

        changeInput(view.getByTestId("yt-input"), "not a link");
        act(() => {
            view.getByTestId("yt-play-now").dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        expect(sendWS).not.toHaveBeenCalled();
        expect(view.getByTestId("yt-error").textContent).toMatch(/youtube/i);

        changeInput(view.getByTestId("yt-input"), "https://youtu.be/dQw4w9WgXcQ?si=test");
        act(() => {
            view.getByTestId("yt-play-now").dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        expect(sendWS).toHaveBeenCalledWith({
            type: "youtube_play",
            video_id: "dQw4w9WgXcQ",
            title: "dQw4w9WgXcQ",
        });
    });

    test("pressing Enter plays immediately when the theatre screen is idle", () => {
        const sendWS = jest.fn();
        const view = renderIntoDocument(
            <YouTubeWindow
                user={{ nickname: "tester" }}
                currentYoutube={null}
                youtubeQueue={[]}
                sendWS={sendWS}
            />
        );

        changeInput(view.getByTestId("yt-input"), "dQw4w9WgXcQ");
        act(() => {
            view.getByTestId("yt-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });

        expect(sendWS).toHaveBeenCalledWith({
            type: "youtube_play",
            video_id: "dQw4w9WgXcQ",
            title: "dQw4w9WgXcQ",
        });
    });
});
