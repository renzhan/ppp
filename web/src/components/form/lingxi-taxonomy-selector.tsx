'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Loader2, Search, ChevronRight, Check } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TaxonomyNode {
  name: string;
  code: string;
  children?: TaxonomyNode[];
}

export interface LingxiTaxonomyValue {
  accountId: string;
  taxonomyCode: string;   // code of the selected leaf/node
  taxonomyPath: string;   // e.g. "食品饮料 > 方便速食 > 即食火锅"
}

interface Props {
  value: LingxiTaxonomyValue;
  onChange: (value: LingxiTaxonomyValue) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LingxiTaxonomySelector({ value, onChange }: Props) {
  const [accountId, setAccountId] = useState(value.accountId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxonomyTree, setTaxonomyTree] = useState<TaxonomyNode[] | null>(null);
  const prevAccountIdRef = useRef(value.accountId || '');

  // Each level tracks the selected node at that depth
  const [selectedPath, setSelectedPath] = useState<TaxonomyNode[]>(() => {
    // Reconstruct path from value if we have it
    return [];
  });

  // Sync accountId from parent when it changes externally (e.g., imported project selection)
  useEffect(() => {
    if (value.accountId && value.accountId !== prevAccountIdRef.current) {
      prevAccountIdRef.current = value.accountId;
      setAccountId(value.accountId);
      // Auto-fetch taxonomy if accountId was set externally and tree not loaded
      if (!taxonomyTree) {
        doFetch(value.accountId);
      }
    }
  }, [value.accountId]);

  const doFetch = async (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setTaxonomyTree(null);
    setSelectedPath([]);

    try {
      const res = await fetch(`/api/lingxi/taxonomy?accountId=${encodeURIComponent(trimmed)}`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || '获取行业分类失败');
        return;
      }

      if (!json.data || json.data.length === 0) {
        setError('该账号无可用行业分类数据');
        return;
      }

      setTaxonomyTree(json.data);
    } catch {
      setError('请求失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  const fetchTaxonomy = useCallback(async () => {
    const trimmed = accountId.trim();
    if (!trimmed) {
      setError('请输入灵犀账号ID');
      return;
    }

    onChange({ ...value, accountId: trimmed, taxonomyCode: '', taxonomyPath: '' });
    await doFetch(trimmed);
  }, [accountId, value, onChange]);

  const handleSelectNode = (node: TaxonomyNode, depth: number) => {
    // Build new path up to this depth
    const newPath = [...selectedPath.slice(0, depth), node];
    setSelectedPath(newPath);

    // Build path string
    const pathStr = newPath.map(n => n.name).join(' > ');

    // Always update with current selection (user can pick any level)
    onChange({
      accountId: accountId.trim(),
      taxonomyCode: node.code,
      taxonomyPath: pathStr,
    });
  };

  // Get children of the last selected node at each level
  const getLevelNodes = (): TaxonomyNode[][] => {
    if (!taxonomyTree) return [];
    const levels: TaxonomyNode[][] = [taxonomyTree];

    for (let i = 0; i < selectedPath.length; i++) {
      const selected = selectedPath[i];
      if (selected.children && selected.children.length > 0) {
        levels.push(selected.children);
      } else {
        break;
      }
    }

    return levels;
  };

  const levels = getLevelNodes();

  return (
    <div className="space-y-3">
      {/* Account ID input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fetchTaxonomy(); } }}
          placeholder="输入灵犀账号ID"
          className="h-11 flex-1 rounded-lg border border-gray-200 px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="button"
          onClick={fetchTaxonomy}
          disabled={loading || !accountId.trim()}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          获取行业
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-rose-500">{error}</p>
      )}

      {/* Taxonomy cascade columns */}
      {taxonomyTree && levels.length > 0 && (
        <div className="flex gap-0 overflow-x-auto rounded-lg border border-gray-200">
          {levels.map((nodes, depth) => (
            <div
              key={depth}
              className="min-w-[180px] max-w-[220px] flex-shrink-0 border-r border-gray-100 last:border-r-0"
            >
              <div className="border-b border-gray-100 bg-gray-50 px-3 py-1.5">
                <span className="text-[11px] font-medium text-gray-500">
                  {depth === 0 ? '一级行业' : depth === 1 ? '二级行业' : depth === 2 ? '三级行业' : `第${depth + 1}级`}
                </span>
              </div>
              <div className="max-h-[240px] overflow-y-auto">
                {nodes.map((node) => {
                  const isSelected = selectedPath[depth]?.code === node.code;
                  const hasChildren = node.children && node.children.length > 0;
                  const isLeafSelected = isSelected && value.taxonomyCode === node.code;

                  return (
                    <button
                      key={node.code}
                      type="button"
                      onClick={() => handleSelectNode(node, depth)}
                      className={`flex w-full items-center gap-1 px-3 py-2 text-left text-sm transition ${
                        isSelected
                          ? 'bg-brand-50 text-brand font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {isLeafSelected && <Check size={12} className="flex-shrink-0 text-brand" />}
                      <span className="flex-1 truncate">{node.name}</span>
                      {hasChildren && (
                        <ChevronRight size={12} className="flex-shrink-0 text-gray-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected display */}
      {value.taxonomyPath && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2">
          <Check size={14} className="text-emerald-600" />
          <span className="text-sm text-emerald-700">
            已选择: <strong>{value.taxonomyPath}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
