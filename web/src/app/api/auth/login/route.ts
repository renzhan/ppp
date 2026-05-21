import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createToken, getCookieName } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password, rememberMe } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: '请输入用户名和密码' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await createToken(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
      rememberMe ?? false
    );

    const maxAge = rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60;

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });

    response.cookies.set(getCookieName(), token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      maxAge,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '登录失败，请稍后重试' },
      { status: 500 }
    );
  }
}
