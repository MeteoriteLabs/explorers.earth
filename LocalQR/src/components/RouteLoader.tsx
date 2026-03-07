import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import EarthLoader from "./EarthLoader/EarthLoader";

// How long (ms) the loader is shown after a route change
const LOADER_DURATION_MS = 600;

const RouteLoader = () => {
    const { pathname } = useLocation();
    const [isLoading, setIsLoading] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track the previous pathname so we only show loader on actual changes
    const prevPathnameRef = useRef(pathname);

    useEffect(() => {
        // Skip the very first render (initial page load handles its own loading)
        if (prevPathnameRef.current === pathname) return;

        prevPathnameRef.current = pathname;

        // Show the loader immediately
        setIsLoading(true);

        // Clear any existing timer
        if (timerRef.current) clearTimeout(timerRef.current);

        // Hide after LOADER_DURATION_MS
        timerRef.current = setTimeout(() => {
            setIsLoading(false);
        }, LOADER_DURATION_MS);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [pathname]);

    if (!isLoading) return null;

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                zIndex: 50,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
            className="bg-dashboard-bg"
        >
            <EarthLoader size="small" showText={false} />
        </div>
    );
};

export default RouteLoader;
