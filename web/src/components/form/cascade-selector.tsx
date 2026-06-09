'use client';

import { useState, useEffect } from 'react';
import { getBrandsForCategory, getBusinessLinesForBrand } from '@/lib/cascade-filter';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

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

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

/**
 * Three-level cascade selector: 品类 → 品牌 → 业务线
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

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-gray-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="space-y-1.5">
        <Label className="font-normal text-gray-500">
          品类 <RequiredMark />
        </Label>
        <Select value={value.category} onValueChange={handleCategoryChange} disabled={disabled}>
          <SelectTrigger className="h-10 rounded-lg border-gray-300" />
          <SelectContent>
            <SelectItem value="">请选择品类</SelectItem>
            {tree.map((node) => (
              <SelectItem key={node.id} value={node.id}>
                {node.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="font-normal text-gray-500">
          品牌 <RequiredMark />
        </Label>
        <Select
          value={value.brand}
          onValueChange={handleBrandChange}
          disabled={disabled || !value.category}
        >
          <SelectTrigger className="h-10 rounded-lg border-gray-300" />
          <SelectContent>
            <SelectItem value="">请选择品牌</SelectItem>
            {brandOptions.map((brandId) => {
              const categoryNode = tree.find((n) => n.id === value.category);
              const brandNode = categoryNode?.children?.find((n) => n.id === brandId);
              return (
                <SelectItem key={brandId} value={brandId}>
                  {brandNode?.label ?? brandId}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="font-normal text-gray-500">
          业务线 <RequiredMark />
        </Label>
        <Select
          value={value.businessLine}
          onValueChange={handleBusinessLineChange}
          disabled={disabled || !value.brand}
        >
          <SelectTrigger className="h-10 rounded-lg border-gray-300" />
          <SelectContent>
            <SelectItem value="">请选择业务线</SelectItem>
            {businessLineOptions.map((blId) => {
              const categoryNode = tree.find((n) => n.id === value.category);
              const brandNode = categoryNode?.children?.find((n) => n.id === value.brand);
              const blNode = brandNode?.children?.find((n) => n.id === blId);
              return (
                <SelectItem key={blId} value={blId}>
                  {blNode?.label ?? blId}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
