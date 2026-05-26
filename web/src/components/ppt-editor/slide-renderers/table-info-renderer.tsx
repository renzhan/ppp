'use client';

import React, { useCallback } from 'react';
import { InlineEditableText } from '../inline-editable-text';

interface TableInfoContent {
  title?: string;
  description?: string;
  headers?: string[];
  rows?: string[][];
  tableData?: {
    headers?: string[];
    rows?: string[][];
  };
}

interface TableInfoRendererProps {
  content: TableInfoContent;
  editable?: boolean;
  onContentChange?: (content: TableInfoContent) => void;
}

export function TableInfoRenderer({ content, editable, onContentChange }: TableInfoRendererProps) {
  const { title, description } = content;

  // Support both flat and nested tableData structures
  const headers = content.headers || content.tableData?.headers || [];
  const rows = content.rows || content.tableData?.rows || [];
  const isNested = !content.headers && !!content.tableData;

  const handleTitleChange = useCallback((newTitle: string) => {
    onContentChange?.({ ...content, title: newTitle });
  }, [content, onContentChange]);

  const handleDescriptionChange = useCallback((newDesc: string) => {
    onContentChange?.({ ...content, description: newDesc });
  }, [content, onContentChange]);

  const handleCellChange = useCallback((rowIndex: number, cellIndex: number, value: string) => {
    const updatedRows = rows.map((row, ri) =>
      ri === rowIndex ? row.map((cell, ci) => (ci === cellIndex ? value : cell)) : [...row]
    );
    if (isNested) {
      onContentChange?.({ ...content, tableData: { ...content.tableData, rows: updatedRows } });
    } else {
      onContentChange?.({ ...content, rows: updatedRows });
    }
  }, [rows, isNested, content, onContentChange]);

  const handleHeaderChange = useCallback((index: number, value: string) => {
    const updatedHeaders = headers.map((h, i) => (i === index ? value : h));
    if (isNested) {
      onContentChange?.({ ...content, tableData: { ...content.tableData, headers: updatedHeaders } });
    } else {
      onContentChange?.({ ...content, headers: updatedHeaders });
    }
  }, [headers, isNested, content, onContentChange]);

  return (
    <div className="flex h-full w-full flex-col px-10 py-8">
      {/* Title */}
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {editable && onContentChange ? (
            <InlineEditableText
              content={title || ''}
              onContentChange={handleTitleChange}
              placeholder="输入标题..."
              editable={editable}
            />
          ) : (
            title || 'Table'
          )}
        </h1>
        <div className="w-14 h-0.5 bg-purple-600 mx-auto mt-2" />
      </div>

      {/* Table */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <div className="w-full max-w-full overflow-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-left text-xs">
            {headers.length > 0 && (
              <thead>
                <tr className="bg-purple-600 text-white">
                  {headers.map((header, i) => (
                    <th key={i} className="px-4 py-2.5 font-semibold text-center">
                      {editable && onContentChange ? (
                        <InlineEditableText
                          content={header}
                          onContentChange={(v) => handleHeaderChange(i, v)}
                          placeholder="表头"
                          editable={editable}
                          className="text-white"
                        />
                      ) : (
                        header
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  {row.slice(0, headers.length || undefined).map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-2 text-center text-gray-700">
                      {editable && onContentChange ? (
                        <InlineEditableText
                          content={cell}
                          onContentChange={(v) => handleCellChange(rowIndex, cellIndex, v)}
                          placeholder=""
                          editable={editable}
                        />
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Description */}
      {(description || editable) && (
        <p className="mt-4 text-center text-xs text-gray-500 leading-relaxed">
          {editable && onContentChange ? (
            <InlineEditableText
              content={description || ''}
              onContentChange={handleDescriptionChange}
              placeholder="输入描述..."
              editable={editable}
            />
          ) : (
            description
          )}
        </p>
      )}
    </div>
  );
}
