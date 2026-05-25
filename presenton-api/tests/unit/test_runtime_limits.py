import asyncio
import os
import sys
from unittest.mock import patch

from services.export_task_service import ExportTaskService
from services.liteparse_service import LiteParseService
from utils.runtime_limits import BoundedTextBuffer


def test_bounded_text_buffer_keeps_only_tail():
    buffer = BoundedTextBuffer(limit=5)
    buffer.append("abcdef")
    buffer.append("gh")

    value = buffer.get()

    assert "defgh" in value
    assert "truncated 3 chars" in value


def test_liteparse_plain_bridge_keeps_stdout_and_bounds_stderr(tmp_path):
    service = LiteParseService(timeout_seconds=10)
    service._npm_project_root = str(tmp_path)

    process = service._run_plain_bridge_to_text(
        [
            sys.executable,
            "-c",
            "import sys; sys.stdout.write('x' * 5000); sys.stderr.write('e' * 10000)",
        ]
    )

    assert process.returncode == 0
    assert len(process.stdout) == 5000
    assert "truncated" in process.stderr


def test_export_child_output_is_bounded(tmp_path):
    service = ExportTaskService(timeout_seconds=10)

    result = asyncio.run(
        service._run_bounded_child(
            [
                sys.executable,
                "-c",
                "import sys; sys.stdout.write('o' * 10000); sys.stderr.write('e' * 10000); sys.exit(7)",
            ],
            cwd=str(tmp_path),
            env=os.environ.copy(),
            timeout=10,
        )
    )

    assert result["returncode"] == 7
    assert "truncated" in str(result["stdout"])
    assert "truncated" in str(result["stderr"])


def test_export_build_node_env_uses_system_browser(monkeypatch):
    monkeypatch.setenv("APP_DATA_DIRECTORY", "/tmp/presenton-app")
    monkeypatch.setenv("NEXT_PUBLIC_FAST_API", "http://127.0.0.1:8000")
    monkeypatch.delenv("PUPPETEER_EXECUTABLE_PATH", raising=False)
    monkeypatch.delenv("PUPPETEER_SKIP_DOWNLOAD", raising=False)

    service = ExportTaskService(timeout_seconds=10)
    service.converter_path = "/tmp/convert"

    with patch.object(
        ExportTaskService,
        "_resolve_browser_executable",
        return_value="/usr/bin/chromium",
    ):
        env = service._build_node_env()

    assert env["PUPPETEER_EXECUTABLE_PATH"] == "/usr/bin/chromium"
    assert env["PUPPETEER_SKIP_DOWNLOAD"] == "true"


def test_export_build_node_env_recovers_from_missing_configured_browser(monkeypatch):
    monkeypatch.setenv("APP_DATA_DIRECTORY", "/tmp/presenton-app")
    monkeypatch.setenv("NEXT_PUBLIC_FAST_API", "http://127.0.0.1:8000")
    monkeypatch.setenv("PUPPETEER_EXECUTABLE_PATH", "/missing/chrome")
    monkeypatch.setenv("CHROME_BIN", "/missing/chrome")
    monkeypatch.delenv("PUPPETEER_SKIP_DOWNLOAD", raising=False)

    service = ExportTaskService(timeout_seconds=10)
    service.converter_path = "/tmp/convert"

    with patch("os.path.isfile", return_value=False):
        with patch.object(
            ExportTaskService,
            "_resolve_browser_executable",
            return_value="/workspace/tmp/chrome/chrome-linux64/chrome",
        ):
            env = service._build_node_env()

    assert env["PUPPETEER_EXECUTABLE_PATH"] == "/workspace/tmp/chrome/chrome-linux64/chrome"
    assert env["CHROME_BIN"] == "/workspace/tmp/chrome/chrome-linux64/chrome"
    assert env["PUPPETEER_SKIP_DOWNLOAD"] == "true"


def test_converter_compatibility_error_for_old_glibc(monkeypatch):
    monkeypatch.delenv("SKIP_EXPORT_CONVERTER_GLIBC_CHECK", raising=False)
    monkeypatch.setattr(
        ExportTaskService,
        "_linux_glibc_version",
        staticmethod(lambda: (2, 31)),
    )

    detail = ExportTaskService._converter_compatibility_error(
        "/tmp/presentation-export/py/convert-linux-x64"
    )

    assert detail is not None
    assert "glibc is 2.31" in detail
    assert "GLIBC_2.35+" in detail


def test_resolve_converter_path_prefers_env_override(monkeypatch):
    monkeypatch.setenv("BUILT_PYTHON_MODULE_PATH", "/opt/presenton/convert-custom")

    result = ExportTaskService._resolve_converter_path("/tmp/presentation-export")

    assert result == "/opt/presenton/convert-custom"
