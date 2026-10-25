"""Pytest configuration and test database isolation fixture for BrandGraph AI."""

import os
import tempfile
from pathlib import Path
import pytest

# Allocate a temporary database for test execution so live brandgraph.sqlite is never polluted
_test_db_fd, _test_db_path = tempfile.mkstemp(suffix="_test.sqlite")
os.close(_test_db_fd)
os.environ["BRANDGRAPH_DB_PATH"] = _test_db_path

import backend.main as main_module
from backend.database import DatabaseManager

# Ensure backend singletons point to test database
main_module.db_manager = DatabaseManager(_test_db_path)
main_module.review_service.db_manager = main_module.db_manager
main_module.eval_runner.db_manager = main_module.db_manager


@pytest.fixture(scope="session", autouse=True)
def isolate_test_database():
    """Yields during test session and cleans up the temporary database afterward."""
    yield
    try:
        if os.path.exists(_test_db_path):
            os.remove(_test_db_path)
    except Exception:
        pass
