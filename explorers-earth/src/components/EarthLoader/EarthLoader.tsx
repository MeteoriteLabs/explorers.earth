import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { getShuffledTexts, type LoaderContext } from "./loaderTexts";
import "./EarthLoader.css";

// Plane image for the rotating animation
const PLANE_GIF_URL = "https://zupimages.net/up/19/34/4820.gif";
const TEXT_INTERVAL_MS = 3200; // How long each text is visible

type EarthLoaderSize = "default" | "small" | "tiny";

interface EarthLoaderProps {
    /** Context determines which set of supporting texts to show */
    context?: LoaderContext;
    /** Override background colour — defaults to transparent so parent controls it */
    bgColor?: string;
    /** Size variant: default (full-page), small (section), tiny (inline) */
    size?: EarthLoaderSize;
    /** Extra CSS class names for the wrapper */
    className?: string;
    /** Whether to show the supporting text carousel */
    showText?: boolean;
    /** Optional status message that overrides the rotating text */
    statusMessage?: string;
}

const EarthLoader: React.FC<EarthLoaderProps> = memo(
    ({
        context = "general",
        bgColor,
        size = "default",
        className = "",
        showText = true,
        statusMessage,
    }) => {
        // Shuffle texts once on mount so repeat loads feel fresh
        const texts = useMemo(() => getShuffledTexts(context), [context]);

        const [currentIndex, setCurrentIndex] = useState(0);
        const [textState, setTextState] = useState<
            "entering" | "active" | "exiting"
        >("entering");

        // Text carousel cycle
        const cycle = useCallback(() => {
            // Exit current
            setTextState("exiting");

            // After exit animation, swap text and enter new one
            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % texts.length);
                setTextState("entering");

                // Trigger active state on next frame
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        setTextState("active");
                    });
                });
            }, 400); // Must match the CSS exit transition duration
        }, [texts.length]);

        // Initial entry
        useEffect(() => {
            // Trigger the first text to animate in
            const entryTimer = requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setTextState("active");
                });
            });

            return () => cancelAnimationFrame(entryTimer);
        }, []);

        // Interval
        useEffect(() => {
            if (!showText && !statusMessage) return;
            const interval = setInterval(cycle, TEXT_INTERVAL_MS);
            return () => clearInterval(interval);
        }, [cycle, showText, statusMessage]);

        const sizeClass =
            size === "small"
                ? "earth-loader-wrapper--small"
                : size === "tiny"
                    ? "earth-loader-wrapper--tiny"
                    : "";

        const displayText = statusMessage || texts[currentIndex];

        return (
            <div
                className={`earth-loader-wrapper ${sizeClass} ${className}`}
                style={bgColor ? { backgroundColor: bgColor } : undefined}
            >
                {/* Globe + Plane animation */}
                <div className="earth-loader">
                    {/* Rotating plane */}
                    <div className="earth-loader__plane">
                        <img
                            src={PLANE_GIF_URL}
                            className="earth-loader__plane-img"
                            alt=""
                            aria-hidden="true"
                        />
                    </div>

                    {/* Spinning earth */}
                    <div className="earth-loader__earth-wrapper">
                        <div className="earth-loader__earth" />
                    </div>
                </div>

                {/* Rotating supporting text */}
                {(showText || statusMessage) && (
                    <div className="earth-loader__text-area" aria-live="polite">
                        <span
                            className={`earth-loader__text earth-loader__text--${textState}`}
                            key={currentIndex}
                        >
                            {displayText}
                        </span>
                    </div>
                )}
            </div>
        );
    }
);

EarthLoader.displayName = "EarthLoader";

export default EarthLoader;
export type { EarthLoaderProps, EarthLoaderSize };
