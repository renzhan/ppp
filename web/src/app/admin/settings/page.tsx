'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { listErrorClass } from '@/components/ui/data-list';
import { cn } from '@/lib/utils';

interface ImportResult {
  imported: number;
  treeNodesCreated: number;
  errors: string[];
}

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl tracking-tight text-gray-900">系统设置</h1>

      </div>
      <ProjectBaseImportSection />
    </div>
  );
}

function ProjectBaseImportSection() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('仅支持.xlsx格式文件');
      setResult(null);
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/import/project-base', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        const detailErrors: string[] = data.errors ?? [];
        const mainError = data.error || '导入失败，请稍后重试';
        if (detailErrors.length > 0) {
          setError(`${mainError}\n${detailErrors.slice(0, 10).join('\n')}`);
        } else {
          setError(mainError);
        }
      } else {
        setResult({
          imported: data.imported ?? 0,
          treeNodesCreated: data.treeNodesCreated ?? 0,
          errors: data.errors ?? [],
        });
      }
    } catch {
      setError('网络错误，请检查网络连接后重试');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleClick = () => fileInputRef.current?.click();

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0 pb-2">
        <Upload size={20} className="text-brand" />
        <CardTitle className="text-lg">项目底表导入</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CardDescription className="mt-0">
          上传 .xlsx 格式的项目底表文件，系统将解析品类、品牌、业务线等字段并生成级联选择器数据源。
        </CardDescription>

        <div
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleClick();
          }}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors',
            dragOver ? 'border-brand bg-brand-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-white',
            uploading && 'pointer-events-none opacity-60'
          )}
        >
          {uploading ? (
            <Loading size="sm" text="正在上传并解析..." />
          ) : (
            <>
              <Upload className="mb-2 h-10 w-10 text-gray-400" strokeWidth={1.5} />
              <p className="text-sm text-gray-600">
                拖拽文件到此处，或{' '}
                <span className="font-medium text-brand">点击选择文件</span>
              </p>
              <p className="mt-1 text-xs text-gray-400">仅支持 .xlsx 格式</p>
            </>
          )}
        </div>

        <Input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleInputChange}
          className="hidden"
          aria-label="上传项目底表"
        />

        {result && (
          <div className="rounded-lg bg-green-50 px-4 py-3" role="status" aria-live="polite">
            <p className="text-sm font-medium text-green-700">
              导入成功：导入 {result.imported} 个项目，创建 {result.treeNodesCreated} 个树节点
            </p>
            {result.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-amber-700">以下行存在问题：</p>
                <ul className="mt-1 list-inside list-disc text-xs text-amber-600">
                  {result.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className={listErrorClass} role="alert">
            {error.split('\n').map((line, idx) => (
              <p key={idx} className={idx === 0 ? 'font-medium' : 'mt-1 text-xs'}>
                {line}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
