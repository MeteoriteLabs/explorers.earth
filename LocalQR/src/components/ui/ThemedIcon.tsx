import { ReactNode } from "react";

interface ThemedIconProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "accent" | "muted";
  className?: string;
}

/**
 * ThemedIcon component that applies centralized dashboard theme colors to icons
 * Usage: <ThemedIcon variant="primary"><SomeIcon /></ThemedIcon>
 */
export const ThemedIcon = ({ 
  children, 
  variant = "primary", 
  className = "" 
}: ThemedIconProps) => {
  const variantClass = `icon-${variant}`;
  
  return (
    <span className={`white-theme ${variantClass} ${className}`}>
      {children}
    </span>
  );
};

export default ThemedIcon;
