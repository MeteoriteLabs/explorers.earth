// Slider component
import React from 'react';
import { cn } from '../../lib/utils';

interface SliderProps {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  max?: number;
  min?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

export default function Slider({
  value,
  defaultValue = [0],
  onValueChange,
  max = 100,
  min = 0,
  step = 1,
  className,
  disabled = false,
}: SliderProps) {
  const [internalValue, setInternalValue] = React.useState(value || defaultValue);
  const currentValue = value || internalValue;

  const handleChange = (newValue: number[]) => {
    if (!disabled) {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    }
  };

  const percentage = ((currentValue[0] - min) / (max - min)) * 100;

  return (
    <div className={cn('relative flex w-full touch-none select-none items-center py-2', className)}>
      <div className="relative h-2 w-full grow rounded-full bg-gray-600">
        <div
          className="absolute h-full bg-blue-500 transition-all rounded-full"
          style={{ width: `${percentage}%` }}
        />
        <div
          className="absolute h-5 w-5 bg-blue-500 rounded-full border border-gray-400 shadow-lg transform -translate-y-1.5 transition-all"
          style={{ left: `calc(${percentage}% - 10px)` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue[0]}
        onChange={(e) => handleChange([Number(e.target.value)])}
        disabled={disabled}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
      />
    </div>
  );
}
