"""Shared test setup.

Points the app at a throwaway SQLite file *before* any `src` module is imported,
so the per-test drop_all/create_all fixtures never touch data/surf_forecast.db
(or whatever DATABASE_URL in .env points at).
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TEST_DB = Path(tempfile.gettempdir()) / f"surf_forecast_test_{os.getpid()}.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TEST_DB}"


def pytest_sessionfinish(session, exitstatus):
    _TEST_DB.unlink(missing_ok=True)
