import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

/**
 * GET /api/admin/import/users/template
 * 
 * Downloads an Excel template for batch user import.
 * Includes a hidden sheet with role values used for dropdown validation.
 */
export async function GET() {
  const wb = XLSX.utils.book_new();

  // Main sheet with sample data
  const data = [
    ['花名', '真名', '手机号', '角色'],
    ['阿玉', '程国玉', '13800138001', 'VP'],
    ['风犬', '任一枭', '13800138002', 'AD'],
    ['小鹿', '路宇婷', '13800138003', 'AM'],
    ['奈奈', '黄慧菲', '13800138004', '组长'],
    ['小棉', '杨越', '13800138005', 'AE'],
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 20 },
    { wch: 20 },
    { wch: 15 },
    { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, '用户导入模板');

  // Create a hidden "角色选项" sheet with valid role values for reference
  const validRoles = ['admin', 'VP', 'AD', 'AM', '组长', 'AE'];
  const rolesData = [['有效角色值（请勿修改此表）'], ...validRoles.map(r => [r])];
  const rolesWs = XLSX.utils.aoa_to_sheet(rolesData);
  rolesWs['!cols'] = [{ wch: 25 }];
  XLSX.utils.book_append_sheet(wb, rolesWs, '角色选项');

  // Set data validation on the role column (C2:C200)
  // Note: SheetJS community edition has limited dataValidation support,
  // so we also add the roles as a reference sheet
  if (!ws['!dataValidation']) ws['!dataValidation'] = [];
  (ws['!dataValidation'] as unknown[]).push({
    sqref: 'D2:D200',
    type: 'list',
    formula1: `"${validRoles.join(',')}"`,
  });

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="user-import-template.xlsx"',
    },
  });
}
