/**
 * Simulates Nginx reverse proxy routing logic.
 * Determines which upstream service handles a given request path.
 *
 * Routing rules (order matters - most specific first):
 *   /api/v1/*   -> presenton-backend (port 8000)
 *   /api/*      -> ppp-backend (port 4000)
 *   /app_data/* -> presenton-backend (port 8000)
 *   /*          -> frontend (port 3000)
 */

export type UpstreamService = 'presenton-backend' | 'ppp-backend' | 'frontend';

export interface RouteResult {
  service: UpstreamService;
  port: number;
}

/**
 * Resolves a request path to the appropriate upstream service.
 * Mirrors the Nginx location block matching logic.
 */
export function resolveNginxRoute(path: string): RouteResult {
  // Normalize: ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Rule 1: /api/v1/* -> Presenton backend (most specific /api prefix)
  if (normalizedPath.startsWith('/api/v1/') || normalizedPath === '/api/v1') {
    return { service: 'presenton-backend', port: 8000 };
  }

  // Rule 2: /api/* -> PPP backend (generic API)
  if (normalizedPath.startsWith('/api/') || normalizedPath === '/api') {
    return { service: 'ppp-backend', port: 4000 };
  }

  // Rule 3: /app_data/* -> Presenton backend (static assets)
  if (normalizedPath.startsWith('/app_data/') || normalizedPath === '/app_data') {
    return { service: 'presenton-backend', port: 8000 };
  }

  // Rule 4: Everything else -> Frontend
  return { service: 'frontend', port: 3000 };
}
