'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

type SelectContextValue = {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
};

const SelectContext = React.createContext<SelectContextValue>({});

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

function Select({ value, onValueChange, disabled, className, children }: SelectProps) {
  let triggerClassName: string | undefined;
  const options: { value: string; label: React.ReactNode; disabled?: boolean }[] = [];

  const getDisplayName = (type: React.ReactElement['type']) =>
    (type as { displayName?: string } | undefined)?.displayName;

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;

    if (getDisplayName(child.type) === 'SelectTrigger') {
      triggerClassName = child.props.className;
    }

    if (getDisplayName(child.type) === 'SelectContent') {
      React.Children.forEach(child.props.children, (item) => {
        if (React.isValidElement(item) && getDisplayName(item.type) === 'SelectItem') {
          options.push({
            value: item.props.value,
            label: item.props.children,
            disabled: item.props.disabled,
          });
        }
      });
    }
  });

  return (
    <SelectContext.Provider value={{ value, onValueChange, disabled }}>
      <div className={cn('relative min-w-0 flex-1', className)}>
        <select
          value={value ?? ''}
          onChange={(e) => onValueChange?.(e.target.value)}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full appearance-none rounded-md border border-input bg-background py-2 pl-3 pr-8 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            triggerClassName
          )}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>
    </SelectContext.Provider>
  );
}

const SelectTrigger = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<'select'> & { className?: string }
>(({ className }, _ref) => {
  return <span data-select-trigger className={className} />;
});
SelectTrigger.displayName = 'SelectTrigger';

function SelectValue({ placeholder: _placeholder }: { placeholder?: string }) {
  return null;
}
SelectValue.displayName = 'SelectValue';

function SelectContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
SelectContent.displayName = 'SelectContent';

interface SelectItemProps {
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
}

function SelectItem(_props: SelectItemProps) {
  return null;
}
SelectItem.displayName = 'SelectItem';

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
