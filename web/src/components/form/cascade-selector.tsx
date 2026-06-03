'use client';

import { useState, useEffect } from 'react';
import { getBrandsForCategory, getBusinessLinesForBrand } from '@/lib/cascade-filter';
import { FilterField } from '@/components/ui/filter-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

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

const selectTriggerClass =
  'h-9 rounded border-gray-200 bg-white text-gray-900 focus-visible:ring-brand/25 disabled:bg-gray-50 disabled:text-gray-400';

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
        if (!cancelled) setLoading(false);
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

  const getLabel = (categoryId: string, brandId: string, blId: string) => {
    const categoryNode = tree.find((n) => n.id === categoryId);
    const brandNode = categoryNode?.children?.find((n) => n.id === brandId);
    const blNode = brandNode?.children?.find((n) => n.id === blId);
    return { categoryNode, brandNode, blNode };
  };

  if (loading) {
    return (
      <div className="col-span-3 grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <>
      <FilterField label="品类：">
        <Select
          value={value.category}
          onValueChange={(category) => onChange({ category, brand: '', businessLine: '' })}
          disabled={disabled}
        >
          <SelectTrigger className={selectTriggerClass} />
          <SelectContent>
            <SelectItem value="">请选择</SelectItem>
            {tree.map((node) => (
              <SelectItem key={node.id} value={node.id}>
                {node.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="品牌：">
        <Select
          value={value.brand}
          onValueChange={(brand) => onChange({ ...value, brand, businessLine: '' })}
          disabled={disabled || !value.category}
        >
          <SelectTrigger className={selectTriggerClass} />
          <SelectContent>
            <SelectItem value="">请选择</SelectItem>
            {brandOptions.map((brandId) => {
              const { brandNode } = getLabel(value.category, brandId, '');
              return (
                <SelectItem key={brandId} value={brandId}>
                  {brandNode?.label ?? brandId}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="品牌业务线：">
        <Select
          value={value.businessLine}
          onValueChange={(businessLine) => onChange({ ...value, businessLine })}
          disabled={disabled || !value.brand}
        >
          <SelectTrigger className={selectTriggerClass} />
          <SelectContent>
            <SelectItem value="">请选择</SelectItem>
            {businessLineOptions.map((blId) => {
              const { blNode } = getLabel(value.category, value.brand, blId);
              return (
                <SelectItem key={blId} value={blId}>
                  {blNode?.label ?? blId}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </FilterField>
    </>
  );
}
