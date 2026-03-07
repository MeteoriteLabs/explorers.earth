import { cn } from "@/lib/utils";
import React from "react";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: "small" | "medium" | "large" | "full";
}

export function Container({ 
  children, 
  className, 
  size = "medium" 
}: ContainerProps) {
  const sizeClasses = {
    small: "max-w-3xl",
    medium: "max-w-5xl",
    large: "max-w-7xl",
    full: "max-w-full",
  };

  return (
    <div className={cn("mx-auto px-4 sm:px-6 lg:px-8 py-8", sizeClasses[size], className)}>
      {children}
    </div>
  );
}

export default Container;