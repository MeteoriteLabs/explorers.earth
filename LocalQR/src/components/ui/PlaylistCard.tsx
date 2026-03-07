// PlaylistCard components for playlist management
import React from 'react';
import { cn } from '../../lib/utils';

interface PlaylistCardProps {
  children: React.ReactNode;
  className?: string;
}

export default function PlaylistCard({ children, className }: PlaylistCardProps) {
  return (
    <div className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}>
      {children}
    </div>
  );
}

export function PlaylistCardHeader({ children, className }: PlaylistCardProps) {
  return (
    <div className={cn('flex flex-col space-y-1.5 p-6', className)}>
      {children}
    </div>
  );
}

export function PlaylistCardTitle({ children, className }: PlaylistCardProps) {
  return (
    <h3 className={cn('text-2xl font-semibold leading-none tracking-tight', className)}>
      {children}
    </h3>
  );
}

export function PlaylistCardDescription({ children, className }: PlaylistCardProps) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      {children}
    </p>
  );
}

export function PlaylistCardContent({ children, className }: PlaylistCardProps) {
  return (
    <div className={cn('p-6 pt-0', className)}>
      {children}
    </div>
  );
}
