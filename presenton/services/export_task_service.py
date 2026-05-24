import asyncio
import json
import logging
import os
import shutil
import subprocess
import tempfile
from typing import Literal, Mapping

from fastapi import HTTPException
from pydantic import BaseModel, ValidationError, model_validator

from services.liteparse_service import _command_str, _snippet
from utils.asset_directory_utils import resolve_app_path_to_filesystem
from utils.get_env import get_app_data_directory_env, get_temp_directory_env
from utils.icon_weights import DEFAULT_ICON_WEIGHT, extract_icon_weight_from_settings
from utils.runtime_limits import (
    BoundedTextBuffer,
    log_memory,
)

LOGGER = logging.getLogger(__name__)

EXPORT_DIRECTORY_MODE = 0o755
EXPORT_FILE_MODE = 0o644


def _windows_hidden_subprocess_kwargs() -> dict[str, object]:
    if os.name != "nt":
        return {}
    return {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0)}


class PptxToHtmlDocument(BaseModel):
    slides: list[str]
    font_css: str = ""
    width: float
    height: float
    images_dir: str
    fonts_dir: str


class PresentationExportTaskResult(BaseModel):
    path: str


class ExtractSchemaSlide(BaseModel):
    id: str
    name: str | None = None
    description: str | None = None
    json_schema: dict


class ExtractSchemaDocument(BaseModel):
    name: str
    ordered: bool = False
    icon_weight: str = DEFAULT_ICON_WEIGHT
    slides: list[ExtractSchemaSlide]

    @model_validator(mode="before")
    @classmethod
    def normalize_icon_weight(cls, data):
        if isinstance(data, dict):
            normalized = dict(data)
            normalized["icon_weight"] = extract_icon_weight_from_settings(normalized)
            return normalized
        return data


