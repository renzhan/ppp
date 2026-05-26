'use client';

import React from 'react';

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
}

export function TableInfoRenderer({ content }: TableInfoRendererProps) {
  const { title, description } = content;

  // Support both flat and nested tableData structures
  const headers = content.headers || content.tableData?.headers || [];
  const rows = content.rows || content.tableData?.rows || [];

  return (
    <div className="flex h-full w-full flex-col px-10 py-8">
      {/* Title */}
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {title || 'Table'}
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
                      {header}
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
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="mt-4 text-center text-xs text-gray-500 leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
