import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PUT /api/admin/users/[id] - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const { displayName, role, isActive } = await request.json();
    const { id } = params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // Prevent admin from deactivating themselves
    if (id === session.sub && isActive === false) {
      return NextResponse.json(
        { error: '不能禁用自己的账号' },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(role !== undefined && { role: ['admin', '组长', 'AD', 'AM', '投手', '执行'].includes(role) ? role : '执行' }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: '更新用户失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id] - Deactivate user (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const { id } = params;

  if (id === session.sub) {
    return NextResponse.json(
      { error: '不能删除自己的账号' },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: false, updatedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
