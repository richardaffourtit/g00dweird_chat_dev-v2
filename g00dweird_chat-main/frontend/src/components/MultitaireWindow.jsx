import React, { useMemo, useState } from "react";
import Win95Window from "./Win95Window";

const SUITS = ["spades", "hearts", "diamonds", "clubs"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const DECK_BOX_SRC = "/assets/multitaire-deckbox.png";
const CARD_BACK_SRC = "/assets/multitaire-card-back.png";
const RED_SUITS = new Set(["hearts", "diamonds"]);

function displayName(user) {
    return String(user?.nickname || "PLAYER").replace(/\s+/g, "_").toUpperCase();
}

function cardImage(card) {
    return `/assets/multitaire-cards/${card.rank.toLowerCase()}-${card.suit}.png`;
}

function makeDeck() {
    return SUITS.flatMap((suit) => RANKS.map((rank, index) => ({
        id: `${rank}-${suit}`,
        rank,
        value: index + 1,
        suit,
        color: RED_SUITS.has(suit) ? "red" : "black",
        faceUp: false,
    })));
}

function shuffle(cards) {
    const next = cards.map((card) => ({ ...card }));
    for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
}

function createGame() {
    const deck = shuffle(makeDeck());
    const tableau = Array.from({ length: 7 }, (_, column) => {
        const pile = deck.splice(0, column + 1);
        return pile.map((card, index) => ({
            ...card,
            faceUp: index === pile.length - 1,
        }));
    });

    return {
        stock: deck.map((card) => ({ ...card, faceUp: false })),
        waste: [],
        foundations: Object.fromEntries(SUITS.map((suit) => [suit, []])),
        tableau,
        moves: 0,
    };
}

function topCard(pile) {
    return pile[pile.length - 1] || null;
}

function canPlaceOnTableau(card, target) {
    if (!card) return false;
    if (!target) return card.value === 13;
    return card.color !== target.color && card.value === target.value - 1;
}

function canPlaceOnFoundation(card, pile) {
    if (!card) return false;
    const target = topCard(pile);
    if (!target) return card.value === 1;
    return card.suit === target.suit && card.value === target.value + 1;
}

function isOrderedRun(cards) {
    return cards.every((card, index) => {
        if (!card.faceUp) return false;
        if (index === 0) return true;
        const previous = cards[index - 1];
        return previous.color !== card.color && previous.value === card.value + 1;
    });
}

function removeSelection(game, selection) {
    const next = {
        ...game,
        stock: [...game.stock],
        waste: [...game.waste],
        foundations: Object.fromEntries(SUITS.map((suit) => [suit, [...game.foundations[suit]]])),
        tableau: game.tableau.map((pile) => [...pile]),
    };
    let moving = [];

    if (selection.source === "waste") {
        moving = [next.waste.pop()];
    }
    if (selection.source === "foundation") {
        moving = [next.foundations[selection.suit].pop()];
    }
    if (selection.source === "tableau") {
        moving = next.tableau[selection.column].splice(selection.index);
        const exposed = topCard(next.tableau[selection.column]);
        if (exposed && !exposed.faceUp) {
            next.tableau[selection.column][next.tableau[selection.column].length - 1] = {
                ...exposed,
                faceUp: true,
            };
        }
    }

    return { next, moving: moving.filter(Boolean).map((card) => ({ ...card, faceUp: true })) };
}

function getSelectionCards(game, selection) {
    if (!selection) return [];
    if (selection.source === "waste") return topCard(game.waste) ? [topCard(game.waste)] : [];
    if (selection.source === "foundation") return topCard(game.foundations[selection.suit]) ? [topCard(game.foundations[selection.suit])] : [];
    if (selection.source === "tableau") return game.tableau[selection.column].slice(selection.index);
    return [];
}

function selectionKey(selection) {
    if (!selection) return "";
    return `${selection.source}:${selection.column ?? ""}:${selection.index ?? ""}:${selection.suit ?? ""}`;
}

function CardButton({ card, selected, onClick, onDoubleClick, onDragStart, stackIndex = 0 }) {
    return (
        <button
            type="button"
            className={`multitaire-card-button ${selected ? "is-selected" : ""}`}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            draggable={card.faceUp}
            onDragStart={onDragStart}
            style={{ "--stack-index": stackIndex }}
            title={card.faceUp ? `${card.rank} of ${card.suit}` : "face down card"}
        >
            <img
                className="multitaire-card-img"
                src={card.faceUp ? cardImage(card) : CARD_BACK_SRC}
                alt={card.faceUp ? `${card.rank} of ${card.suit}` : "card back"}
                draggable={false}
            />
        </button>
    );
}

function EmptyPile({ label, onClick }) {
    return (
        <button type="button" className="multitaire-empty-pile" onClick={onClick}>
            {label}
        </button>
    );
}

function DeckBox({ opened, rotation, onRotate, onOpen }) {
    return (
        <button
            type="button"
            className={`multitaire-deckbox ${opened ? "is-open" : ""}`}
            style={{ "--box-rot": `${rotation}deg` }}
            onClick={onRotate}
            onDoubleClick={onOpen}
            data-testid="multitaire-deckbox"
            title="click to rotate, double-click to open"
        >
            <div className="multitaire-box-spin">
                <div className="multitaire-box-face multitaire-box-front" />
                <div className="multitaire-box-face multitaire-box-back" />
                <div className="multitaire-box-face multitaire-box-side multitaire-box-left" />
                <div className="multitaire-box-face multitaire-box-side multitaire-box-right" />
                <div className="multitaire-box-face multitaire-box-top" />
                <div className="multitaire-box-face multitaire-box-bottom" />
                <div className="multitaire-box-lid" />
            </div>
        </button>
    );
}

export default function MultitaireWindow({
    user,
    users = [],
    onClose,
    initialX = 150,
    initialY = 74,
    requestFocus = 0,
}) {
    const [rotation, setRotation] = useState(0);
    const [opened, setOpened] = useState(false);
    const [game, setGame] = useState(createGame);
    const [selected, setSelected] = useState(null);
    const [status, setStatus] = useState("Double-click the haunted box to deal.");
    const players = useMemo(() => {
        const byId = new Map();
        [user, ...users].filter(Boolean).forEach((entry) => {
            byId.set(entry.user_id || entry.nickname, entry);
        });
        return [...byId.values()].slice(0, 8);
    }, [user, users]);

    function resetGame() {
        setGame(createGame());
        setSelected(null);
        setOpened(true);
        setStatus("New cursed deal. Build down by alternating color.");
    }

    function openDeck() {
        setOpened(true);
        setSelected(null);
        setStatus("Cards are live. Click a card, then click where it should go.");
    }

    function dealStock() {
        if (!opened) return;
        setSelected(null);
        setGame((current) => {
            if (current.stock.length) {
                const stock = [...current.stock];
                const card = { ...stock.pop(), faceUp: true };
                setStatus(`${card.rank} ${card.suit} crawled out of the stock.`);
                return { ...current, stock, waste: [...current.waste, card], moves: current.moves + 1 };
            }
            if (current.waste.length) {
                setStatus("Waste recycled back into the stock.");
                return {
                    ...current,
                    stock: [...current.waste].reverse().map((card) => ({ ...card, faceUp: false })),
                    waste: [],
                    moves: current.moves + 1,
                };
            }
            setStatus("No cards left in stock or waste.");
            return current;
        });
    }

    function selectCard(selection) {
        if (!opened) return;
        const cards = getSelectionCards(game, selection);
        if (!cards.length || !cards[0].faceUp) return;
        if (selection.source === "tableau" && !isOrderedRun(cards)) {
            setStatus("That stack is broken. Start at a clean descending run.");
            return;
        }
        setSelected(selection);
        setStatus(`${cards[0].rank} ${cards[0].suit} selected.`);
    }

    function moveSelectionToTableau(selection, column) {
        if (!selection) return;
        const moving = getSelectionCards(game, selection);
        if (!moving.length || !canPlaceOnTableau(moving[0], topCard(game.tableau[column]))) {
            setStatus("Nope. Tableau wants descending, alternating color.");
            return;
        }
        const { next, moving: cards } = removeSelection(game, selection);
        next.tableau[column] = [...next.tableau[column], ...cards];
        next.moves += 1;
        setGame(next);
        setSelected(null);
        setStatus("Moved.");
    }

    function moveToTableau(column) {
        moveSelectionToTableau(selected, column);
    }

    function moveSelectionToFoundation(selection, suit) {
        if (!selection) return;
        const moving = getSelectionCards(game, selection);
        if (moving.length !== 1 || moving[0].suit !== suit || !canPlaceOnFoundation(moving[0], game.foundations[suit])) {
            setStatus("Foundation needs same suit, ace upward.");
            return;
        }
        const { next, moving: cards } = removeSelection(game, selection);
        next.foundations[suit] = [...next.foundations[suit], cards[0]];
        next.moves += 1;
        setGame(next);
        setSelected(null);
        setStatus(`${cards[0].rank} ${suit} locked into foundation.`);
    }

    function moveToFoundation(suit) {
        moveSelectionToFoundation(selected, suit);
    }

    function tryAutoFoundation(selection) {
        const moving = getSelectionCards(game, selection);
        if (moving.length !== 1) return;
        moveSelectionToFoundation(selection, moving[0].suit);
    }

    function startDrag(event, selection) {
        const moving = getSelectionCards(game, selection);
        if (!moving.length || !moving[0].faceUp) {
            event.preventDefault();
            return;
        }
        if (selection.source === "tableau" && !isOrderedRun(moving)) {
            event.preventDefault();
            setStatus("That stack is broken. Start dragging from a clean run.");
            return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-multitaire-selection", JSON.stringify(selection));
        setSelected(selection);
    }

    function readDragSelection(event) {
        try {
            return JSON.parse(event.dataTransfer.getData("application/x-multitaire-selection"));
        } catch {
            return selected;
        }
    }

    function allowDrop(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }

    function dropOnTableau(event, column) {
        event.preventDefault();
        moveSelectionToTableau(readDragSelection(event), column);
    }

    function dropOnFoundation(event, suit) {
        event.preventDefault();
        moveSelectionToFoundation(readDragSelection(event), suit);
    }

    const selectedId = selectionKey(selected);

    return (
        <Win95Window
            title="MULTITAIRE.exe"
            testId="multitaire-window"
            initialX={initialX}
            initialY={initialY}
            width={860}
            height={640}
            onClose={onClose}
            requestFocus={requestFocus}
            resizable
            minWidth={720}
            minHeight={520}
            icon={<span style={{ color: "#7f2ca8" }}>♠</span>}
        >
            <div className="multitaire-app">
                <div className="multitaire-topbar">
                    <span>MULTITAIRE.exe</span>
                    <span>{opened ? `MOVES ${game.moves}` : "CLICK BOX / DOUBLE CLICK TO DEAL"}</span>
                    <button type="button" className="multitaire-mini-button" onClick={resetGame}>NEW DEAL</button>
                </div>
                <div className="multitaire-board">
                    <div className="multitaire-art-layer" aria-hidden="true">
                        <img className="multitaire-art multitaire-art-oath" src="/assets/multitaire-extra/top-oath.png" alt="" draggable={false} />
                        <img className="multitaire-art multitaire-art-left" src="/assets/multitaire-extra/left-panel.png" alt="" draggable={false} />
                        <img className="multitaire-art multitaire-art-right" src="/assets/multitaire-extra/right-panel.png" alt="" draggable={false} />
                        <img className="multitaire-art multitaire-art-skull" src="/assets/multitaire-extra/title-skull.png" alt="" draggable={false} />
                        <img className="multitaire-art multitaire-art-luck" src="/assets/multitaire-extra/bottom-luck.png" alt="" draggable={false} />
                    </div>
                    <div className="multitaire-player-rail">
                        {players.map((player) => (
                            <div key={player.user_id || player.nickname} className="multitaire-player">
                                <span className="multitaire-online" />
                                <span>{displayName(player)}</span>
                            </div>
                        ))}
                    </div>
                    {!opened && (
                        <>
                            <img
                                className="multitaire-opening-logo"
                                src="/assets/multitaire-logo.png"
                                alt="MULTITAIRE"
                                draggable={false}
                            />
                            <DeckBox
                                opened={opened}
                                rotation={rotation}
                                onRotate={() => setRotation((value) => value + 90)}
                                onOpen={openDeck}
                            />
                        </>
                    )}
                    {opened && (
                        <div className="multitaire-game">
                            <div className="multitaire-control-row">
                                <button type="button" className="multitaire-stock" onClick={dealStock}>
                                    {game.stock.length ? (
                                        <img className="multitaire-card-img" src={CARD_BACK_SRC} alt="stock" draggable={false} />
                                    ) : (
                                        <span>RELOAD</span>
                                    )}
                                </button>
                                <div className="multitaire-waste">
                                    {topCard(game.waste) ? (
                                        <CardButton
                                            card={topCard(game.waste)}
                                            selected={selectedId === "waste:::"}
                                            onClick={() => selectCard({ source: "waste" })}
                                            onDoubleClick={() => tryAutoFoundation({ source: "waste" })}
                                            onDragStart={(event) => startDrag(event, { source: "waste" })}
                                        />
                                    ) : (
                                        <EmptyPile label="WASTE" onClick={() => {}} />
                                    )}
                                </div>
                                <div className="multitaire-foundation-row">
                                    {SUITS.map((suit) => {
                                        const foundationTop = topCard(game.foundations[suit]);
                                        return (
                                            <div
                                                key={suit}
                                                className="multitaire-foundation"
                                                onDragOver={allowDrop}
                                                onDrop={(event) => dropOnFoundation(event, suit)}
                                            >
                                                {foundationTop ? (
                                                    <CardButton
                                                        card={foundationTop}
                                                        selected={selectedId === selectionKey({ source: "foundation", suit })}
                                                        onClick={() => selected ? moveToFoundation(suit) : selectCard({ source: "foundation", suit })}
                                                        onDragStart={(event) => startDrag(event, { source: "foundation", suit })}
                                                    />
                                                ) : (
                                                    <EmptyPile label={suit[0].toUpperCase()} onClick={() => moveToFoundation(suit)} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="multitaire-tableau-grid">
                                {game.tableau.map((pile, column) => (
                                    <div
                                        key={column}
                                        className="multitaire-column"
                                        onDragOver={allowDrop}
                                        onDrop={(event) => dropOnTableau(event, column)}
                                    >
                                        {pile.length === 0 && <EmptyPile label="K" onClick={() => moveToTableau(column)} />}
                                        {pile.map((card, index) => {
                                            const currentSelection = { source: "tableau", column, index };
                                            return (
                                                <CardButton
                                                    key={card.id}
                                                    card={card}
                                                    stackIndex={index}
                                                    selected={selectedId === selectionKey(currentSelection)}
                                                    onClick={() => selected ? moveToTableau(column) : selectCard(currentSelection)}
                                                    onDoubleClick={() => tryAutoFoundation(currentSelection)}
                                                    onDragStart={(event) => startDrag(event, currentSelection)}
                                                />
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                            <div className="multitaire-status">{status}</div>
                        </div>
                    )}
                </div>
            </div>
        </Win95Window>
    );
}
