/**
 * Authentication Routes
 *
 * Framework-agnostic handlers for login and token refresh.
 * These functions accept request-like objects and return response-like objects,
 * making them usable with any HTTP framework.
 */

import { SignJWT } from 'jose';

// ---- Types ----

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthErrorResponse {
  error: string;
  message: string;
}

export type RouteResult<T> =
  | { status: 200; body: T }
  | { status: 401; body: AuthErrorResponse }
  | { status: 400; body: AuthErrorResponse };

// ---- Configuration ----

const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d';
const ACCESS_TOKEN_EXPIRY_SECONDS = 3600;

/**
 * Get the JWT secret as a Uint8Array for jose.
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

// ---- Token Generation ----

/**
 * Generate a signed JWT access token.
 */
async function generateAccessToken(payload: {
  sub: string;
  email: string;
  role?: string;
}): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(secret);
}

/**
 * Generate a signed JWT refresh token (longer-lived).
 */
async function generateRefreshToken(payload: {
  sub: string;
  email: string;
}): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ email: payload.email, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(secret);
}

// ---- Route Handlers ----

/**
 * Handle POST /api/auth/login
 *
 * Accepts email and password, validates credentials, and returns
 * JWT access token + refresh token.
 *
 * Note: In a production system, this would validate against a user database.
 * Currently implements a pluggable validation interface.
 */
export async function handleLogin(
  body: LoginRequest,
  validateCredentials?: (email: string, password: string) => Promise<{ sub: string; email: string; role?: string } | null>
): Promise<RouteResult<AuthResponse>> {
  // Validate request body
  if (!body.email || !body.password) {
    return {
      status: 400,
      body: {
        error: 'Bad Request',
        message: 'Email and password are required',
      },
    };
  }

  // Validate credentials
  let user: { sub: string; email: string; role?: string } | null = null;

  if (validateCredentials) {
    user = await validateCredentials(body.email, body.password);
  } else {
    // Default: accept any non-empty credentials (for development/testing)
    // In production, replace with actual database lookup + bcrypt comparison
    user = { sub: body.email, email: body.email, role: 'user' };
  }

  if (!user) {
    return {
      status: 401,
      body: {
        error: 'Unauthorized',
        message: 'Invalid email or password',
      },
    };
  }

  // Generate tokens
  const accessToken = await generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user);

  return {
    status: 200,
    body: {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      tokenType: 'Bearer',
    },
  };
}

/**
 * Handle POST /api/auth/refresh
 *
 * Accepts a refresh token, validates it, and returns a new access token
 * and refresh token pair.
 */
export async function handleRefresh(
  body: RefreshRequest
): Promise<RouteResult<AuthResponse>> {
  if (!body.refreshToken) {
    return {
      status: 400,
      body: {
        error: 'Bad Request',
        message: 'Refresh token is required',
      },
    };
  }

  // Verify the refresh token
  const { jwtVerify } = await import('jose');
  const secret = getJwtSecret();

  try {
    const { payload } = await jwtVerify(body.refreshToken, secret, {
      algorithms: ['HS256'],
    });

    // Ensure it's a refresh token
    if (payload.type !== 'refresh') {
      return {
        status: 401,
        body: {
          error: 'Unauthorized',
          message: 'Invalid token type. Expected a refresh token.',
        },
      };
    }

    const user = {
      sub: payload.sub || '',
      email: (payload.email as string) || '',
      role: payload.role as string | undefined,
    };

    // Generate new token pair
    const accessToken = await generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);

    return {
      status: 200,
      body: {
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
        tokenType: 'Bearer',
      },
    };
  } catch {
    return {
      status: 401,
      body: {
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
      },
    };
  }
}
