// Enhanced Accordion components for playlist management with proper functionality
import React, { useState, createContext, useContext } from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown } from 'lucide-react';

interface AccordionContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextType | undefined>(undefined);

interface AccordionProps {
  children: React.ReactNode;
  type?: 'single' | 'multiple';
  collapsible?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export default function Accordion({ 
  children, 
  type: _type = 'single', 
  collapsible: _collapsible = true,
  value = '',
  onValueChange,
  className 
}: AccordionProps) {
  const [internalValue, setInternalValue] = useState<string>(value);
  
  const currentValue = value !== undefined ? value : internalValue;
  
  const handleValueChange = (newValue: string) => {
    if (onValueChange) {
      onValueChange(newValue);
    } else {
      setInternalValue(newValue);
    }
  };

  return (
    <AccordionContext.Provider value={{ value: currentValue, onValueChange: handleValueChange }}>
      <div className={cn('space-y-2', className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps {
  children: React.ReactNode;
  value: string;
  className?: string;
}

export function AccordionItem({ children, value: _value, className }: AccordionItemProps) {
  return (
    <div className={cn('border border-gray-700 rounded-lg bg-black', className)}>
      {children}
    </div>
  );
}

interface AccordionTriggerProps {
  children: React.ReactNode;
  className?: string;
  value?: string;
  disabled?: boolean;
}

export function AccordionTrigger({ children, className, value, disabled }: AccordionTriggerProps) {
  const context = useContext(AccordionContext);
  
  if (!context) {
    throw new Error('AccordionTrigger must be used within an Accordion');
  }

  const { value: currentValue, onValueChange } = context;
  
  const isOpen = currentValue === value;

  const handleClick = () => {
    if (isOpen) {
      onValueChange('');
    } else {
      onValueChange(value || '');
    }
  };

  return (
    <button 
      onClick={handleClick}
      disabled={disabled}
      className={cn('flex flex-1 items-center justify-between py-4 px-6 font-medium transition-all hover:bg-gray-800 text-white w-full border-b border-gray-700', className)}
    >
      <div className="flex items-center gap-2">
        {children}
      </div>
      <ChevronDown 
        className={cn(
          'h-4 w-4 shrink-0 transition-transform duration-200',
          isOpen && 'rotate-180'
        )}
        style={{ color: '#d1d5db' }}
      />
    </button>
  );
}

interface AccordionContentProps {
  children: React.ReactNode;
  className?: string;
  value?: string;
}

export function AccordionContent({ children, className, value }: AccordionContentProps) {
  const context = useContext(AccordionContext);
  
  if (!context) {
    throw new Error('AccordionContent must be used within an Accordion');
  }

  const { value: currentValue } = context;
  
  const isOpen = currentValue === value;

  return (
    <div 
      className={cn(
        'overflow-hidden text-sm transition-all duration-200',
        isOpen ? 'max-h-none opacity-100' : 'max-h-0 opacity-0'
      )}
    >
      <div className={cn('pb-8 pt-0', className)}>
        {isOpen && children}
      </div>
    </div>
  );
}
