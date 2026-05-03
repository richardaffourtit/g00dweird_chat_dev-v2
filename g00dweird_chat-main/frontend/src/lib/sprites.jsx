import React from "react";

/**
 * Pixel-art sprite library rendered as SVG rects.
 * Each sprite grid uses single-char color keys from PALETTE.
 * '.' = transparent.
 */

const P = {
    "#": "#000000",
    w: "#ffffff",
    W: "#d8d8d8",
    d: "#4a4a4a",
    D: "#2a2a2a",
    p: "#ffbdd6",
    r: "#e2302b",
    o: "#ff8844",
    y: "#ffee55",
    g: "#5fe06d",
    G: "#1a8c1a",
    c: "#4ae0e0",
    u: "#b066ea",
    U: "#6a2ca8",
    b: "#8b5a2b",
    B: "#4a2f14",
    l: "#c49a6c",
    k: "#000000", // eye pupil (same as #, kept for readability)
    K: "#222222",
    s: "#f4c2a1", // skin
    S: "#d48a66",
    e: "#ffaf36", // amber glow
};

const GRIDS = {
    ghost_tiny: {
        kind: "ghost",
        label: "tiny ghost",
        size: "sm",
        grid: [
            "...####...",
            "..#wwww#..",
            ".#wkwwkww#",
            ".#wkwwkww#",
            ".#wwwwwww#",
            ".#wwpwpww#",
            ".#wwwwwww#",
            ".#wwwwwww#",
            "#wwwwwwww#",
            "#.##.##.##",
        ],
    },
    ghost_cute: {
        kind: "ghost",
        label: "cute ghost",
        size: "md",
        grid: [
            "....####....",
            "..##wwww##..",
            ".#wwwwwwww#.",
            ".#wkwwwwkw#.",
            ".#wkwwwwkw#.",
            ".#wwwwwwww#.",
            ".#wwppwwpp#.",
            ".#wwwwwwww#.",
            ".#wwwwwwww#.",
            "#wwwwwwwwww#",
            "#wwwwwwwwww#",
            "#.##..##..##",
        ],
    },
    ghost_giant: {
        kind: "ghost",
        label: "giant ghost",
        size: "lg",
        grid: [
            "....########....",
            "..##wwwwwwww##..",
            ".#wwwwwwwwwwww#.",
            ".#wwrwwwwwwrww#.",
            ".#wrrwwwwwwrrw#.",
            ".#wrrwwwwwwrrw#.",
            ".#wwrwwwwwwrww#.",
            ".#wwwwwkkwwwww#.",
            ".#wwwkkwwkkwww#.",
            ".#wwwwwwwwwwww#.",
            ".#wwwwwwwwwwww#.",
            ".#wwwwwwwwwwww#.",
            "#wwwwwwwwwwwwww#",
            "#wwwwwwwwwwwwww#",
            "#wwwwwwwwwwwwww#",
            "#.##..##..##..##",
        ],
    },

    alien_gray: {
        kind: "alien",
        label: "gray visitor",
        size: "sm",
        grid: [
            "...####...",
            "..#WWWW#..",
            ".#WWWWWW#.",
            "#WWWWWWWW#",
            "#WkkWWkkW#",
            "#WkkWWkkW#",
            "#WWWWWWWW#",
            ".#WWWWWW#.",
            "..#W##W#..",
            "..W....W..",
        ],
    },
    alien_green: {
        kind: "alien",
        label: "antenna alien",
        size: "md",
        grid: [
            "....#r#.....",
            "....#r#.....",
            "....#g#.....",
            "...#gg#.....",
            "..##gggg##..",
            ".#gggggggg#.",
            "#ggkkwwkkgg#",
            "#ggkwwwwkgg#",
            "#gggggggggg#",
            "#gg#GGGG#gg#",
            ".#gggggggg#.",
            "..#gg..gg#..",
        ],
    },
    alien_hulk: {
        kind: "alien",
        label: "purple hulk",
        size: "lg",
        grid: [
            "......####......",
            ".....#uurr#.....",
            "....##uurr##....",
            "...#uuuuuuuu#...",
            "..#uuuuuuuuuu#..",
            ".#uuuuuuuuuuuu#.",
            "#uuwwkkwwkkuuuu#",
            "#uuwkkwwkkwuuuu#",
            "#uuuuuwwwwuuuuu#",
            "#uuuuwwwwwuuuuu#",
            "#uuuuuuuuuuuuuu#",
            "#uUUUuuuuuuUUUu#",
            ".#uuuuuuuuuuuu#.",
            "..#uuuuuuuuuu#..",
            "...#uu#..#uu#...",
            "...uuu....uuu...",
        ],
    },

    ape_baby: {
        kind: "ape",
        label: "lil ape",
        size: "sm",
        grid: [
            "..#####...",
            ".#bbbbb#..",
            "#bblllbb#.",
            "#blwkwlb#.",
            "#blkwklbb#",
            "#bbllllbb#",
            "#bb#bb#bb#",
            ".#bbbbbb#.",
            "..#b##b#..",
            "..b...b...",
        ],
    },
    ape_dude: {
        kind: "ape",
        label: "chimp dude",
        size: "md",
        grid: [
            "....####....",
            "..##bbbb##..",
            ".#bbbbbbbb#.",
            "#bbbllllllb#",
            "#blwwkkwwlb#",
            "#blkwwwwklb#",
            "#blwwkkwwwb#",
            "#bblllllllb#",
            ".#bbbbbbbb#.",
            ".#bbbbbbbb#.",
            ".#bb....bb#.",
            ".b........b.",
        ],
    },
    ape_king: {
        kind: "ape",
        label: "silverback",
        size: "lg",
        grid: [
            "....########....",
            "...#dddddddd#...",
            "..#ddBBBBddd#...",
            ".#dBBllllBBdd#..",
            "#dBllllllllBBd#.",
            "#dllwkkwwkkwllb#",
            "#dllkwwwwwwwllb#",
            "#dllwwkkkkwwwlb#",
            "#dBlwwwwwwwwlBd#",
            "#dBBBlllllllBBd#",
            "#ddddddddddddddd",
            "#dddddddddddddd#",
            ".#bbbbbbbbbbbb#.",
            ".#bbbb....bbbb#.",
            "..b..........b..",
            "..b..........b..",
        ],
    },
};

