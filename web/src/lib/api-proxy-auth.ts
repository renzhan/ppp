/**
 * API Proxy Authentication Gateway
 *
 * Encapsulates the JWT validation logic used by all /api/ppt/* proxy routes.
 * This module provides a pure function that determines whether a request
 * should be forwarded to Presenton API or rejected with 401.
 *
 * Pattern: All /api/ppt/* routes call getSession(request) first.
 * If session is null → return 401, do NOT forward.
 * If session is valid → forward to Presenton at localhost:8000.
 */

export interface ProxySession {
  sub: string;
  username: string;
  role: string;
  mustChangePassword: boolean;
}

export interface ProxyDecision {
  /** Whether the request should be forwarded to Presenton API */
  shouldForward: boolean;
  /** HTTP status code to return if not forwarding */
  statusCode: number;
  /** The internal URL to forward to (only set when shouldForward is true) */
  forwardUrl?: string;
}

const PRESENTON_INTERNAL_URL = process.env.PRESENTON_INTERNAL_URL || 'http://localhost:8000';

/**
 * Determines whether a request to /api/ppt/* should be forwarded to Presenton API.
 *
 * @param session - The result of getSession(request). null means invalid/missing JWT.
 * @param subpath - The path segment after /api/ppt/ (e.g., "chat", "health", "presentation/prepare")
 * @returns ProxyDecision indicating whether to forward or reject
 */
export function makeProxyDecision(
  session: ProxySession | null,
  subpath: string
): ProxyDecision {
  // JWT validation: if no valid session, reject with 401
  if (!session) {
    return {
      shouldForward: false,
      statusCode: 401,
    };
  }

  // Valid session: forward to Presenton API
  // Path mapping: /api/ppt/{subpath} → http://localhost:8000/api/v1/ppt/{subpath}
  const forwardUrl = `${PRESENTON_INTERNAL_URL}/api/v1/ppt/${subpath}`;

  return {
    shouldForward: true,
    statusCode: 200,
    forwardUrl,
  };
}

/**
 * Strips PPP authentication headers from the forwarded request.
 * Presenton API is an internal service and should not receive auth headers.
 *
 * @param headers - Original request headers
 * @returns Cleaned headers without auth-related entries
 */
export function stripAuthHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const cleaned = { ...headers };
  // Remove PPP auth headers
  delete cleaned['authorization'];
  delete cleaned['Authorization'];
  delete cleaned['cookie'];
  delete cleaned['Cookie'];
  // Keep content-type and other non-auth headers
  return cleaned;
}
