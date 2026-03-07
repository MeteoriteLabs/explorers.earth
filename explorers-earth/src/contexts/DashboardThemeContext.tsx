import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type ThemeMode = 'light' | 'dark';

interface DashboardThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
}

export const DashboardThemeContext = createContext<DashboardThemeContextType | undefined>(undefined);

interface DashboardThemeProviderProps {
  children: ReactNode;
}

export const DashboardThemeProvider = ({ children }: DashboardThemeProviderProps) => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    // Check localStorage first
    const saved = localStorage.getItem('dashboard-theme') as ThemeMode | null;
    if (saved === 'light' || saved === 'dark') {
      // Apply immediately to prevent flash
      const root = document.documentElement;
      if (saved === 'dark') {
        root.classList.add('dashboard-theme-dark');
      } else {
        root.classList.remove('dashboard-theme-dark');
      }
      return saved;
    }
    // Default to dark mode when no saved preference exists (e.g., on first login)
    const root = document.documentElement;
    root.classList.add('dashboard-theme-dark');
    return 'dark';
  });

  useEffect(() => {
    // Apply theme class to document
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dashboard-theme-dark');
    } else {
      root.classList.remove('dashboard-theme-dark');
    }
    
    // Store in localStorage
    localStorage.setItem('dashboard-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <DashboardThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </DashboardThemeContext.Provider>
  );
};

export const useDashboardTheme = () => {
  const context = useContext(DashboardThemeContext);
  if (context === undefined) {
    throw new Error('useDashboardTheme must be used within a DashboardThemeProvider');
  }
  return context;
};

