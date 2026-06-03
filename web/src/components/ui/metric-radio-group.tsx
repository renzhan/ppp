'use client';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export interface MetricRadioOption<T extends string = string> {
  value: T;
  label: string;
}

export interface MetricRadioGroupProps<T extends string = string> {
  title: string;
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: MetricRadioOption<T>[];
  className?: string;
}

export function MetricRadioGroup<T extends string>({
  title,
  name,
  value,
  onChange,
  options,
  className,
}: MetricRadioGroupProps<T>) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-gray-200', className)}>
      <div className="border-b border-gray-100 bg-gray-50 px-3 py-2.5">
        <span className="text-sm text-gray-700">{title}</span>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 bg-white px-3 py-3">
        {options.map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="h-4 w-4 border-gray-300 text-brand focus:ring-brand/30"
            />
            <Label className="cursor-pointer text-sm font-normal text-gray-700">{opt.label}</Label>
          </label>
        ))}
      </div>
    </div>
  );
}
