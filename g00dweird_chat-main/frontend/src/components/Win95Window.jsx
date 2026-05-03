import React, { useRef, useEffect, useState, useCallback } from "react";

let Z = 10;

function useIsMobile(breakpoint = 640) {
    const [m, setM] = useState(
        typeof window !== "undefined" && window.innerWidth < breakpoint
    );
    useEffect(() => {
        const on = () => setM(window.innerWidth < breakpoint);
        window.addEventListener("resize", on);
        return () => window.removeEventListener("resize", on);
    }, [breakpoint]);
    return m;
}

export default function Win95Window({
    title,
    icon,
    children,
    initialX = 60,
    initialY = 60,
    width = 520,
    height,
    onClose,
    onMinimize,
    active = true,
    onFocus,
    requestFocus = 0,
    testId,
    className = "",
    resizable = false,
    minWidth = 320,
    minHeight = 240,
}) {
    const mobile = useIsMobile();
    const [pos, setPos] = useState({ x: initialX, y: initialY });
    const [size, setSize] = useState({ w: width, h: height });
    const [z, setZ] = useState(() => ++Z);
    const dragCleanupRef = useRef(null);
    const resizeCleanupRef = useRef(null);
    const userSizedRef = useRef(false);
    const lastFocusRef = useRef(0);

    useEffect(() => {
        if (userSizedRef.current || mobile) return;
        setPos({ x: initialX, y: initialY });
        setSize({ w: width, h: height });
    }, [height, initialX, initialY, mobile, width]);

    // External focus request (e.g. user clicked the desktop icon for a window
    // that's already open behind another). Bumps z-index synchronously during
    // render so the new value is in the DOM on the very next paint, not after
    // an extra effect-driven re-render. Guarded by `lastFocusRef` to avoid
    // looping.
    if (requestFocus > 0 && requestFocus !== lastFocusRef.current) {
        lastFocusRef.current = requestFocus;
        Z += 1;
        // Defer the actual setState to keep React happy (no setState during
        // another component's render); useEffect below picks it up.
    }

    const bringToFront = useCallback(() => {
        Z += 1;
        setZ(Z);
        if (onFocus) onFocus();
    }, [onFocus]);

    const stopDrag = useCallback(() => {
        if (!dragCleanupRef.current) return;
        dragCleanupRef.current();
        dragCleanupRef.current = null;
    }, []);

    const stopResize = useCallback(() => {
        if (!resizeCleanupRef.current) return;
        resizeCleanupRef.current();
        resizeCleanupRef.current = null;
    }, []);

    useEffect(() => () => {
        stopDrag();
        stopResize();
    }, [stopDrag, stopResize]);

    useEffect(() => {
        if (requestFocus > 0) {
            // Always raise to the global top when a focus is requested.
            Z += 1;
            setZ(Z);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestFocus]);

    const onHeaderMouseDown = (e) => {
        if (mobile) return;
        if (e.target.closest(".w95-title-btn")) return;
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        stopDrag();
        const offset = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        bringToFront();
        const move = (e) => {
            if (e.buttons !== undefined && e.buttons !== 1) {
                stopDrag();
                return;
            }
            const nx = Math.max(0, Math.min(window.innerWidth - 120, e.clientX - offset.x));
            const ny = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - offset.y));
            setPos({ x: nx, y: ny });
        };
        const up = () => stopDrag();
        const cleanup = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
            window.removeEventListener("blur", up);
        };
        dragCleanupRef.current = cleanup;
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
        window.addEventListener("blur", up);
    };

    const onResizeMouseDown = (e) => {
        if (!resizable || mobile) return;
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        bringToFront();
        userSizedRef.current = true;
        stopResize();
        const resizeStart = {
            x: e.clientX,
            y: e.clientY,
            w: size.w,
            h: size.h,
        };
        const move = (e) => {
            if (e.buttons !== undefined && e.buttons !== 1) {
                stopResize();
                return;
            }
            const maxW = Math.max(minWidth, window.innerWidth - pos.x - 8);
            const maxH = Math.max(minHeight, window.innerHeight - pos.y - 42);
            setSize({
                w: Math.max(minWidth, Math.min(maxW, resizeStart.w + e.clientX - resizeStart.x)),
                h: Math.max(minHeight, Math.min(maxH, resizeStart.h + e.clientY - resizeStart.y)),
            });
        };
        const up = () => stopResize();
        const cleanup = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
            window.removeEventListener("blur", up);
        };
        resizeCleanupRef.current = cleanup;
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
        window.addEventListener("blur", up);
    };

    const mobileStyle = {
        left: 0,
        top: 0,
        right: 0,
        bottom: 34,
        width: "100vw",
        height: "calc(100dvh - 34px)",
        zIndex: z,
        padding: 2,
    };
    const desktopStyle = {
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex: z,
        padding: 2,
    };

    return (
        <div
            data-testid={testId}
            className={`absolute w95-bevel ${className}`}
            style={mobile ? mobileStyle : desktopStyle}
            onMouseDown={bringToFront}
        >
            <div
                className={`w95-titlebar ${active ? "" : "inactive"}`}
                onMouseDown={onHeaderMouseDown}
                data-testid={testId ? `${testId}-titlebar` : undefined}
                style={{ cursor: mobile ? "default" : "move" }}
            >
                <span className="flex items-center gap-1 truncate">
                    {icon && <span className="mr-1">{icon}</span>}
                    <span className="truncate">{title}</span>
                </span>
                <span className="flex items-center">
                    {onMinimize && (
                        <button
                            type="button"
                            className="w95-title-btn"
                            onClick={(e) => { e.stopPropagation(); onMinimize(); }}
                            data-testid={testId ? `${testId}-minimize` : undefined}
                            title="Minimize"
                        >
                            _
                        </button>
                    )}
                    {onClose && (
                        <button
                            type="button"
                            className="w95-title-btn"
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            data-testid={testId ? `${testId}-close` : undefined}
                            title="Close"
                        >
                            x
                        </button>
                    )}
                </span>
            </div>
            <div
                className="w95-window-body"
                style={{
                    height: mobile
                        ? "calc(100dvh - 34px - 26px)"
                        : size.h ? size.h - 24 : undefined,
                    overflow: "hidden",
                }}
            >
                {children}
            </div>
            {resizable && !mobile && (
                <div
                    data-testid={testId ? `${testId}-window-resize` : undefined}
                    title="resize window"
                    onMouseDown={onResizeMouseDown}
                    style={{
                        position: "absolute",
                        right: 3,
                        bottom: 3,
                        width: 16,
                        height: 16,
                        cursor: "nwse-resize",
                        zIndex: 2,
                        background:
                            "repeating-linear-gradient(135deg, transparent 0 3px, #808080 3px 4px, #fff 4px 5px)",
                    }}
                />
            )}
        </div>
    );
}
