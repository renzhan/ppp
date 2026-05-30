'use client';

import { useState, useEffect } from 'react';
import { getBrandsForCategory, getBusinessLinesForBrand } from '@/lib/cascade-filter';

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}

export interface CascadeSelectorValue {
  category: string;
  brand: string;
  businessLine: string;
}

export interface CascadeSelectorProps {
  treeData?: TreeNode[];
  value: CascadeSelectorValue;
  onChange: (value: CascadeSelectorValue) => void;
  disabled?: boolean;
}

/**
 * Three-level cascade selector: 品类 → 品牌 → 业务线
 *
 * Behavior:
 * 1. If treeData is not provided, fetches from /api/tree-structure on mount
 * 2. Renders 3 select dropdowns: 品类, 品牌, 业务线
 * 3. When category changes: filters brands, clears brand and businessLine
 * 4. When brand changes: filters businessLines, clears businessLine
 */
export function CascadeSelector({ treeData, value, onChange, disabled }: CascadeSelectorProps) {
  const [tree, setTree] = useState<TreeNode[]>(treeData ?? []);
  const [loading, setLoading] = useState(!treeData);

  useEffect(() => {
    if (treeData) {
      setTree(treeData);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch('/api/tree-structure')
      .then((res) => res.json())
      .then((data: TreeNode[]) => {
        if (!cancelled) {
          setTree(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [treeData]);

  const brandOptions = value.category ? getBrandsForCategory(tree, value.category) : [];
  const businessLineOptions =
    value.category && value.brand
      ? getBusinessLinesForBrand(tree, value.category, value.brand)
      : [];

  const handleCategoryChange = (category: string) => {
    onChange({ category, brand: '', businessLine: '' });
  };

  const handleBrandChange = (brand: string) => {
    onChange({ ...value, brand, businessLine: '' });
  };

  const handleBusinessLineChange = (businessLine: string) => {
    onChange({ ...value, businessLine });
  };

  const selectClass =
    'block w-full rounded-sm border border-gray-300 bg-white px-3 h-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50';

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-sm bg-gray-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* 品类 */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">品类</label>
        <select
          className={selectClass}
          value={value.category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">请选择品类</option>
          {tree.map((node) => (
            <option key={node.id} value={node.id}>
              {node.label}
            </option>
          ))}
        </select>
      </div>

      {/* 品牌 */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">品牌</label>
        <select
          className={selectClass}
          value={value.brand}
          onChange={(e) => handleBrandChange(e.target.value)}
          disabled={disabled || !value.category}
        >
          <option value="">请选择品牌</option>
          {brandOptions.map((brandId) => {
            const categoryNode = tree.find((n) => n.id === value.category);
            const brandNode = categoryNode?.children?.find((n) => n.id === brandId);
            return (
              <option key={brandId} value={brandId}>
                {brandNode?.label ?? brandId}
              </option>
            );
          })}
        </select>
      </div>

      {/* 业务线 */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">业务线</label>
        <select
          className={selectClass}
          value={value.businessLine}
          onChange={(e) => handleBusinessLineChange(e.target.value)}
          disabled={disabled || !value.brand}
        >
          <option value="">请选择业务线</option>
          {businessLineOptions.map((blId) => {
            const categoryNode = tree.find((n) => n.id === value.category);
            const brandNode = categoryNode?.children?.find((n) => n.id === value.brand);
            const blNode = brandNode?.children?.find((n) => n.id === blId);
            return (
              <option key={blId} value={blId}>
                {blNode?.label ?? blId}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}
