import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/admin/users/[id]/reset-password - Admin resets user password
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const { password } = await request.json();
    const { id } = params;

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: '密码长度不能少于6位' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: '重置密码失败' },
      { status: 500 }
    );
  }
}
