import { cn } from '@/lib/utils';

/** 列表页 Table 外框 */
export const listTableWrapperClass = 'rounded-lg border-gray-100';

/** 表头行 */
export const listTableHeaderRowClass = 'border-gray-100 bg-[#f8f8f8] hover:bg-[#f8f8f8]';

/** 表头单元格 */
export const listTableHeadClass = 'h-auto whitespace-nowrap py-3.5 text-center text-gray-700';

/** 操作列表头 */
export const listTableActionHeadClass = cn(listTableHeadClass, 'text-center');

/** 数据单元格 */
export const listTableCellClass = 'py-3 text-center';

/** 操作列单元格 */
export const listTableActionCellClass = 'py-3 text-right';

/** 筛选区与数据列表之间的间距 */
export const listFilterToDataGapClass = 'mt-10';

/** 数据行（斑马纹） */
export function listTableRowClass(index: number) {
  return cn(
    'border-gray-200 text-gray-800 text-xs hover:bg-brand-50/30 border-b',
    index % 2 === 1 ? 'bg-white' : 'bg-white'
  );
}

/** 空状态 */
export const listEmptyClass =
  'rounded-lg border border-gray-100 py-16 text-center text-sm text-gray-500';

/** 错误状态 */
export const listErrorClass =
  'rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600';
