"""Resolve and prepare database URLs (especially SQLite on Windows)."""

import os
import re
import sqlite3
from pathlib import Path
from urllib.parse import unquote

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


def expand_env_vars(value: str) -> str:
    """Expand %VAR% placeholders (Windows-style) in config strings."""

    def replace(match: re.Match[str]) -> str:
        return os.environ.get(match.group(1), match.group(0))

    return re.sub(r"%(\w+)%", replace, value)


def _sqlite_file_path(url: str) -> Path | None:
    if not url.startswith("sqlite") or ":memory:" in url:
        return None

    remainder = url.split("///", 1)[-1]
    db_path_str = unquote(remainder.split("?", 1)[0])
    path = Path(db_path_str)

    if not path.is_absolute():
        path = _BACKEND_ROOT / path

    return path


def prepare_database_url(url: str) -> str:
    """Expand env vars, resolve relative SQLite paths, create parent directories."""
    url = expand_env_vars(url)

    db_path = _sqlite_file_path(url)
    if db_path is None:
        return url

    db_path.parent.mkdir(parents=True, exist_ok=True)

    prefix = url.split("///", 1)[0] + "///"
    query = ""
    if "?" in url.split("///", 1)[-1]:
        query = "?" + url.split("///", 1)[-1].split("?", 1)[1]

    return f"{prefix}{db_path.as_posix()}{query}"


def verify_sqlite_writable(url: str) -> None:
    """Fail fast with a helpful message if SQLite cannot write to the configured path."""
    db_path = _sqlite_file_path(url)
    if db_path is None:
        return

    test_path = db_path.parent / f"{db_path.name}.writetest"
    try:
        conn = sqlite3.connect(str(test_path), timeout=5)
        conn.execute("CREATE TABLE IF NOT EXISTS _writetest (id INTEGER)")
        conn.commit()
        conn.close()
    except sqlite3.OperationalError as exc:
        raise RuntimeError(
            f"SQLite cannot write to '{db_path.parent}'. "
            "On some Windows setups the D: drive blocks SQLite journal files. "
            "Set DATABASE_URL to a path on C:, for example:\n"
            "  DATABASE_URL=sqlite+aiosqlite:///%LOCALAPPDATA%/MedExplain/data/medical.db\n"
            f"Original error: {exc}"
        ) from exc
    finally:
        for extra in ("", "-journal", "-wal", "-shm"):
            try:
                Path(f"{test_path}{extra}").unlink(missing_ok=True)
            except OSError:
                pass
