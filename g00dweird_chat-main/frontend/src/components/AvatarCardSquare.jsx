import React, { useEffect, useMemo, useState } from "react";
import { avatarCardAssetFor, avatarInitials } from "../lib/avatarCards";

const CHIP_STYLE = {
    position: "absolute",
    right: 3,
    bottom: 3,
    minWidth: 18,
    padding: "1px 4px",
    background: "#050505",
    border: "1px solid #fff",
    color: "#fff",
    fontFamily: "Silkscreen, monospace",
    fontSize: 10,
    lineHeight: 1.2,
    textAlign: "center",
    textShadow: "1px 1px 0 #000",
    boxShadow: "0 0 0 1px rgba(179,255,0,0.9)",
};

function cardLabel(id) {
    return String(id || "avatar").replace(/_/g, " ").toUpperCase();
}

export default function AvatarCardSquare({
    nickname,
    avatarUrl,
    animId,
    spriteId,
    size = 64,
    testId = "avatar-card-square",
    className,
    style,
}) {
    const initials = avatarInitials(nickname);
    const card = useMemo(() => avatarCardAssetFor({ animId, spriteId }), [animId, spriteId]);
    const [uploadedFailed, setUploadedFailed] = useState(false);
    const [cardFailed, setCardFailed] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        setUploadedFailed(false);
    }, [avatarUrl]);

    useEffect(() => {
        setCardFailed(false);
        setModalOpen(false);
    }, [card?.id]);

    const showUploaded = Boolean(avatarUrl && !uploadedFailed);
    const showCard = Boolean(!showUploaded && card && !cardFailed);
    const canOpenCard = showCard && Boolean(card?.fullSrc);
    const squareSize = Number.isFinite(size) ? size : 64;

    const openCard = () => {
        if (canOpenCard) setModalOpen(true);
    };

    const closeCard = () => setModalOpen(false);

    return (
        <>
            <button
                type="button"
                className={className}
                data-testid={testId}
                data-card-id={showCard ? card.id : undefined}
                aria-disabled={canOpenCard ? "false" : "true"}
                aria-label={canOpenCard ? `open ${cardLabel(card.id)} card` : `${initials} avatar`}
                onClick={openCard}
                style={{
                    width: squareSize,
                    height: squareSize,
                    padding: 0,
                    border: "2px solid #000",
                    background: "#050716",
                    overflow: "hidden",
                    position: "relative",
                    display: "grid",
                    placeItems: "center",
                    cursor: canOpenCard ? "zoom-in" : "default",
                    imageRendering: "pixelated",
                    boxShadow: "inset -2px -2px #555, inset 2px 2px #fff",
                    boxSizing: "border-box",
                    ...style,
                }}
            >
                {showUploaded ? (
                    <img
                        src={avatarUrl}
                        alt={`${nickname || "user"} avatar`}
                        data-testid="avatar-card-uploaded"
                        onError={() => setUploadedFailed(true)}
                        style={{
                            width: "82%",
                            height: "82%",
                            objectFit: "contain",
                            display: "block",
                            imageRendering: "pixelated",
                        }}
                    />
                ) : showCard ? (
                    <img
                        src={card.squareSrc}
                        alt={`${cardLabel(card.id)} avatar card`}
                        data-testid="avatar-card-stock"
                        onError={() => setCardFailed(true)}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                        }}
                    />
                ) : (
                    <span
                        className="font-pixel"
                        data-testid="avatar-card-fallback"
                        style={{
                            color: "#fff",
                            fontSize: Math.max(12, Math.round(squareSize * 0.32)),
                            textShadow: "2px 2px 0 #000",
                        }}
                    >
                        {initials}
                    </span>
                )}
                <span data-testid="avatar-card-initials" aria-hidden style={CHIP_STYLE}>
                    {initials}
                </span>
            </button>

            {modalOpen && canOpenCard && (
                <div
                    data-testid="avatar-card-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`${cardLabel(card.id)} card`}
                    onClick={closeCard}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 100000,
                        background: "rgba(0,0,0,0.74)",
                        display: "grid",
                        placeItems: "center",
                        padding: 24,
                    }}
                >
                    <div
                        className="w95-bevel"
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            position: "relative",
                            maxWidth: "min(460px, 92vw)",
                            maxHeight: "92vh",
                            background: "#d4d0c8",
                            padding: 8,
                            boxShadow: "0 22px 70px rgba(0,0,0,0.72)",
                        }}
                    >
                        <div
                            className="font-pixel"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 10,
                                background: "#000080",
                                color: "#fff",
                                fontSize: 10,
                                padding: "3px 4px",
                                marginBottom: 6,
                            }}
                        >
                            <span>{cardLabel(card.id)} CARD</span>
                            <button
                                type="button"
                                className="w95-button"
                                onClick={closeCard}
                                aria-label="close avatar card"
                                style={{ minHeight: 18, padding: "0 6px", lineHeight: 1 }}
                            >
                                ×
                            </button>
                        </div>
                        <img
                            src={card.fullSrc}
                            alt={`${cardLabel(card.id)} card`}
                            onError={closeCard}
                            style={{
                                display: "block",
                                width: "100%",
                                maxHeight: "calc(92vh - 64px)",
                                objectFit: "contain",
                                background: "#050716",
                                border: "2px solid #000",
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
