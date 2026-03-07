import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

interface ThemeContextType {
  primary: string;
  updateTheme?: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({ primary: '#6E56CF' });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const isLandingPage = location === "/";
  const isAuthPage = location === "/auth";

  // Always use default theme for landing and auth pages
  const shouldUseDefaultTheme = isLandingPage || isAuthPage;
  const defaultTheme = '#6E56CF';

  const themeRef = useRef<string>(
    shouldUseDefaultTheme ? defaultTheme : (user?.theme?.primary || defaultTheme)
  );

  const [currentTheme, setCurrentTheme] = useState<ThemeContextType>({ 
    primary: themeRef.current,
    updateTheme: (color: string) => {
      if (shouldUseDefaultTheme) return; // Don't update theme on landing/auth pages

      console.log('Theme Provider updating to:', color);
      themeRef.current = color;

      // Update state to trigger re-render
      setCurrentTheme(prev => ({ ...prev, primary: color }));

      // Update DOM immediately
      requestAnimationFrame(() => {
        updateTailwindTheme(color);
      });
    }
  });

  // Update theme when user settings change
  useEffect(() => {
    const newTheme = shouldUseDefaultTheme ? defaultTheme : (user?.theme?.primary || defaultTheme);
    if (newTheme !== themeRef.current) {
      console.log('Theme Provider syncing with user settings:', newTheme);
      themeRef.current = newTheme;
      setCurrentTheme(prev => ({ ...prev, primary: newTheme }));
      requestAnimationFrame(() => {
        updateTailwindTheme(newTheme);
      });
    }
  }, [shouldUseDefaultTheme, user?.theme?.primary]);

  // Utility function to convert hex to HSL and update Tailwind theme
  const updateTailwindTheme = (hex: string) => {
    console.log('Updating Tailwind theme with color:', hex);

    const hexToHSL = (hex: string) => {
      hex = hex.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0;
      let s = 0;
      const l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
        }
        h /= 6;
      }

      return [
        Math.round(h * 360),
        Math.round(s * 100),
        Math.round(l * 100),
      ];
    };

    const [h, s, l] = hexToHSL(hex);

    // Update CSS variables immediately in a microtask
    queueMicrotask(() => {
      const root = document.documentElement;
      root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
      root.style.setProperty('--primary-foreground', l > 60 ? '0 0% 0%' : '0 0% 100%');
    });
  };

  // Initial theme setup
  useEffect(() => {
    updateTailwindTheme(themeRef.current);
  }, []);

  return (
    <ThemeContext.Provider value={currentTheme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}