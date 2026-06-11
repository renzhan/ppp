'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

type RadioGroupContextValue = {
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
};

const RadioGroupContext = React.createContext<RadioGroupContextValue>({
  name: '',
});

export interface RadioGroupProps {
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

function RadioGroup({
  name,
  value,
  onValueChange,
  disabled,
  className,
  children,
}: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ name, value, onValueChange, disabled }}>
      <div role="radiogroup" className={cn('flex flex-wrap items-center gap-4', className)}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioGroupItemProps {
  value: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

function RadioGroupItem({
  value,
  id,
  disabled,
  className,
  children,
}: RadioGroupItemProps) {
  const ctx = React.useContext(RadioGroupContext);
  const itemId = id ?? `${ctx.name}-${value}`;
  const isDisabled = disabled || ctx.disabled;
  const checked = ctx.value === value;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        type="radio"
        id={itemId}
        name={ctx.name}
        value={value}
        checked={checked}
        disabled={isDisabled}
        onChange={() => ctx.onValueChange?.(value)}
        className="h-4 w-4 border-gray-300 text-brand focus:ring-brand/50 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <Label
        htmlFor={itemId}
        className={cn(
          'cursor-pointer font-normal text-gray-700',
          isDisabled && 'cursor-not-allowed opacity-50'
        )}
      >
        {children}
      </Label>
    </div>
  );
}

export { RadioGroup, RadioGroupItem };
