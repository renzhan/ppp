'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, Loader2, FileText, Globe, Building2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface KnowledgeDocument {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  workspaceId: string | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
  workspace?: { id: string; name: string } | null;
}

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  isEnabled: boolean;
}

interface ApiError {
  error: string;
  message: string;
  details?: Record<string, string>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SUPPORTED_FORMATS = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/plain',
];

const FORMAT_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'text/markdown': 'Markdown',
  'text/plain': 'TXT',
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchDocuments(): Promise<KnowledgeDocument[]> {
  const res = await fetch('/api/agent-mgmt/knowledge');
  if (!res.ok) throw new Error('Failed to fetch knowledge documents');
  return res.json();
}

async function fetchWorkspaces(): Promise<Workspace[]> {
  const res = await fetch('/api/agent-mgmt/workspaces');
  if (!res.ok) throw new Error('Failed to fetch workspaces');
  return res.json();
}

async function uploadDocument(file: File, workspaceId: string | null): Promise<KnowledgeDocument> {
  const formData = new FormData();
  formData.append('file', file);
  if (workspaceId) {
    formData.append('workspaceId', workspaceId);
  }

  const res = await fetch('/api/agent-mgmt/knowledge/upload', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
  return res.json();
}

async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`/api/agent-mgmt/knowledge/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMimeType(mimeType: string): string {
  return FORMAT_LABELS[mimeType] || mimeType;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function KnowledgeTab() {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDocument | null>(null);

  const { data: documents = [], isLoading, error } = useQuery({
    queryKey: ['knowledge-documents'],
    queryFn: fetchDocuments,
  });

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: fetchWorkspaces,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] });
      setDeleteTarget(null);
    },
  });

  const handleDeleteClick = (doc: KnowledgeDocument) => {
    setDeleteTarget(doc);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  };

  // Group documents: public (workspaceId=null) and by workspace
  const publicDocs = documents.filter((d) => d.workspaceId === null);
  const workspaceDocs = documents.filter((d) => d.workspaceId !== null);

  const docsByWorkspace = new Map<string, { workspace: Workspace; docs: KnowledgeDocument[] }>();
  for (const ws of workspaces) {
    docsByWorkspace.set(ws.id, { workspace: ws, docs: [] });
  }
  for (const doc of workspaceDocs) {
    if (doc.workspaceId) {
      const group = docsByWorkspace.get(doc.workspaceId);
      if (group) {
        group.docs.push(doc);
      } else {
        docsByWorkspace.set(doc.workspaceId, {
          workspace: {
            id: doc.workspaceId,
            name: doc.workspace?.name || '未知工作区',
            description: null,
            icon: null,
            isEnabled: true,
          },
          docs: [doc],
        });
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        加载知识库文档失败，请稍后重试。
      </div>
    );
  }

  return (
    <div>
      {/* Upload Section */}
      <div className="mb-6">
        <h2 className="mb-4 text-lg font-medium text-gray-900">知识库文档</h2>
        <FileUploadZone
          workspaces={workspaces}
          onUploadSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] });
          }}
        />
      </div>

      {/* Public Documents Section */}
      <div className="mb-6">
        <h3 className="mb-2 text-sm font-medium text-gray-500 uppercase tracking-wider">
          <span className="inline-flex items-center gap-1">
            <Globe size={14} />
            公共
          </span>
        </h3>
        {publicDocs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
            <p className="text-sm text-gray-400">暂无公共文档</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {publicDocs.map((doc) => (
              <DocumentRow key={doc.id} document={doc} onDelete={handleDeleteClick} />
            ))}
          </div>
        )}
      </div>

      {/* Workspace Documents grouped by workspace */}
      <div className="space-y-6">
        {Array.from(docsByWorkspace.values())
          .filter((group) => group.docs.length > 0)
          .map((group) => (
            <div key={group.workspace.id}>
              <h3 className="mb-2 text-sm font-medium text-gray-500 uppercase tracking-wider">
                <span className="inline-flex items-center gap-1">
                  <Building2 size={14} />
                  {group.workspace.name}
                </span>
              </h3>
              <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
                {group.docs.map((doc) => (
                  <DocumentRow key={doc.id} document={doc} onDelete={handleDeleteClick} />
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          document={deleteTarget}
          isPending={deleteMutation.isPending}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Document Row ────────────────────────────────────────────────────────────

interface DocumentRowProps {
  document: KnowledgeDocument;
  onDelete: (doc: KnowledgeDocument) => void;
}

function DocumentRow({ document, onDelete }: DocumentRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <FileText size={16} className="flex-shrink-0 text-gray-400" />
          <span className="text-sm font-medium text-gray-900 truncate">
            {document.fileName}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {formatMimeType(document.mimeType)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
          <span>{formatFileSize(document.fileSize)}</span>
          <span>{new Date(document.createdAt).toLocaleString('zh-CN')}</span>
          {document.uploadedBy && <span>上传者: {document.uploadedBy}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        <button
          onClick={() => onDelete(document)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
          title="删除"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── File Upload Zone ────────────────────────────────────────────────────────

interface FileUploadZoneProps {
  workspaces: Workspace[];
  onUploadSuccess: () => void;
}

function FileUploadZone({ workspaces, onUploadSuccess }: FileUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      // Client-side validation
      if (!SUPPORTED_FORMATS.includes(file.type)) {
        setUploadStatus('error');
        setUploadError(`不支持的文件格式: ${file.type || '未知'}。支持的格式: PDF, Word, Markdown, TXT`);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setUploadStatus('error');
        setUploadError(`文件大小 (${formatFileSize(file.size)}) 超过限制 (20MB)`);
        return;
      }

      setUploadStatus('uploading');
      setUploadError(null);

      try {
        await uploadDocument(file, selectedWorkspaceId || null);
        setUploadStatus('success');
        onUploadSuccess();
        // Reset after a short delay
        setTimeout(() => setUploadStatus('idle'), 2000);
      } catch (err: unknown) {
        setUploadStatus('error');
        const apiErr = err as ApiError;
        setUploadError(apiErr?.message || '上传失败，请重试');
      }
    },
    [selectedWorkspaceId, onUploadSuccess]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [handleFile]
  );

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      {/* Workspace selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">上传到:</label>
        <select
          value={selectedWorkspaceId}
          onChange={(e) => setSelectedWorkspaceId(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="">公共 (所有工作区可见)</option>
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? 'border-brand bg-brand-50'
            : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.md,.txt,.markdown"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {uploadStatus === 'uploading' ? (
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
            <p className="mt-2 text-sm text-gray-600">上传中...</p>
          </div>
        ) : uploadStatus === 'success' ? (
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
              <span className="text-green-600">✓</span>
            </div>
            <p className="mt-2 text-sm text-green-600">上传成功</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="h-8 w-8 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              拖拽文件到此处，或点击选择文件
            </p>
            <p className="mt-1 text-xs text-gray-400">
              支持格式: PDF, Word (.docx), Markdown, TXT | 大小限制: 20MB
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {uploadStatus === 'error' && uploadError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {uploadError}
        </div>
      )}
    </div>
  );
}

// ─── Delete Confirmation Dialog ──────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  document: KnowledgeDocument;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ document, isPending, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
        <p className="mt-3 text-sm text-gray-600">
          确定要删除文档 <span className="font-medium">&ldquo;{document.fileName}&rdquo;</span> 吗？此操作不可撤销。
        </p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
