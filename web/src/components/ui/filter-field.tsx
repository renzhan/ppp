import * as React from 'react';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export interface FilterFieldProps {
  label: string;
  htmlFor?: string;
  className?: string;
  labelClassName?: string;
  children: React.ReactNode;
}

export function FilterField({
  label,
  htmlFor,
  className,
  labelClassName,
  children,
}: FilterFieldProps) {
  return (
    <div className={cn('flex min-w-0 items-center', className)}>
      <Label
        htmlFor={htmlFor}
        className={cn('mr-2 shrink-0 text-sm font-normal text-gray-700', labelClassName)}
      >
        {label}
      </Label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
