# Phase 1 FastAPI SQLite Design

## Scope

Build the initial project foundation for a FastAPI web application that will later generate administrative Word documents. This phase only creates the folder structure, a basic FastAPI entry point, and SQLite database models.

## Structure

- `app/main.py`: FastAPI application entry point.
- `app/database.py`: SQLAlchemy engine, session factory, and database initialization helper.
- `app/models.py`: SQLAlchemy ORM models.
- `templates/`: Future HTML templates.
- `static/`: Future CSS and JavaScript assets.
- `data/`: SQLite database and Word template storage.
- `outputs/`: Generated Word files.
- `tests/`: Focused tests for database setup.
- `requirements.txt`: Python runtime and test dependencies.

## Database

SQLite database path: `data/app.db`.

Tables:

- `user_settings`: `id`, `ten_co_quan`, `ten_giam_doc`, `chuc_vu`.
- `document_history`: `id`, `loai_van_ban`, `trich_yeu`, `ngay_tao`, `file_path`.

The app creates tables on startup through a small `init_db()` helper. This keeps startup simple while leaving room for Alembic migrations later if the schema grows.

## Testing

Add a database test that uses a temporary SQLite file and verifies both required tables are created. This establishes the expected schema behavior before implementation.

## Out Of Scope

This phase does not implement file upload, AI calls, Word rendering, API endpoints beyond the basic app entry point, or frontend behavior.
