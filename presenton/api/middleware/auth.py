"""API Key authentication middleware for Presenton FastAPI backend.

Validates the X-API-Key header on all incoming requests against the
PRESENTON_API_KEY environment variable. Returns HTTP 401 for requests
missing or having an invalid API key.

Requests from internal Docker networks (172.16.0.0/12, 10.0.0.0/8,
192.168.0.0/16) are allowed without an API key as a fallback for
service-to-service communication within Docker Compose.
"""

import ipaddress
import os
from typing import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


# Paths that do not require API key authentication
_EXEMPT_PREFIXES = (
    "/api/v1/health",
    "/docs",
    "/openapi.json",
    "/redoc",
)

# Internal Docker network ranges (RFC 1918 private ranges)
_INTERNAL_NETWORKS = (
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
)


def _get_expected_api_key() -> str | None:
    """Read the expected API key from environment."""
    return os.getenv("PRESENTON_API_KEY")


def _is_internal_network(client_host: str | None) -> bool:
    """Check if the client IP belongs to an internal Docker network."""
    if not client_host:
        return False
    try:
        client_ip = ipaddress.ip_address(client_host)
        return any(client_ip in network for network in _INTERNAL_NETWORKS)
    except ValueError:
        return False


def _is_exempt_path(path: str) -> bool:
    """Check if the request path is exempt from API key validation."""
    return any(path.startswith(prefix) for prefix in _EXEMPT_PREFIXES)


class APIKeyAuthMiddleware(BaseHTTPMiddleware):
    """Middleware that enforces API key authentication via X-API-Key header.

    If PRESENTON_API_KEY is not set, all requests are allowed (development mode).
    If set, requests must include a matching X-API-Key header unless:
    - The path is exempt (health check, docs)
    - The request originates from an internal Docker network
    - The request method is OPTIONS (CORS preflight)
    """

    async def dispatch(self, request: Request, call_next: Callable):
        # Always allow OPTIONS (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Allow exempt paths (health check, docs)
        if _is_exempt_path(request.url.path):
            return await call_next(request)

        expected_key = _get_expected_api_key()

        # If no API key is configured, skip validation (development mode)
        if not expected_key:
            return await call_next(request)

        # Check X-API-Key header
        provided_key = request.headers.get("X-API-Key")

        if provided_key and provided_key == expected_key:
            return await call_next(request)

        # Fallback: allow requests from internal Docker network
        client_host = request.client.host if request.client else None
        if _is_internal_network(client_host):
            return await call_next(request)

        # Reject unauthorized requests
        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid or missing API key"},
        )
