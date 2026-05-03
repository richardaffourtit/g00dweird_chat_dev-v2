import React from "react";

const EMOTICONS = [
    ":)", ":(", ":D", ";)", ":P", "XD", ":O", "<3",
    "</3", ":/", "T_T", "o_O", "^_^", "^o^", "(o_o)", "(>_<)",
    "¯\\_(ツ)_/¯", "(ಠ_ಠ)", "(☉_☉)", "(╯°□°)╯︵", "uwu", "owo", "~*~",
    "★", "☆", "♥", "♡", "♪", "✧", "▲", "●",
];

/**
 * Compose bar: emote panel + emote-toggle / think-toggle / fullfunk-toggle /
 * input + send. Notifies parent of typing via onChange.
 */
export default function ChatInputBar({
    text,
    onChange,
    onSubmit,
    fullfunk,
    onToggleFullfunk,
    showEmotes,
    onToggleEmotes,
    onAddThink,
    connected,
}) {
    const isThinking = text.startsWith("*think");
    const insertEmote = (e) => onChange({ target: { value: text ? `${text} ${e}` : e } });

    return (
        <>
            {showEmotes && (
                <div
                    className="w95-bevel-inset p-2 mb-1"
                    style={{ background: "#fff", maxHeight: 120, overflowY: "auto" }}
                    data-testid="emote-picker"
                >
                    <div className="font-pixel mb-1" style={{ fontSize: 10, color: "#000080" }}>
                        EMOTICONS
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {EMOTICONS.map((e) => (
                            <button
                                key={e} type="button"
                                className="w95-button font-mono-retro"
                                style={{ fontSize: 16, padding: "2px 6px" }}
                                onClick={() => insertEmote(e)}
                                data-testid="emote-btn"
                            >
                                {e}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <form onSubmit={onSubmit} className="flex gap-1" data-testid="chat-form">
                <button
                    type="button"
                    className={`w95-button ${showEmotes ? "active" : ""}`}
                    onClick={onToggleEmotes}
                    data-testid="toggle-emotes"
                    title="emoticons"
                    style={{ flex: "0 0 auto" }}
                >
                    :)
                </button>
                <button
                    type="button"
                    className="w95-button"
                    onClick={onAddThink}
                    title="thought bubble"
                    data-testid="toggle-think"
                    style={{ flex: "0 0 auto" }}
                >
                    💭
                </button>
                <button
                    type="button"
                    className={`w95-button ${fullfunk ? "active" : ""}`}
                    onClick={onToggleFullfunk}
                    title="fullfunk mode - type in cursed pixel font"
                    data-testid="toggle-fullfunk"
                    style={{
                        flex: "0 0 auto",
                        background: fullfunk ? "#ffee55" : undefined,
                        fontWeight: "bold",
                    }}
                >
                    𝔽𝕟𝕜
                </button>
                <input
                    className="w95-input flex-1"
                    value={text}
                    onChange={onChange}
                    placeholder={
                        connected
                            ? fullfunk
                                ? "FULLFUNK MODE — msg renders as pixel glyphs"
                                : "type... or *think for thought bubble"
                            : "connecting..."
                    }
                    disabled={!connected}
                    maxLength={500}
                    data-testid="chat-input"
                    style={{
                        background: isThinking ? "#ffffcc" : fullfunk ? "#ffeeff" : "#fff",
                        fontStyle: isThinking ? "italic" : "normal",
                        minWidth: 0,
                    }}
                    autoComplete="off"
                />
                <button
                    className="w95-button"
                    type="submit"
                    data-testid="chat-send"
                    disabled={!connected}
                    style={{ flex: "0 0 auto" }}
                >
                    Send
                </button>
            </form>
        </>
    );
}
