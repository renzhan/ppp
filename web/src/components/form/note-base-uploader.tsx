'use client';

import { useState, useRef, useCallback } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export interface NoteBaseUploaderProps {
  projectId?: string;
  onUploadSuccess: (count: number) => void;
  onUploadError: (error: string) => void;
}

/**
 * NoteBaseUploader - 笔记底表上传组件
 *
 * Behavior:
 * 1. Only accepts .xlsx files
 * 2. When a file is selected, validates extension client-side
 * 3. If projectId is provided, uploads to /api/upload/note-base/[projectId]
 * 4. Shows loading state during upload
 * 5. On success: displays "上传成功，共 N 条笔记" and calls onUploadSuccess(count)
 * 6. On error: displays error message and calls onUploadError(error)
 */
export function NoteBaseUploader({ projectId, onUploadSuccess, onUploadError }: NoteBaseUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ type: 'success'; count: number } | { type: 'error'; message: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    // Client-side validation: only .xlsx
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      const errorMsg = '仅支持.xlsx格式文件';
      setResult({ type: 'error', message: errorMsg });
      onUploadError(errorMsg);
      return;
    }

    if (!projectId) {
      const errorMsg = '请先保存项目后再上传笔记底表';
      setResult({ type: 'error', message: errorMsg });
      onUploadError(errorMsg);
      return;
    }

    setUploading(true);
    setResult(null);

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
        setResult({ type: 'success', count });
        onUploadSuccess(count);
      }
    } catch {
      const errorMsg = '网络错误，请检查网络连接后重试';
      setResult({ type: 'error', message: errorMsg });
      onUploadError(errorMsg);
    } finally {
      setUploading(false);
    }
  }, [projectId, onUploadSuccess, onUploadError]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6
          transition-colors cursor-pointer
          ${dragOver
            ? 'border-brand bg-[#FFF8E1]'
            : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
          }
          ${uploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        {uploading ? (
          <div className="flex w-full flex-col items-center gap-2 px-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand" />
            <span className="text-sm text-gray-500">正在上传并解析...</span>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div className="h-full animate-pulse rounded-full bg-brand" style={{ width: '60%' }} />
            </div>
          </div>
        ) : (
          <>
            <svg
              className="mb-2 h-8 w-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm text-gray-600">
              请上传<span className="font-medium text-brand">.xlsx</span>格式业务底表
            </p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        onChange={handleInputChange}
        className="hidden"
        aria-label="上传笔记底表"
      />

      {result && (
        <div
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
            result.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
          role="status"
          aria-live="polite"
        >
          {result.type === 'success' ? (
            <CheckCircle2 size={16} className="shrink-0 text-green-500" />
          ) : (
            <XCircle size={16} className="shrink-0 text-red-500" />
          )}
          <span>
            {result.type === 'success'
              ? `上传成功，共 ${result.count} 条笔记`
              : result.message
            }
          </span>
        </div>
      )}
    </div>
  );
}
