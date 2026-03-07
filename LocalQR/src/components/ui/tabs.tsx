// Simple Tabs components for playlist management
import React, { useState } from 'react';
import { cn } from '../../lib/utils';

interface TabsProps {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export default function Tabs({ 
  children, 
  defaultValue, 
  value, 
  onValueChange,
  className 
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue || '');
  const currentValue = value || activeTab;

  const handleTabChange = (newValue: string) => {
    if (!value) {
      setActiveTab(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <div className={cn('w-full', className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { 
            activeValue: currentValue,
            onValueChange: handleTabChange
          } as any);
        }
        return child;
      })}
    </div>
  );
}

interface TabsListProps {
  children: React.ReactNode;
  activeValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function TabsList({ children, activeValue, onValueChange, className }: TabsListProps) {
  return (
    <div className={cn('inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground', className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { 
            activeValue,
            onValueChange,
            ...child.props
          } as any);
        }
        return child;
      })}
    </div>
  );
}

interface TabsTriggerProps {
  children: React.ReactNode;
  value: string;
  activeValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function TabsTrigger({ 
  children, 
  value, 
  activeValue, 
  onValueChange,
  className 
}: TabsTriggerProps) {
  const isActive = activeValue === value;

  return (
    <button
      onClick={() => onValueChange?.(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isActive ? 'bg-background text-foreground shadow-sm' : 'hover:bg-background/50',
        className
      )}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  children: React.ReactNode;
  value: string;
  activeValue?: string;
  className?: string;
}

export function TabsContent({ 
  children, 
  value, 
  activeValue,
  className 
}: TabsContentProps) {
  const isActive = activeValue === value;

  if (!isActive) return null;

  return (
    <div className={cn('mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', className)}>
      {children}
    </div>
  );
}
