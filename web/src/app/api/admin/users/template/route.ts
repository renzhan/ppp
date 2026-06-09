import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

/**
 * GET /api/admin/users/template
 * Download an Excel template for batch user import.
 */
export async function GET() {
  const headers = ['username', 'displayName', 'phone', 'role'];
  const sampleData = [
    ['zhangsan', '张三', '13800138001', 'user'],
    ['lisi', '李四', '13800138002', 'user'],
    ['wangwu', '王五', '13800138003', 'admin'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);

  // Set column widths
  ws['!cols'] = [
    { wch: 20 }, // username
    { wch: 20 }, // displayName
    { wch: 15 }, // phone
    { wch: 10 }, // role
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '用户导入模板');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="user_import_template.xlsx"',
    },
  });
}
