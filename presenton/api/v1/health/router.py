"""Health check endpoint for Presenton backend.

Provides a GET /api/v1/health endpoint that returns service status
and basic readiness information including database connectivity.
"""

import logging

from fastapi import APIRouter
from sqlalchemy import text

from services.database import sql_engine

logger = logging.getLogger(__name__)

API_V1_HEALTH_ROUTER = APIRouter(prefix="/api/v1/health", tags=["Health"])


@API_V1_HEALTH_ROUTER.get(
    "",
    summary="Health check",
    description="Returns service status and database connectivity.",
)
async def health_check():
    """Health check endpoint returning service status.

    Includes a basic database connectivity probe.
    """
    db_status = "ok"
    try:
        async with sql_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        logger.warning("Health check DB probe failed: %s", exc)
        db_status = "unavailable"

    return {
        "status": "ok",
        "service": "presenton",
        "database": db_status,
    }
