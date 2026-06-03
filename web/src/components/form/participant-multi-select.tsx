'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ParticipantUser {
  id: string;
  username: string;
  displayName: string | null;
  role?: string;
}

interface ParticipantMultiSelectProps {
  users: ParticipantUser[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function ParticipantMultiSelect({
  users,
  value,
  onChange,
  placeholder = '请选择',
}: ParticipantMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDisplayName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.displayName || user?.username || userId;
  };

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (u.displayName || '').toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    );
  });

  const toggle = (userId: string) => {
    onChange(
      value.includes(userId) ? value.filter((id) => id !== userId) : [...value, userId]
    );
  };

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setOpen(!open);
        }}
        className={cn(
          'flex min-h-9 w-full cursor-pointer flex-wrap items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1.5 text-sm transition',
          'hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25'
        )}
      >
        {value.length === 0 && <span className="text-gray-400">{placeholder}</span>}
        {value.map((userId) => (
          <Badge key={userId} variant="default" className="gap-1 pr-1">
            {getDisplayName(userId)}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((id) => id !== userId));
              }}
              className="rounded-full p-0.5 hover:bg-brand-100"
              aria-label={`移除 ${getDisplayName(userId)}`}
            >
              <X size={12} />
            </button>
          </Badge>
        ))}
        <ChevronDown size={16} className="ml-auto shrink-0 text-gray-400" />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b p-2">
            <Input
              variant="filter"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索姓名..."
              className="h-8"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">无匹配用户</div>
            ) : (
              filtered.map((user) => {
                const selected = value.includes(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggle(user.id)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition',
                      selected ? 'bg-brand-50 text-brand' : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded border text-[10px]',
                        selected ? 'border-brand bg-brand text-white' : 'border-gray-300'
                      )}
                    >
                      {selected ? '✓' : ''}
                    </span>
                    <span>{user.displayName || user.username}</span>
                    {user.role && user.role !== 'admin' && (
                      <span className="ml-auto text-xs text-gray-400">{user.role}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
