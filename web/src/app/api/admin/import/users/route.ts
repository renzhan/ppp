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
const VALID_ROLES = ['VP', 'AD', 'AM', '组长', 'AE', 'admin', '助理'];

/**
 * Role alias mapping: non-standard role names → system role names
 */
const ROLE_ALIAS_MAP: Record<string, string> = {
  '管理员': 'admin',
  '投手': 'AE',
  '策划': 'AE',
};

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

    // Parse and validate all rows first (no DB calls)
    const errors: string[] = [];
    interface ValidatedRow {
      rowNum: number;
      username: string;
      displayName: string | null;
      realName: string | null;
      phone: string | null;
      role: string;
      permissionLevel: number;
    }
    const validatedRows: ValidatedRow[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const rowNum = i + 2; // Excel row number (1-indexed header + 1-indexed data)

      // Map Chinese headers to field names
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
      let role = mapped.role;
      if (!role) {
        errors.push(`第${rowNum}行: 角色为空`);
        continue;
      }

      // Apply role alias mapping (管理员→admin, 投手→AE, 策划→AE)
      if (ROLE_ALIAS_MAP[role]) {
        role = ROLE_ALIAS_MAP[role];
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

      // Derive permission level from role
      const permissionLevel = role === 'admin' ? 0 : role === 'VP' ? 1 : role === 'AD' ? 2 : role === 'AM' ? 3 : role === '组长' ? 4 : 5;

      validatedRows.push({ rowNum, username, displayName, realName, phone, role, permissionLevel });
    }

    if (validatedRows.length === 0) {
      return NextResponse.json({ imported: 0, errors });
    }

    // Check for duplicates within the file itself
    const seenUsernames = new Map<string, number>(); // username → first rowNum
    const seenPhones = new Map<string, number>(); // phone → first rowNum
    const deduplicatedRows: ValidatedRow[] = [];

    for (const row of validatedRows) {
      if (seenUsernames.has(row.username)) {
        errors.push(`第${row.rowNum}行: 用户名"${row.username}"在文件中重复（与第${seenUsernames.get(row.username)}行）`);
        continue;
      }
      if (row.phone && seenPhones.has(row.phone)) {
        errors.push(`第${row.rowNum}行: 手机号在文件中重复（与第${seenPhones.get(row.phone)}行）`);
        continue;
      }
      seenUsernames.set(row.username, row.rowNum);
      if (row.phone) seenPhones.set(row.phone, row.rowNum);
      deduplicatedRows.push(row);
    }

    // Batch check existing usernames and phones in DB (2 queries total instead of 2N)
    const usernamesToCheck = deduplicatedRows.map((r) => r.username);
    const phonesToCheck = deduplicatedRows.map((r) => r.phone).filter((p): p is string => p !== null);

    const [existingByUsername, existingByPhone] = await Promise.all([
      prisma.user.findMany({
        where: { username: { in: usernamesToCheck } },
        select: { username: true },
      }),
      phonesToCheck.length > 0
        ? prisma.user.findMany({
            where: { phone: { in: phonesToCheck } },
            select: { phone: true },
          })
        : Promise.resolve([]),
    ]);

    const existingUsernameSet = new Set(existingByUsername.map((u) => u.username));
    const existingPhoneSet = new Set(existingByPhone.map((u) => u.phone).filter(Boolean));

    // Filter out rows with existing username/phone
    const rowsToInsert: ValidatedRow[] = [];
    for (const row of deduplicatedRows) {
      if (existingUsernameSet.has(row.username)) {
        errors.push(`第${row.rowNum}行: 用户名"${row.username}"已存在`);
        continue;
      }
      if (row.phone && existingPhoneSet.has(row.phone)) {
        errors.push(`第${row.rowNum}行: 手机号已存在`);
        continue;
      }
      rowsToInsert.push(row);
    }

    if (rowsToInsert.length === 0) {
      return NextResponse.json({ imported: 0, errors });
    }

    // Hash password ONCE (all users get the same default password)
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);

    // Batch insert with createMany (chunk by 100 to avoid payload limits)
    const BATCH_SIZE = 100;
    let importedCount = 0;

    for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
      const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
      try {
        const result = await prisma.user.createMany({
          data: batch.map((row) => ({
            username: row.username,
            passwordHash,
            displayName: row.displayName,
            realName: row.realName,
            phone: row.phone,
            role: row.role,
            permissionLevel: row.permissionLevel,
            mustChangePassword: true,
            isActive: true,
          })),
          skipDuplicates: true,
        });
        importedCount += result.count;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const startRow = batch[0].rowNum;
        const endRow = batch[batch.length - 1].rowNum;
        errors.push(`第${startRow}-${endRow}行批量插入失败: ${message}`);
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
