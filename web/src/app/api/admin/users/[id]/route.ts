import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isValidPhone } from '@/lib/phone-validator';

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
    const { displayName, role, isActive, phone } = await request.json();
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

    // Validate phone format if provided
    if (phone !== undefined && phone !== null && phone !== '' && !isValidPhone(phone)) {
      return NextResponse.json(
        { error: '手机号格式不正确' },
        { status: 400 }
      );
    }

    // Check phone uniqueness if provided (exclude current user)
    if (phone && isValidPhone(phone)) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone && existingPhone.id !== id) {
        return NextResponse.json(
          { error: '手机号已存在' },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(role !== undefined && { role: ['admin', 'VP', 'AD', 'AM', '组长', 'AE'].includes(role) ? role : 'AE' }),
        ...(isActive !== undefined && { isActive }),
        ...(phone !== undefined && { phone: phone || null }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        phone: true,
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
