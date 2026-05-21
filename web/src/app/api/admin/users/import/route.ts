import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

// POST /api/admin/users/import - Batch import users from Excel
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const defaultPassword = (formData.get('defaultPassword') as string) || 'password123';

    if (!file) {
      return NextResponse.json(
        { error: '请上传Excel文件' },
        { status: 400 }
      );
    }

    if (defaultPassword.length < 6) {
      return NextResponse.json(
        { error: '默认密码长度不能少于6位' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Excel文件中没有数据' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(defaultPassword);
    const results: { success: string[]; failed: { username: string; reason: string }[] } = {
      success: [],
      failed: [],
    };

    for (const row of rows) {
      const username = (row['username'] || row['用户名'] || '').toString().trim();
      const displayName = (row['displayName'] || row['显示名称'] || row['姓名'] || '').toString().trim();
      const role = (row['role'] || row['角色'] || 'user').toString().trim();

      if (!username) {
        results.failed.push({ username: '(空)', reason: '用户名为空' });
        continue;
      }

      if (username.length > 50) {
        results.failed.push({ username, reason: '用户名超过50字符' });
        continue;
      }

      try {
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
          results.failed.push({ username, reason: '用户名已存在' });
          continue;
        }

        await prisma.user.create({
          data: {
            username,
            passwordHash,
            displayName: displayName || null,
            role: role === 'admin' ? 'admin' : 'user',
            mustChangePassword: true,
            isActive: true,
          },
        });
        results.success.push(username);
      } catch (e) {
        results.failed.push({ username, reason: '创建失败' });
      }
    }

    return NextResponse.json({
      total: rows.length,
      successCount: results.success.length,
      failedCount: results.failed.length,
      success: results.success,
      failed: results.failed,
    });
  } catch (error) {
    console.error('Import users error:', error);
    return NextResponse.json(
      { error: '导入失败，请检查文件格式' },
      { status: 500 }
    );
  }
}
