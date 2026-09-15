import React, { useEffect, useRef, useState } from "react";
import "./HalloweenScene.css";

// Coordinates are percentages of the square artwork, independent of stage size.
const LANTERNS = [
    { x: 7.5, y: 49 },
    { x: 27.3, y: 30 },
    { x: 38.5, y: 29 },
    { x: 60.1, y: 30 },
    { x: 76, y: 35.7 },
    { x: 40.8, y: 65.2 },
    { x: 58.9, y: 65.2 },
];

const EMBERS = Array.from({ length: 14 }, (_, index) => ({
    x: 12 + ((index * 37) % 78),
    y: 42 + ((index * 17) % 47),
    delay: -(index * 1.7),
    duration: 7 + (index % 5),
}));

const SECRETS = [
    {
        id: "clock", label: "Listen to the crooked clock",
        x: 32.5, y: 17.2, width: 5.5, height: 6,
        messages: ["MIDNIGHT. AGAIN.", "THE THIRTEENTH HOUR", "TIME IS A LITTLE CROOKED"],
    },
    {
        id: "market", label: "Wake the pumpkin at the market",
        x: 12, y: 45.8, width: 5, height: 5,
        messages: ["BOO. NICE TO SEE YOU.", "ALL TREATS. SOME TRICKS.", "ONE CANDLE, TWO WISHES"],
    },
    {
        id: "gate", label: "Wake the pumpkin by the gate",
        x: 81.8, y: 45.8, width: 5.5, height: 5,
        messages: ["THE GATE KNOWS YOUR GRIN", "STAY STRANGE, LITTLE GHOST", "EVERY NIGHT IS HALLOWEEN"],
    },
];

export default function HalloweenScene() {
    const [reaction, setReaction] = useState(null);
    const visits = useRef({});

    useEffect(() => {
        if (!reaction) return undefined;
        const timer = setTimeout(() => setReaction(null), 2800);
        return () => clearTimeout(timer);
    }, [reaction]);

    const wakeSecret = (event, secret) => {
        event.stopPropagation();
        const visit = visits.current[secret.id] || 0;
        visits.current[secret.id] = visit + 1;
        setReaction({ ...secret, text: secret.messages[visit % secret.messages.length] });
    };

    return (
        <div className="halloween-scene" data-testid="halloween-scene" data-awake={Boolean(reaction)}>
            <div aria-hidden="true" className="halloween-atmosphere">
                {LANTERNS.map((lantern, index) => (
                    <span
                        key={index}
                        className="halloween-lantern-glow"
                        style={{ left: `${lantern.x}%`, top: `${lantern.y}%`, animationDelay: `${-index * 0.63}s` }}
                    />
                ))}
                {EMBERS.map((ember, index) => (
                    <span
                        key={index}
                        className="halloween-ember"
                        style={{ left: `${ember.x}%`, top: `${ember.y}%`, animationDelay: `${ember.delay}s`, animationDuration: `${ember.duration}s` }}
                    />
                ))}
            </div>
            {SECRETS.map((secret) => (
                <button
                    key={secret.id}
                    type="button"
                    className="halloween-secret"
                    data-testid={`halloween-secret-${secret.id}`}
                    aria-label={secret.label}
                    title={secret.label}
                    style={{ left: `${secret.x}%`, top: `${secret.y}%`, width: `${secret.width}%`, height: `${secret.height}%` }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onTouchStart={(event) => event.stopPropagation()}
                    onClick={(event) => wakeSecret(event, secret)}
                />
            ))}
            <div className="halloween-whisper-region" role="status" aria-live="polite" aria-atomic="true">
                {reaction && (
                    <span
                        className="halloween-whisper font-pixel"
                        data-testid="halloween-whisper"
                        style={{ left: `${Math.max(23, Math.min(77, reaction.x))}%`, top: `${reaction.y - 7}%` }}
                    >
                        {reaction.text}
                    </span>
                )}
            </div>
        </div>
    );
}
