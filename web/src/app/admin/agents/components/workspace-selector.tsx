'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  isEnabled: boolean;
}

export interface WorkspaceSelectorProps {
  /** 当前选中的工作区 ID，空字符串表示"公共" */
  value: string;
  /** 选中工作区变化时的回调 */
  onChange: (workspaceId: string) => void;
  /** 是否显示"公共"选项，默认 true */
  includePublic?: boolean;
  /** 可选的标签文字 */
  label?: string;
  /** 是否必填 */
  required?: boolean;
  /** 错误信息 */
  error?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

// ─── API helper ──────────────────────────────────────────────────────────────

async function fetchWorkspaces(): Promise<Workspace[]> {
  const res = await fetch('/api/agent-mgmt/workspaces');
  if (!res.ok) throw new Error('Failed to fetch workspaces');
  return res.json();
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WorkspaceSelector({
  value,
  onChange,
  includePublic = true,
  label,
  required,
  error,
  disabled,
}: WorkspaceSelectorProps) {
  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: fetchWorkspaces,
  });

  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || isLoading}
          className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-brand focus:ring-brand'
          } ${disabled || isLoading ? 'cursor-not-allowed bg-gray-50 text-gray-500' : ''}`}
          aria-invalid={!!error}
          aria-describedby={error ? 'workspace-selector-error' : undefined}
        >
          {includePublic && <option value="">公共</option>}
          {!includePublic && <option value="">请选择工作区</option>}
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </select>
        {isLoading && (
          <div className="pointer-events-none absolute inset-y-0 right-8 flex items-center">
            <Loader2 size={14} className="animate-spin text-gray-400" />
          </div>
        )}
      </div>
      {error && (
        <p id="workspace-selector-error" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
