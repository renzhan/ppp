'use client';

import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      ref={ref}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'peer inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-brand bg-brand text-white' : 'border-gray-300 bg-white',
        className
      )}
      {...props}
    >
      {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
    </button>
  )
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
