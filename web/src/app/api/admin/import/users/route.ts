import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isValidPhone } from '@/lib/phone-validator';
import * as XLSX from 'xlsx';

/**
 * Column header mapping: Chinese headers → field names
 */
const COLUMN_MAP: Record<string, string> = {
  '花名': 'username',
  '用户名': 'username',
  '姓名': 'realName',
  '真名': 'realName',
  '真实姓名': 'realName',
  '显示名': 'displayName',
  '角色': 'role',
  '岗位简称': 'role',
  '手机号': 'phone',
  'phone': 'phone',
};

/**
 * Valid roles for batch import (excludes 'admin' which must be set manually)
 */
const VALID_ROLES = ['VP', 'AD', 'AM', '组长', 'AE'];

/**
 * Default password for new users: ppp666
 */
const DEFAULT_PASSWORD = 'ppp666';

/**
 * POST /api/admin/import/users
 *
 * Accepts multipart/form-data with an .xlsx file.
 * Parses user data (用户名, 显示名, 角色) and creates User records.
 * Each user gets a random initial password and mustChangePassword=true.
 * Returns { imported: number, errors: string[] }
 */
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: '请上传文件', code: 'NO_FILE' },
        { status: 400 }
      );
    }

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json(
        { error: '仅支持.xlsx格式文件', code: 'INVALID_FILE_FORMAT' },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse xlsx
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { error: '文件中没有工作表', code: 'PARSE_FAILED' },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: '文件中没有数据行', code: 'PARSE_FAILED' },
        { status: 400 }
      );
    }

    // Parse rows
    const errors: string[] = [];
    let importedCount = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const rowNum = i + 2; // Excel row number (1-indexed header + 1-indexed data)

      // Map Chinese headers to field names
      // Only set the mapped value when the column key actually exists in the raw row
      // (XLSX.utils.sheet_to_json only includes keys for columns present in the header)
      const mapped: Record<string, string | null> = {};
      for (const [chineseHeader, fieldName] of Object.entries(COLUMN_MAP)) {
        if (!(chineseHeader in raw)) continue;
        const value = raw[chineseHeader];
        mapped[fieldName] = value != null && String(value).trim() !== '' ? String(value).trim() : null;
      }

      // Validate username
      const username = mapped.username;
      if (!username) {
        errors.push(`第${rowNum}行: 用户名为空`);
        continue;
      }

      if (username.length > 50) {
        errors.push(`第${rowNum}行: 用户名"${username}"超过50字符`);
        continue;
      }

      // Validate role
      const role = mapped.role;
      if (!role) {
        errors.push(`第${rowNum}行: 角色为空`);
        continue;
      }

      if (!VALID_ROLES.includes(role)) {
        errors.push(`第${rowNum}行: 角色"${role}"无效，有效值为: ${VALID_ROLES.join(', ')}`);
        continue;
      }

      const displayName = mapped.displayName || mapped.username || null;
      const realName = mapped.realName || null;
      const phone = mapped.phone || null;

      // Validate phone format if provided
      if (phone && !isValidPhone(phone)) {
        errors.push(`第${rowNum}行: 手机号格式不正确`);
        continue;
      }

      // Check if username already exists
      try {
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
          errors.push(`第${rowNum}行: 用户名"${username}"已存在`);
          continue;
        }

        // Check if phone already exists
        if (phone) {
          const existingPhone = await prisma.user.findUnique({ where: { phone } });
          if (existingPhone) {
            errors.push(`第${rowNum}行: 手机号已存在`);
            continue;
          }
        }

        // Use default password and hash it
        const passwordHash = await hashPassword(DEFAULT_PASSWORD);

        // Derive permission level from role
        const permissionLevel = role === 'VP' ? 1 : role === 'AD' ? 2 : role === 'AM' ? 3 : role === '组长' ? 4 : 5;

        // Create user record
        await prisma.user.create({
          data: {
            username,
            passwordHash,
            displayName,
            realName,
            phone,
            role,
            permissionLevel,
            mustChangePassword: true,
            isActive: true,
          },
        });

        importedCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`第${rowNum}行: 创建用户"${username}"失败 - ${message}`);
      }
    }

    return NextResponse.json({
      imported: importedCount,
      errors,
    });
  } catch (error) {
    console.error('POST /api/admin/import/users error:', error);
    return NextResponse.json(
      { error: '导入失败，请稍后重试', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