function padGrid(grid) {
    const w = Math.max(...grid.map((r) => r.length));
    return grid.map((r) => r.padEnd(w, "."));
}

export const SPRITES = Object.fromEntries(
    Object.entries(GRIDS).map(([id, s]) => [
        id,
        { ...s, id, grid: padGrid(s.grid) },
    ])
);

export const SPRITE_IDS = Object.keys(SPRITES);

// Default sizes (px) per class when rendered in IsoWorld
export const SIZE_PX = { sm: 44, md: 60, lg: 84 };

export function Sprite({ id, size, title, flip = false }) {
    const spr = SPRITES[id];
    if (!spr) return null;
    const pxSize = size || SIZE_PX[spr.size] || 44;
    const rows = spr.grid;
    const h = rows.length;
    const w = rows[0].length;
    return (
        <svg
            width={pxSize}
            height={Math.round((pxSize * h) / w)}
            viewBox={`0 0 ${w} ${h}`}
            style={{
                imageRendering: "pixelated",
                display: "block",
                position: "relative",
                zIndex: 1,
                transform: flip ? "scaleX(-1)" : "none",
                transformOrigin: "center",
            }}
            shapeRendering="crispEdges"
            aria-label={title || spr.label}
        >
            {rows.map((row, y) =>
                row.split("").map((ch, x) => {
                    if (ch === "." || !P[ch]) return null;
                    return (
                        <rect
                            key={`${x}-${y}`}
                            x={x}
                            y={y}
                            width={1}
                            height={1}
                            fill={P[ch]}
                        />
                    );
                })
            )}
        </svg>
    );
}

export function getSprite(id) {
    return SPRITES[id];
}
