import * as React from 'react';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  className?: string;
  labelClassName?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  className,
  labelClassName,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className={cn('font-normal text-gray-500', labelClassName)}>
        {label}
      </Label>
      {children}
    </div>
  );
}
