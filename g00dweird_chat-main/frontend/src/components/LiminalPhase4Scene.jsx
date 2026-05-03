import React from "react";

export default function LiminalPhase4Scene() {
    return (
        <div
            className="absolute inset-0 pointer-events-none liminal-phase4-scene"
            data-testid="liminal-phase4-scene"
            aria-hidden
        >
            <style>{`
                @keyframes liminal-phase4-hum {
                    0%, 100% { opacity: 0.2; }
                    42% { opacity: 0.34; }
                    45% { opacity: 0.12; }
                    48% { opacity: 0.3; }
                }
                @keyframes liminal-phase4-scan {
                    from { transform: translateY(-18%); }
                    to { transform: translateY(118%); }
                }
                @keyframes liminal-phase4-slip {
                    0%, 89%, 100% { opacity: 0; transform: translate3d(0,0,0); }
                    90% { opacity: 0.16; transform: translate3d(-6px,2px,0); }
                    92% { opacity: 0.05; transform: translate3d(4px,-1px,0); }
                }
                .liminal-phase4-scene {
                    z-index: 7;
                    mix-blend-mode: screen;
                    image-rendering: pixelated;
                }
            `}</style>

            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background:
                        "radial-gradient(circle at 50% 42%, rgba(255,245,175,0.12), rgba(0,0,0,0) 42%), " +
                        "linear-gradient(90deg, rgba(255,255,210,0.05), rgba(0,0,0,0) 22%, rgba(255,255,210,0.05) 78%, rgba(0,0,0,0))",
                    animation: "liminal-phase4-hum 13s steps(3, end) infinite",
                }}
            />
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "-18%",
                    height: "18%",
                    background: "linear-gradient(180deg, rgba(255,255,210,0), rgba(255,255,210,0.1), rgba(255,255,210,0))",
                    animation: "liminal-phase4-scan 19s linear infinite",
                    opacity: 0.7,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    inset: "14% 18% 22% 16%",
                    border: "1px solid rgba(255,255,210,0.12)",
                    boxShadow: "0 0 18px rgba(255,245,160,0.1)",
                    animation: "liminal-phase4-slip 41s linear infinite",
                }}
            />
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background:
                        "repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, rgba(0,0,0,0) 1px 5px)",
                    opacity: 0.34,
                }}
            />
        </div>
    );
}
