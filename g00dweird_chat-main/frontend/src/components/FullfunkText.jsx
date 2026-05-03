import React from "react";

// Mapping char -> filename (same as backend manifest)
const MAP = {
    "!": "excl", "?": "ques", ".": "dot", ",": "comma",
    ";": "semi", ":": "colon", "-": "dash", "_": "under",
    "+": "plus", "=": "eq", "@": "at", "#": "hash",
    "$": "dollar", "%": "pct", "&": "amp", "*": "ast",
    "<": "lt", ">": "gt", "/": "fsl", "|": "pipe",
    "'": "apos", '"': "quot", "`": "grave", "~": "tilde",
    "^": "caret", "[": "lbr", "]": "rbr", "{": "lcb",
    "}": "rcb", "(": "lp", ")": "rp",
};

function glyphPath(ch) {
    const up = ch.toUpperCase();
    if (up >= "A" && up <= "Z") return `/fullfunk/${up}.png`;
    if (up >= "0" && up <= "9") return `/fullfunk/${up}.png`;
    const slug = MAP[ch];
    if (slug) return `/fullfunk/${slug}.png`;
    return null;
}

/**
 * Render a string using fullfunk glyph images.
 * Falls back to a plain span for non-mapped chars (including spaces).
 */
export default function FullfunkText({
    text,
    size = 18,
    gap = 1,
    color,
    testId,
    vertical = false,
}) {
    if (!text) return null;
    const chars = [...text];
    return (
        <span
            data-testid={testId}
            style={{
                display: "inline-flex",
                flexDirection: vertical ? "column" : "row",
                flexWrap: "wrap",
                alignItems: vertical ? "center" : "flex-end",
                justifyContent: "center",
                gap,
                lineHeight: 1,
                verticalAlign: "middle",
            }}
        >
            {chars.map((ch, i) => {
                if (ch === " ") {
                    return (
                        <span
                            key={i}
                            style={{ width: size * 0.5, height: size, display: "inline-block" }}
                        />
                    );
                }
                if (ch === "\n") {
                    return <span key={i} style={{ flexBasis: "100%", height: 0 }} />;
                }
                const src = glyphPath(ch);
                if (!src) {
                    return (
                        <span
                            key={i}
                            className="font-pixel"
                            style={{
                                fontSize: size * 0.8,
                                color: color || "#f0f",
                                lineHeight: `${size}px`,
                                display: "inline-block",
                                verticalAlign: "middle",
                            }}
                        >
                            {ch}
                        </span>
                    );
                }
                return (
                    <img
                        key={i}
                        src={src}
                        alt={ch}
                        style={{
                            height: size,
                            width: "auto",
                            imageRendering: "pixelated",
                            display: "inline-block",
                            verticalAlign: "bottom",
                        }}
                        draggable={false}
                    />
                );
            })}
        </span>
    );
}
