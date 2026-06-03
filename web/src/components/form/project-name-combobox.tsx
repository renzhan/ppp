'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export interface ProjectOption {
  id: string;
  projectName: string;
  category?: string;
  brand?: string;
}

export interface ProjectNameComboboxProps {
  projects: ProjectOption[];
  selectedId: string;
  displayValue: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  onClearSelection?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ProjectNameCombobox({
  projects,
  selectedId,
  displayValue,
  searchValue,
  onSearchChange,
  onSelect,
  onClearSelection,
  placeholder = '请选择或搜索项目名称',
  disabled,
}: ProjectNameComboboxProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const inputValue = selectedId ? displayValue : searchValue;
  const list = projects.slice(0, 20);

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400"
        />
        <Input
          variant="filter"
          disabled={disabled}
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => {
            onSearchChange(e.target.value);
            if (selectedId) onClearSelection?.();
            setOpen(true);
          }}
          onFocus={() => {
            if (selectedId) {
              onClearSelection?.();
              onSearchChange(displayValue);
            }
            setOpen(true);
          }}
          className="h-9 rounded-md border-gray-200 pl-9 pr-9"
        />
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
      </div>
      {open && list.length > 0 && !disabled && (
        <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-md">
          {list.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p.id);
                  setOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-2.5 text-left text-sm transition-colors',
                  selectedId === p.id
                    ? 'bg-brand-50 text-gray-900'
                    : 'text-gray-800 hover:bg-brand-50/80'
                )}
              >
                <span className="font-medium">{p.projectName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