class ExportTaskService:
    def __init__(self, timeout_seconds: int = 300):
        self.timeout_seconds = timeout_seconds
        self.node_binary = os.getenv("LITEPARSE_NODE_BINARY", "node")
        self.export_dir = self._resolve_export_dir()
        self.entrypoint_path = self._resolve_entrypoint_path(self.export_dir)
        self.converter_path = self._resolve_converter_path(self.export_dir)

    @staticmethod
    def _resolve_export_dir() -> str:
        configured = (os.getenv("EXPORT_RUNTIME_DIR") or "").strip()
        if configured:
            return configured

        package_root = (os.getenv("EXPORT_PACKAGE_ROOT") or "").strip()
        if package_root:
            return package_root

        cwd = os.path.abspath(".")
        service_dir = os.path.dirname(__file__)
        candidates = [
            os.path.abspath(os.path.join(cwd, "..", "..", "presentation-export")),
            os.path.abspath(os.path.join(cwd, "..", "presentation-export")),
            os.path.abspath(os.path.join(service_dir, "..", "..", "..", "presentation-export")),
            os.path.abspath(os.path.join(service_dir, "..", "..", "..", "..", "presentation-export")),
        ]

        for candidate in candidates:
            if os.path.isfile(os.path.join(candidate, "index.cjs")) or os.path.isfile(
                os.path.join(candidate, "index.js")
            ):
                return candidate

        return candidates[0]

    @staticmethod
    def _resolve_entrypoint_path(export_dir: str) -> str:
        index_cjs = os.path.join(export_dir, "index.cjs")
        if os.path.isfile(index_cjs):
            return index_cjs

        index_js = os.path.join(export_dir, "index.js")
        if os.path.isfile(index_js):
            # Packaged app resource directories can be read-only (e.g. /opt installs).
            # Try to create index.cjs for compatibility, but fall back to index.js
            # when writing is not permitted.
            try:
                shutil.copyfile(index_js, index_cjs)
                return index_cjs
            except OSError:
                return index_js

        return index_cjs

    @staticmethod
    def _resolve_converter_path(export_dir: str) -> str:
        configured = (os.getenv("BUILT_PYTHON_MODULE_PATH") or "").strip()
        if configured:
            return configured

        py_dir = os.path.join(export_dir, "py")
        extension = ".exe" if os.name == "nt" else ""
        platform_name = sys_platform()
        arch_name = sys_arch()
        candidates = [
            os.path.join(py_dir, f"convert-{platform_name}-{arch_name}{extension}"),
            os.path.join(py_dir, f"convert-{platform_name}{extension}"),
            os.path.join(py_dir, f"convert{extension}"),
            os.path.join(py_dir, "convert"),
        ]
        for candidate in candidates:
            if candidate and os.path.isfile(candidate):
                return candidate
        return candidates[1]

    @staticmethod
    def _linux_glibc_version() -> tuple[int, ...] | None:
        if os.name == "nt":
            return None

        try:
            raw = os.confstr("CS_GNU_LIBC_VERSION")
        except (AttributeError, OSError, ValueError):
            return None

        if not raw:
            return None

        parts = raw.strip().split()
        if len(parts) < 2:
            return None

        version_parts: list[int] = []
        for segment in parts[-1].split("."):
            if not segment.isdigit():
                break
            version_parts.append(int(segment))

        return tuple(version_parts) or None

    @classmethod
    def _converter_compatibility_error(cls, converter_path: str) -> str | None:
        if os.getenv("SKIP_EXPORT_CONVERTER_GLIBC_CHECK", "").strip().lower() == "true":
            return None

        converter_name = os.path.basename(converter_path)
        if not converter_name.startswith("convert-linux"):
            return None

        glibc_version = cls._linux_glibc_version()
        if not glibc_version:
            return None

        if glibc_version >= (2, 35):
            return None

        current = ".".join(str(part) for part in glibc_version)
        return (
            "Bundled export converter is incompatible with this Linux runtime. "
            f"Current glibc is {current}, but the bundled converter requires GLIBC_2.35+. "
            "Use a newer WSL distro (Ubuntu 22.04+), run the compatible Docker image, "
            "or provide a compatible converter via BUILT_PYTHON_MODULE_PATH."
        )

    def _build_node_env(self) -> Mapping[str, str]:
        env = os.environ.copy()

        app_data_directory = get_app_data_directory_env()
        if not app_data_directory:
            raise HTTPException(
                status_code=500,
                detail="APP_DATA_DIRECTORY must be set for PPTX-to-HTML export",
            )
        env["APP_DATA_DIRECTORY"] = app_data_directory

        temp_directory = get_temp_directory_env() or os.path.join(
            tempfile.gettempdir(), "presenton"
        )
        os.makedirs(temp_directory, exist_ok=True)
        env["TEMP_DIRECTORY"] = temp_directory

        fastapi_base = (os.getenv("NEXT_PUBLIC_FAST_API") or "").strip()
        if not fastapi_base:
            raise HTTPException(
                status_code=500,
                detail="NEXT_PUBLIC_FAST_API must be set for PPTX-to-HTML export",
            )
        env["ASSETS_BASE_URL"] = f"{fastapi_base.rstrip('/')}/app_data"
        env["BUILT_PYTHON_MODULE_PATH"] = self.converter_path

        configured_browser = (env.get("PUPPETEER_EXECUTABLE_PATH") or "").strip()
        if configured_browser and not os.path.isfile(configured_browser):
            LOGGER.warning(
                "[export_runtime] configured browser missing path=%s; falling back to auto-detection",
                configured_browser,
            )
            env.pop("PUPPETEER_EXECUTABLE_PATH", None)

        configured_chrome_bin = (env.get("CHROME_BIN") or "").strip()
        if configured_chrome_bin and not os.path.isfile(configured_chrome_bin):
            LOGGER.warning(
                "[export_runtime] configured CHROME_BIN missing path=%s; falling back to auto-detection",
                configured_chrome_bin,
            )
            env.pop("CHROME_BIN", None)

        browser_executable = (env.get("PUPPETEER_EXECUTABLE_PATH") or "").strip()
        if not browser_executable:
            browser_executable = self._resolve_browser_executable()

        if browser_executable:
            env["PUPPETEER_EXECUTABLE_PATH"] = browser_executable
            env["CHROME_BIN"] = browser_executable
            env.setdefault("PUPPETEER_SKIP_DOWNLOAD", "true")
            LOGGER.info(
                "[export_runtime] using browser executable path=%s",
                browser_executable,
            )
        else:
            LOGGER.warning("[export_runtime] no browser executable detected for export runtime")

        return env

    @staticmethod
    def _resolve_browser_executable() -> str | None:
        explicit = (os.getenv("CHROME_BIN") or "").strip()
        if explicit and os.path.isfile(explicit):
            return explicit

        service_dir = os.path.dirname(__file__)
        local_candidates = (
            os.path.abspath(
                os.path.join(
                    service_dir, "..", "..", "..", "tmp", "chrome", "chrome-linux64", "chrome"
                )
            ),
            os.path.abspath(
                os.path.join(
                    service_dir,
                    "..",
                    "..",
                    "..",
                    "app_data",
                    "chrome",
                    "chrome-linux64",
                    "chrome",
                )
            ),
        )
        for candidate in local_candidates:
            if os.path.isfile(candidate):
                return candidate

        candidates = (
            "google-chrome",
            "google-chrome-stable",
            "chromium",
            "chromium-browser",
            "chrome",
        )
        for candidate in candidates:
            resolved = shutil.which(candidate)
            if resolved:
                return resolved

        common_paths = (
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/snap/bin/chromium",
        )
        for candidate in common_paths:
            if os.path.isfile(candidate):
                return candidate

        return None

    def _ensure_runtime_ready(self) -> None:
        if not os.path.isfile(self.entrypoint_path):
            raise HTTPException(
                status_code=500,
                detail=f"Export runtime not found at {self.entrypoint_path}",
            )
        if not os.path.isfile(self.converter_path):
            raise HTTPException(
                status_code=500,
                detail=f"Export converter binary not found at {self.converter_path}",
            )
        compatibility_error = self._converter_compatibility_error(self.converter_path)
        if compatibility_error:
            raise HTTPException(status_code=500, detail=compatibility_error)

    @staticmethod
    def _resolve_output_path(response_data: dict) -> str:
        path_value = response_data.get("path")
        if isinstance(path_value, str):
            resolved = resolve_app_path_to_filesystem(path_value) or path_value
            if os.path.isfile(resolved):
                return resolved

        url_value = response_data.get("url")
        if isinstance(url_value, str):
            resolved = resolve_app_path_to_filesystem(url_value)
            if resolved and os.path.isfile(resolved):
                return resolved

        raise HTTPException(
            status_code=500,
            detail="PPTX-to-HTML task completed without a valid output path",
        )

    @staticmethod
    def _ensure_output_readable(output_path: str) -> None:
        try:
            os.chmod(os.path.dirname(output_path), EXPORT_DIRECTORY_MODE)
            os.chmod(output_path, EXPORT_FILE_MODE)
        except OSError as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Export completed but output permissions could not be updated: {exc}",
            ) from exc

    @staticmethod
    def _create_task_paths() -> tuple[str, str, str]:
        temp_root = get_temp_directory_env() or os.path.join(
            tempfile.gettempdir(), "presenton"
        )
        os.makedirs(temp_root, exist_ok=True)
        temp_dir = tempfile.mkdtemp(prefix="export-task-", dir=temp_root)
        task_path = os.path.join(temp_dir, "export_task.json")
        response_path = os.path.join(temp_dir, "export_task.response.json")
        return temp_dir, task_path, response_path

    async def _run_task(self, task_payload: dict, response_error_detail: str) -> dict:
        return await self._run_task_locked(task_payload, response_error_detail)

    async def _run_task_locked(self, task_payload: dict, response_error_detail: str) -> dict:
        self._ensure_runtime_ready()
        temp_dir, task_path, response_path = self._create_task_paths()

        try:
            with open(task_path, "w", encoding="utf-8") as task_file:
                json.dump(task_payload, task_file)

            log_memory(
                LOGGER,
                "export_task.spawn",
                task_type=task_payload.get("type"),
            )
            result = await self._run_bounded_child(
                [self.node_binary, self.entrypoint_path, task_path],
                cwd=self.export_dir,
                timeout=self.timeout_seconds,
                env=dict(self._build_node_env()),
            )
            log_memory(
                LOGGER,
                "export_task.exit",
                task_type=task_payload.get("type"),
                returncode=result["returncode"],
            )

            if result["returncode"] != 0:
                LOGGER.error(
                    "[export_runtime] child failed task_type=%s returncode=%s stderr=%s stdout=%s",
                    task_payload.get("type"),
                    result["returncode"],
                    result["stderr"],
                    result["stdout"],
                )
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Export task failed. "
                        f"stderr={_snippet(result['stderr'])} stdout={_snippet(result['stdout'])}"
                    ),
                )

            if not os.path.isfile(response_path):
                raise HTTPException(
                    status_code=500,
                    detail=response_error_detail,
                )

            with open(response_path, "r", encoding="utf-8") as response_file:
                return json.load(response_file)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=500,
                detail="Export task produced invalid JSON output",
            ) from exc
        except OSError as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to run export task: {exc}",
            ) from exc
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    async def _run_bounded_child(
        self,
        command: list[str],
        *,
        cwd: str,
        env: dict[str, str],
        timeout: int,
    ) -> dict[str, str | int]:
        stdout_tail = BoundedTextBuffer()
        stderr_tail = BoundedTextBuffer()
        process = await asyncio.create_subprocess_exec(
            *command,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
            **_windows_hidden_subprocess_kwargs(),
        )

        LOGGER.info(
            "[export_runtime] child started pid=%s command=%s",
            process.pid,
            _command_str(command),
        )

        async def drain(
            stream: asyncio.StreamReader | None,
            tail: BoundedTextBuffer,
            label: str,
        ) -> None:
            if stream is None:
                return
            while True:
                chunk = await stream.read(65536)
                if not chunk:
                    break
                tail.append(chunk)
                LOGGER.debug("[export_runtime] %s chunk=%s bytes", label, len(chunk))

        stdout_task = asyncio.create_task(drain(process.stdout, stdout_tail, "stdout"))
        stderr_task = asyncio.create_task(drain(process.stderr, stderr_tail, "stderr"))
        try:
            await asyncio.wait_for(
                asyncio.gather(process.wait(), stdout_task, stderr_task),
                timeout=timeout,
            )
        except asyncio.TimeoutError as exc:
            process.kill()
            await process.wait()
            await asyncio.gather(stdout_task, stderr_task, return_exceptions=True)
            raise HTTPException(
                status_code=500,
                detail=f"Export task timed out after {timeout} seconds",
            ) from exc

        LOGGER.info(
            "[export_runtime] child exited pid=%s returncode=%s",
            process.pid,
            process.returncode,
        )
        return {
            "returncode": process.returncode if process.returncode is not None else -1,
            "stdout": stdout_tail.get(),
            "stderr": stderr_tail.get(),
        }

    async def export_from_url(
        self,
        url: str,
        title: str,
        export_as: Literal["pdf", "pptx"],
        fastapi_url: str | None = None,
        cookie_header: str | None = None,
    ) -> PresentationExportTaskResult:
        LOGGER.info(
            "[export_runtime] export_from_url url=%s format=%s cookie_header=%s",
            url,
            export_as,
            "set" if cookie_header else "empty",
        )
        response_data = await self._run_task(
            {
                "type": "export",
                "url": url,
                "format": export_as,
                "title": title,
                "fastapiUrl": fastapi_url or None,
                "cookieHeader": cookie_header or None,
            },
            "Export task did not produce a response file",
        )

        output_path = self._resolve_output_path(response_data)
        self._ensure_output_readable(output_path)

        return PresentationExportTaskResult(
            path=output_path,
        )

    async def convert_pptx_to_html(
        self, pptx_path: str, get_fonts: bool = False
    ) -> PptxToHtmlDocument:
        if not os.path.isfile(pptx_path):
            raise HTTPException(status_code=400, detail=f"PPTX not found: {pptx_path}")

        try:
            response_data = await self._run_task(
                {
                    "type": "pptx-to-html",
                    "pptx_path": pptx_path,
                    "get_fonts": get_fonts,
                },
                "PPTX-to-HTML export task did not produce a response file",
            )

            output_path = self._resolve_output_path(response_data)
            with open(output_path, "r", encoding="utf-8") as output_file:
                output_data = json.load(output_file)

            return PptxToHtmlDocument(**output_data)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=500,
                detail="PPTX-to-HTML export produced invalid JSON output",
            ) from exc

    async def extract_schema(self, url: str) -> ExtractSchemaDocument:
        LOGGER.info(
            "[export_runtime] extract_schema spawn "
            "url=%s entrypoint=%s export_dir=%s",
            url,
            self.entrypoint_path,
            self.export_dir,
        )
        try:
            response_data = await self._run_task(
                {
                    "type": "extract-schema",
                    "url": url,
                },
                "Extract-schema task did not produce a response file",
            )
            slides = response_data.get("slides") if isinstance(response_data, dict) else None
            slide_n = len(slides) if isinstance(slides, list) else "?"
            LOGGER.info(
                "[export_runtime] extract_schema node finished url=%s "
                "response_name=%r ordered=%s icon_weight=%s slides=%s",
                url,
                response_data.get("name") if isinstance(response_data, dict) else None,
                response_data.get("ordered") if isinstance(response_data, dict) else None,
                response_data.get("icon_weight") if isinstance(response_data, dict) else None,
                slide_n,
            )
            return ExtractSchemaDocument(**response_data)
        except ValidationError as exc:
            LOGGER.exception(
                "[export_runtime] extract_schema pydantic validation failed url=%s",
                url,
            )
            raise HTTPException(
                status_code=500,
                detail="Extract-schema task produced invalid output",
            ) from exc


def sys_platform() -> str:
    if os.name == "nt":
        return "win32"
    return os.sys.platform


def sys_arch() -> str:
    machine = (os.environ.get("PROCESSOR_ARCHITECTURE") or "").lower()
    if not machine and hasattr(os, "uname"):
        machine = os.uname().machine.lower()

    arch_map = {
        "x86_64": "x64",
        "amd64": "x64",
        "x64": "x64",
        "aarch64": "arm64",
        "arm64": "arm64",
    }
    return arch_map.get(machine, machine or "x64")


EXPORT_TASK_SERVICE = ExportTaskService()
