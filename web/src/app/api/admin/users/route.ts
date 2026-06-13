import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '../../../../../../generated/prisma';
import { getSession, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  realName: true,
  phone: true,
  role: true,
  mustChangePassword: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// GET /api/admin/users - List users; paginate when page/pageSize are provided, otherwise return all
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');
  const search = searchParams.get('search')?.trim();
  const paginate = searchParams.has('page') || searchParams.has('pageSize');

  const where: Prisma.UserWhereInput = {};

  if (role) {
    where.role = role;
  }

  if (search) {
    where.OR = [
      { username: { contains: search, mode: 'insensitive' } },
      { displayName: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (paginate) {
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, Math.min(500, parseInt(searchParams.get('pageSize') || '20', 10)));

    const [items, totalItems] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    });
  }

  const items = await prisma.user.findMany({
    where,
    select: USER_SELECT,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    items,
    totalItems: items.length,
  });
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
