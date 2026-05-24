import asyncio
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


async def migrate_database_on_startup() -> None:
    """Run Alembic migrations to `head` when MIGRATE_DATABASE_ON_STARTUP is set.

    If Alembic is not installed in the current environment the function logs a
    warning and returns rather than crashing the application import.
    """
    try:
        from alembic.config import Config  # type: ignore
        from alembic import command  # type: ignore
    except Exception:  # pragma: no cover - environment may lack dev deps
        logger.warning("Alembic not available; skipping DB migrations")
        return

    try:
        from utils.get_env import get_migrate_database_on_startup_env
        from utils.db_utils import get_database_url_and_connect_args, to_sync_sqlalchemy_url

        raw = get_migrate_database_on_startup_env()
        if not _is_truthy(raw):
            return

        base = Path(__file__).resolve().parent
        alembic_ini = base / "alembic.ini"
        if not alembic_ini.exists():
            logger.warning("alembic.ini not found at %s; skipping migrations", alembic_ini)
            return

        cfg = Config(str(alembic_ini))
        database_url, _ = get_database_url_and_connect_args()
        cfg.set_main_option("sqlalchemy.url", to_sync_sqlalchemy_url(database_url))

        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, command.upgrade, cfg, "head")
        logger.info("Alembic migrations applied to head")
    except Exception as exc:  # pragma: no cover - defensive, do not crash startup
        logger.exception("Failed to run alembic migrations on startup: %s", exc)
