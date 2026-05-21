import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'ppp-jwt-secret-key-2024-change-in-production'
);

const COOKIE_NAME = 'ppp_token';

export interface JWTPayload {
  sub: string; // user id
  username: string;
  role: string;
  mustChangePassword: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(
  user: { id: string; username: string; role: string; mustChangePassword: boolean },
  rememberMe: boolean = false
): Promise<string> {
  const expiresIn = rememberMe ? '7d' : '24h';

  return new SignJWT({
    sub: user.id,
    username: user.username,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(request: NextRequest): Promise<JWTPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function getCookieName(): string {
  return COOKIE_NAME;
}
