// Theme provider hook for dynamic theming
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface ThemeContextType {
  theme: string;
  updateTheme: (color: string) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [theme, setTheme] = useState<string>('#3b82f6'); // Default blue

  const updateTheme = (color: string) => {
    setTheme(color);
    
    // Update CSS custom properties
    const root = document.documentElement;
    root.style.setProperty('--primary', color);
    root.style.setProperty('--primary-foreground', getContrastColor(color));
    
    // Store in localStorage
    localStorage.setItem('theme-color', color);
  };

  const resetTheme = () => {
    const defaultColor = '#3b82f6';
    setTheme(defaultColor);
    
    const root = document.documentElement;
    root.style.setProperty('--primary', defaultColor);
    root.style.setProperty('--primary-foreground', getContrastColor(defaultColor));
    
    localStorage.removeItem('theme-color');
  };

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-color');
    if (savedTheme) {
      updateTheme(savedTheme);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Helper function to get contrast color (black or white)
const getContrastColor = (hexColor: string): string => {
  // Remove # if present
  const color = hexColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#ffffff';
};
