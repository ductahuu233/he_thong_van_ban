# Phase 1 FastAPI SQLite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the initial FastAPI project structure and SQLite schema for administrative document generation.

**Architecture:** Keep the first phase intentionally small. `app/main.py` owns the FastAPI app, `app/database.py` owns SQLAlchemy setup and initialization, and `app/models.py` owns ORM table definitions. Tests use a temporary SQLite database so they do not touch `data/app.db`.

**Tech Stack:** Python, FastAPI, Uvicorn, SQLAlchemy, SQLite, Pytest.

---

## File Structure

- Create: `requirements.txt` with runtime and test dependencies.
- Create: `app/__init__.py` to mark the application package.
- Create: `app/main.py` with FastAPI app creation and startup database initialization.
- Create: `app/database.py` with SQLite engine, session factory, declarative base, and `init_db()`.
- Create: `app/models.py` with `UserSettings` and `DocumentHistory`.
- Create: `templates/.gitkeep`, `static/.gitkeep`, `data/.gitkeep`, `outputs/.gitkeep`.
- Create: `tests/test_database.py` with schema creation tests.

## Task 1: Database Schema Test

**Files:**
- Create: `tests/test_database.py`

- [ ] **Step 1: Write the failing test**

```python
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from app.database import Base, init_db


def test_init_db_creates_required_tables(tmp_path):
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}")

    init_db(engine)

    inspector = inspect(engine)
    assert set(inspector.get_table_names()) >= {"user_settings", "document_history"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_database.py -v`

Expected: FAIL because `app.database` does not exist yet.

## Task 2: Minimal Database Implementation

**Files:**
- Create: `app/__init__.py`
- Create: `app/database.py`
- Create: `app/models.py`

- [ ] **Step 1: Implement minimal SQLAlchemy database module and models**

`app/database.py` should expose `Base`, `engine`, `SessionLocal`, `get_db()`, and `init_db(bind=engine)`.

`app/models.py` should define:

- `UserSettings`: `id`, `ten_co_quan`, `ten_giam_doc`, `chuc_vu`.
- `DocumentHistory`: `id`, `loai_van_ban`, `trich_yeu`, `ngay_tao`, `file_path`.

- [ ] **Step 2: Run test to verify it passes**

Run: `pytest tests/test_database.py -v`

Expected: PASS.

## Task 3: FastAPI Entry Point And Folders

**Files:**
- Create: `app/main.py`
- Create: `requirements.txt`
- Create: `templates/.gitkeep`
- Create: `static/.gitkeep`
- Create: `data/.gitkeep`
- Create: `outputs/.gitkeep`

- [ ] **Step 1: Add app entry point**

Create a `FastAPI` instance with a root route returning a simple JSON health message. Register startup logic that calls `init_db()`.

- [ ] **Step 2: Add dependencies**

Add:

```text
fastapi
uvicorn[standard]
sqlalchemy
pytest
```

- [ ] **Step 3: Run final verification**

Run: `pytest -v`

Expected: PASS.

Run: `python -m compileall app tests`

Expected: PASS with no syntax errors.

## Task 4: Commit If Git Exists

**Files:**
- All files created above.

- [ ] **Step 1: Check git repository**

Run: `git status --short`

Expected: If this is not a git repository, skip commit.

- [ ] **Step 2: Commit only if git is initialized**

```bash
git add app tests templates static data outputs requirements.txt docs/superpowers
git commit -m "feat: scaffold fastapi sqlite foundation"
```
