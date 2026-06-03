'use client';

import { useState, useRef, useCallback } from 'react';
import { FolderPlus, FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface NoteBaseUploaderProps {
  projectId?: string;
  onUploadSuccess: (count: number) => void;
  onUploadError: (error: string) => void;
  /** 无 projectId 时仅选择文件（如新建项目页） */
  onFileSelect?: (file: File) => void;
  onFileClear?: () => void;
}

export function NoteBaseUploader({
  projectId,
  onUploadSuccess,
  onUploadError,
  onFileSelect,
  onFileClear,
}: NoteBaseUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<
    { type: 'success'; count: number } | { type: 'error'; message: string } | null
  >(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        const errorMsg = '仅支持.xlsx格式文件';
        setResult({ type: 'error', message: errorMsg });
        onUploadError(errorMsg);
        return;
      }

      if (!projectId) {
        if (onFileSelect) {
          onFileSelect(file);
          setFileName(file.name);
          setResult(null);
          return;
        }
        const errorMsg = '请先保存项目后再上传笔记底表';
        setResult({ type: 'error', message: errorMsg });
        onUploadError(errorMsg);
        return;
      }

      setFileName(file.name);
      setUploading(true);
      setUploadProgress(30);
      setResult(null);

      const progressTimer = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 12, 90));
      }, 200);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/upload/note-base/${projectId}`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          const errorMsg = data.error || '上传失败，请稍后重试';
          setResult({ type: 'error', message: errorMsg });
          onUploadError(errorMsg);
        } else {
          const count = data.noteCount ?? 0;
          setUploadProgress(100);
          setResult({ type: 'success', count });
          onUploadSuccess(count);
        }
      } catch {
        const errorMsg = '网络错误，请检查网络连接后重试';
        setResult({ type: 'error', message: errorMsg });
        onUploadError(errorMsg);
      } finally {
        clearInterval(progressTimer);
        setUploading(false);
      }
    },
    [projectId, onUploadSuccess, onUploadError]
  );

  const clearFile = () => {
    setFileName(null);
    setUploadProgress(0);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const showFileRow = fileName && (uploading || result || (!projectId && onFileSelect));

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !uploading) fileInputRef.current?.click();
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
          'flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 transition-colors',
          dragOver ? 'border-brand bg-brand-50' : 'border-gray-300 bg-[#FAFAFA] hover:border-gray-400',
          uploading && 'pointer-events-none'
        )}
      >
        <FolderPlus size={40} className="mb-3 text-gray-400" strokeWidth={1.25} />
        <p className="text-sm text-gray-600">
          点击或将文件 <span className="font-medium text-brand">拖拽</span> 到这里上传
        </p>
        <p className="mt-1 text-xs text-gray-400">支持扩展名：.xlsx</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        onChange={handleInputChange}
        className="hidden"
        aria-label="上传笔记底表"
      />

      {showFileRow && (
        <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3">
          <FileSpreadsheet size={20} className="shrink-0 text-brand" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-gray-800">{fileName}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{ width: `${uploading ? uploadProgress : 100}%` }}
              />
            </div>
            {result?.type === 'success' && (
              <p className="mt-1 text-xs text-green-600">上传成功，共 {result.count} 条笔记</p>
            )}
            {result?.type === 'error' && (
              <p className="mt-1 text-xs text-red-600">{result.message}</p>
            )}
          </div>
          {!uploading && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={clearFile}
              className="shrink-0 text-gray-400"
              aria-label="移除文件"
            >
              <X size={16} />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
