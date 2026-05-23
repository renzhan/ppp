'use client';

import { Lightbulb } from 'lucide-react';

export default function PlanningPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
          <Lightbulb size={40} className="text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">策划系统即将上线</h1>
        <p className="mt-3 max-w-md text-sm text-slate-500">
          策划系统正在开发中，将支持营销策划方案的创建、管理和协作。敬请期待。
        </p>
      </div>
    </div>
  );
}
