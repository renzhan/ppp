import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/users - List all users
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      mustChangePassword: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ users });
}

// POST /api/admin/users - Create user
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const { username, displayName, realName, role, password } = await request.json();

    if (!username) {
      return NextResponse.json(
        { error: '用户名（花名）不能为空' },
        { status: 400 }
      );
    }

    const actualPassword = password || 'ppp666';

    if (actualPassword.length < 6) {
      return NextResponse.json(
        { error: '密码长度不能少于6位' },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { error: `用户名 "${username}" 已存在` },
        { status: 409 }
      );
    }

    const validRole = ['admin', 'VP', 'AD', 'AM', '组长', 'AE'].includes(role) ? role : 'AE';
    const permissionLevel = validRole === 'admin' ? 0 : validRole === 'VP' ? 1 : validRole === 'AD' ? 2 : validRole === 'AM' ? 3 : validRole === '组长' ? 4 : 5;

    const passwordHash = await hashPassword(actualPassword);
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        displayName: displayName || username,
        realName: realName || null,
        role: validRole,
        permissionLevel,
        mustChangePassword: true,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: '创建用户失败' },
      { status: 500 }
    );
  }
}
