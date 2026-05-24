import uvicorn
import argparse
import os
from api.main import app

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the Presenton FastAPI server")
    parser.add_argument(
        "--port", type=int, default=8000, help="Port number to run the server on"
    )
    parser.add_argument(
        "--host", type=str, default="0.0.0.0", help="Host to bind the server to"
    )
    parser.add_argument(
        "--reload", type=str, default="false", help="Reload the server on code changes"
    )
    args = parser.parse_args()
    reload = args.reload == "true"

    # Set the base URL for asset/URL generation
    os.environ.setdefault(
        "PRESENTON_BASE_URL", f"http://{args.host}:{args.port}"
    )

    uvicorn.run(
        "api.main:app",
        host=args.host,
        port=args.port,
        log_level="info",
        reload=reload,
    )
