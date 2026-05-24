/**
 * JWT Authentication Middleware
 *
 * Framework-agnostic middleware for verifying JWT tokens using the `jose` library.
 * Extracts Bearer token from Authorization header, verifies it, and returns
 * the decoded payload or an error response.
 */

import { jwtVerify, type JWTPayload } from 'jose';

// ---- Types ----

/**
 * Decoded user context from a valid JWT token.
 */
export interface AuthUser {
  sub: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/**
 * Result of authentication: either a valid user or an error.
 */
export type AuthResult =
  | { success: true; user: AuthUser }
  | { success: false; status: 401; body: { error: string; message: string } };

/**
 * Minimal request-like object for framework-agnostic usage.
 */
export interface AuthRequest {
  headers: {
    authorization?: string;
    [key: string]: string | undefined;
  };
  url?: string;
  path?: string;
}

// ---- Configuration ----

/**
 * Paths that do not require authentication.
 */
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/refresh',
];

/**
 * Get the JWT secret as a Uint8Array for jose.
 * Reads from JWT_SECRET environment variable.
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

// ---- Core Functions ----

/**
 * Check if a given path is public (does not require authentication).
 */
export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((publicPath) => path === publicPath || path.startsWith(publicPath + '?'));
}

/**
 * Extract Bearer token from the Authorization header value.
 * Returns null if the header is missing or malformed.
 */
export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) return null;
  const parts = authorizationHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  const token = parts[1];
  if (!token || token.trim() === '') return null;
  return token;
}

/**
 * Verify a JWT token and return the decoded payload.
 * Returns null if the token is invalid or expired.
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch {
    return null;
  }
}

/**
 * Authenticate a request by extracting and verifying the JWT token.
 *
 * This is the main entry point for authentication. It:
 * 1. Checks if the path is public (skips auth)
 * 2. Extracts the Bearer token from the Authorization header
 * 3. Verifies the token using jose's jwtVerify
 * 4. Returns the decoded user or an HTTP 401 error
 *
 * @param request - A minimal request object with headers and optional path
 * @returns AuthResult - Either { success: true, user } or { success: false, status: 401, body }
 */
export async function authenticate(request: AuthRequest): Promise<AuthResult> {
  // Check if path is public
  const path = request.path || request.url || '';
  if (isPublicPath(path)) {
    // For public paths, return a placeholder user (auth not required)
    return {
      success: true,
      user: { sub: 'anonymous', email: '' },
    };
  }

  // Extract Bearer token
  const token = extractBearerToken(request.headers.authorization);
  if (!token) {
    return {
      success: false,
      status: 401,
      body: {
        error: 'Unauthorized',
        message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
      },
    };
  }

  // Verify token
  const payload = await verifyToken(token);
  if (!payload) {
    return {
      success: false,
      status: 401,
      body: {
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      },
    };
  }

  // Build user context from payload
  const user: AuthUser = {
    sub: (payload.sub as string) || '',
    email: (payload.email as string) || '',
    role: payload.role as string | undefined,
    iat: payload.iat,
    exp: payload.exp,
  };

  return { success: true, user };
}

/**
 * Convenience function to create an HTTP 401 JSON response body.
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): {
  status: 401;
  body: { error: string; message: string };
} {
  return {
    status: 401,
    body: { error: 'Unauthorized', message },
  };
}
