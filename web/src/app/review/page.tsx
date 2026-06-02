'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Pencil, BookOpen } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { formatDateTime } from '@/lib/project-meta';

interface ReviewItem {
  id: string;
  projectId: string;
  projectName: string;
  category: string;
  brand: string;
  businessLine: string | null;
  status: string;
  createdBy: string;
  createdByDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReviewsResponse {
  items: ReviewItem[];
}

export default function ReviewListPage() {
  const { data, isLoading, isError, error } = useQuery<ReviewsResponse>({
    queryKey: ['reviews'],
    queryFn: async () => {
      const response = await fetch('/api/reviews');
      if (!response.ok) throw new Error('获取复盘列表失败');
      return response.json();
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">复盘系统</h1>
          <p className="mt-1 text-sm text-gray-500">管理所有复盘记录，查看复盘报告和进入审校台。</p>
        </div>
        <Link
          href="/review/new"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-5 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <Plus size={16} />
          开始新的复盘
        </Link>
      </div>

      {/* Table */}
      {isLoading ? (
        <Loading size="lg" text="正在加载复盘列表..." className="py-20" />
      ) : isError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
          {(error as Error).message || '获取复盘列表失败'}
        </div>
      ) : data?.items.length ? (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-600">项目名称</th>
                  <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-600">更新时间</th>
                  <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-600">创建者</th>
                  <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((review) => (
                  <tr key={review.id} className="bg-white text-sm text-gray-900 border-b transition hover:bg-gray-50">
                    <td className="max-w-[200px] truncate px-4 py-3 font-medium">
                      {review.projectName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDateTime(review.updatedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {review.createdByDisplayName || '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/review/new?editId=${review.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand transition hover:underline"
                        >
                          <Pencil size={12} />
                          编辑
                        </Link>
                        <Link
                          href={`/review/${review.id}/proofread`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand transition hover:underline"
                        >
                          <BookOpen size={12} />
                          审校台
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-white px-6 py-16 text-center text-sm text-gray-500">
          暂无复盘记录，点击"开始新的复盘"创建第一个复盘。
        </div>
      )}
    </div>
  );
}

