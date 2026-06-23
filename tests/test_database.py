from sqlalchemy import create_engine, inspect

from app.database import init_db


def test_init_db_creates_required_tables(tmp_path):
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}")

    init_db(engine)

    inspector = inspect(engine)
    assert set(inspector.get_table_names()) >= {"user_settings", "document_history"}
