import uvicorn
import argparse
import os
from pathlib import Path


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key or key in os.environ:
            continue

        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        os.environ[key] = value


def _load_local_env_files() -> None:
    root = Path(__file__).resolve().parent
    for candidate in (root / ".env", root.parent / ".env", root.parent / "presenton" / ".env"):
        _load_env_file(candidate)


_load_local_env_files()

from api.main import app

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the FastAPI server")
    parser.add_argument(
        "--port", type=int, default=8000, help="Port number to run the server on"
    )
    parser.add_argument(
        "--reload", type=str, default="false", help="Reload the server on code changes"
    )
    args = parser.parse_args()
    reload = args.reload == "true"
    host = "127.0.0.1"

    # Bind asset/base URL generation to the active runtime port (same env name as Next/Electron).
    os.environ.setdefault("NEXT_PUBLIC_FAST_API", f"http://{host}:{args.port}")
    
    uvicorn.run(
        "api.main:app",
        host=host,
        port=args.port,
        log_level="info",
        reload=reload,
    )
