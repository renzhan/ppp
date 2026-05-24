"""Property-based test for API Key Authentication Enforcement.

**Property 7: API Key Authentication Enforcement**

For any request to Presenton_Backend that lacks a valid API key in the
X-API-Key header, the Presenton_Backend SHALL return HTTP 401 Unauthorized
regardless of the endpoint or request payload.

**Validates: Requirements 6.2, 6.6, 13.4**
"""

import os
from unittest.mock import patch

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st
from fastapi import FastAPI
from starlette.testclient import TestClient

# Import the middleware directly (no app-level dependencies)
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from api.middleware.auth import APIKeyAuthMiddleware


VALID_API_KEY = "test-secret-api-key-12345"


def _create_test_app() -> FastAPI:
    """Create a minimal FastAPI app with only the API key middleware."""
    app = FastAPI()
    app.add_middleware(APIKeyAuthMiddleware)

    @app.get("/api/v1/ppt/presentation/generate")
    async def generate():
        return {"status": "ok"}

    @app.post("/api/v1/ppt/presentation/generate")
    async def generate_post():
        return {"status": "ok"}

    @app.get("/api/v1/ppt/presentation/{id}")
    async def get_presentation(id: str):
        return {"id": id}

    @app.post("/api/v1/ppt/presentation/edit")
    async def edit():
        return {"status": "ok"}

    @app.post("/api/v1/ppt/presentation/export/pptx")
    async def export_pptx():
        return {"status": "ok"}

    @app.get("/api/v1/ppt/fonts")
    async def get_fonts():
        return []

    @app.get("/api/v1/ppt/icons/search")
    async def search_icons():
        return []

    @app.get("/api/v1/ppt/themes")
    async def get_themes():
        return []

    @app.post("/api/v1/ppt/chat")
    async def chat():
        return {"response": "ok"}

    @app.post("/api/v1/ppt/outline/generate")
    async def outline():
        return {"outline": []}

    @app.post("/api/v1/ppt/images/generate")
    async def images():
        return {"url": ""}

    @app.post("/api/v1/webhook/codex/callback")
    async def webhook():
        return {"status": "ok"}

    @app.get("/api/v1/health")
    async def health():
        return {"status": "ok"}

    return app


# Strategy for generating arbitrary API endpoint paths
api_paths = st.sampled_from([
    "/api/v1/ppt/presentation/generate",
    "/api/v1/ppt/presentation/edit",
    "/api/v1/ppt/presentation/export/pptx",
    "/api/v1/ppt/fonts",
    "/api/v1/ppt/icons/search",
    "/api/v1/ppt/themes",
    "/api/v1/ppt/chat",
    "/api/v1/ppt/outline/generate",
    "/api/v1/ppt/images/generate",
    "/api/v1/webhook/codex/callback",
])

# Strategy for generating arbitrary request payloads
json_payloads = st.one_of(
    st.none(),
    st.fixed_dictionaries({
        "content": st.text(min_size=0, max_size=50),
    }),
    st.fixed_dictionaries({
        "title": st.text(min_size=1, max_size=30),
        "n_slides": st.integers(min_value=1, max_value=50),
    }),
)

# Strategy for generating invalid API keys (ASCII-safe for HTTP headers)
invalid_api_keys = st.one_of(
    st.none(),  # No key provided
    st.just(""),  # Empty string
    st.text(
        alphabet=st.characters(min_codepoint=32, max_codepoint=126),
        min_size=1,
        max_size=100,
    ),  # Random ASCII strings
)

# HTTP methods to test
http_methods = st.sampled_from(["GET", "POST", "PUT", "DELETE", "PATCH"])


@given(
    path=api_paths,
    method=http_methods,
    invalid_key=invalid_api_keys,
    payload=json_payloads,
)
@settings(max_examples=50, deadline=5000)
def test_requests_without_valid_api_key_receive_401(
    path, method, invalid_key, payload
):
    """Property: All requests without a valid X-API-Key receive HTTP 401.

    **Validates: Requirements 6.2, 6.6, 13.4**
    """
    # Ensure the invalid key is not accidentally the valid key
    assume(invalid_key != VALID_API_KEY)

    headers = {}
    if invalid_key is not None:
        headers["X-API-Key"] = invalid_key

    with patch.dict(os.environ, {"PRESENTON_API_KEY": VALID_API_KEY}):
        app = _create_test_app()
        client = TestClient(app, raise_server_exceptions=False)

        kwargs = {"headers": headers}
        if method in ("POST", "PUT", "PATCH") and payload is not None:
            kwargs["json"] = payload

        response = client.request(method, path, **kwargs)

    assert response.status_code == 401, (
        f"Expected 401 for {method} {path} with key={invalid_key!r}, "
        f"got {response.status_code}"
    )


@given(
    path=api_paths,
    method=http_methods,
    payload=json_payloads,
)
@settings(max_examples=30, deadline=5000)
def test_requests_with_valid_api_key_are_not_rejected_as_401(
    path, method, payload
):
    """Property: Requests with valid X-API-Key are NOT rejected with 401.

    They may get other errors (404, 405, 422) but never 401 from the
    API key middleware.

    **Validates: Requirements 6.2, 6.6, 13.4**
    """
    headers = {"X-API-Key": VALID_API_KEY}

    with patch.dict(os.environ, {"PRESENTON_API_KEY": VALID_API_KEY}):
        app = _create_test_app()
        client = TestClient(app, raise_server_exceptions=False)

        kwargs = {"headers": headers}
        if method in ("POST", "PUT", "PATCH") and payload is not None:
            kwargs["json"] = payload

        response = client.request(method, path, **kwargs)

    assert response.status_code != 401, (
        f"Got 401 for {method} {path} even with valid API key"
    )
