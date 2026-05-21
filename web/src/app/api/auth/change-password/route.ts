import { NextRequest, NextResponse } from 'next/server';
import { getSession, verifyPassword, hashPassword, createToken, getCookieName } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const { oldPassword, newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: '新密码长度不能少于6位' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // If user must change password (first login), oldPassword is not required
    if (!user.mustChangePassword) {
      if (!oldPassword) {
        return NextResponse.json(
          { error: '请输入当前密码' },
          { status: 400 }
        );
      }
      const valid = await verifyPassword(oldPassword, user.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { error: '当前密码错误' },
          { status: 401 }
        );
      }
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        updatedAt: new Date(),
      },
    });

    // Issue a new token with mustChangePassword = false
    const token = await createToken({
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: false,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set(getCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: '修改密码失败' },
      { status: 500 }
    );
  }
}
