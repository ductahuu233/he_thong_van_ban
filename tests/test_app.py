from fastapi.testclient import TestClient
from docx import Document
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import DocumentHistory


def make_test_client(tmp_path):
    db_path = tmp_path / "test_app.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def test_get_settings_returns_default_settings(tmp_path):
    client = make_test_client(tmp_path)

    response = client.get("/api/settings")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json() == {
        "id": 1,
        "ten_co_quan": "HỘI ĐỒNG NHÂN DÂN THÀNH PHỐ HÀ NỘI",
        "ten_giam_doc": "Phùng Thị Hồng Hà",
        "chuc_vu": "CHỦ TỊCH",
    }


def test_update_settings_persists_values(tmp_path):
    client = make_test_client(tmp_path)

    response = client.post(
        "/api/settings",
        json={
            "ten_co_quan": "UBND xa kiem thu",
            "ten_giam_doc": "Nguyen Van B",
            "chuc_vu": "Chu tich",
        },
    )
    follow_up = client.get("/api/settings")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert follow_up.json()["ten_co_quan"] == "UBND xa kiem thu"
    assert follow_up.json()["ten_giam_doc"] == "Nguyen Van B"
    assert follow_up.json()["chuc_vu"] == "Chu tich"


def test_root_serves_document_generator_page(tmp_path):
    client = make_test_client(tmp_path)

    response = client.get("/")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "document-form" in response.text
    assert "HỆ THỐNG HỖ TRỢ SOẠN THẢO VĂN BẢN" in response.text
    assert "Thông tin văn bản" in response.text
    assert "Dự thảo nội dung" in response.text


def test_generate_returns_preview_and_word_file(tmp_path):
    client = make_test_client(tmp_path)

    response = client.post(
        "/api/generate",
        data={
            "loai_van_ban": "To trinh",
            "so_ky_hieu": "01/TTr-TEST",
            "ten_co_quan": "Co quan kiem thu",
            "nguoi_ky": "Nguyen Van A",
            "chuc_vu": "Giam doc",
            "trich_yeu": "Ve viec kiem thu tao van ban",
            "user_request": "Soan van ban ngan gon de kiem thu.",
        },
    )

    db = next(app.dependency_overrides[get_db]())
    history_count = db.query(DocumentHistory).count()
    db.close()
    app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert "Soan van ban ngan gon" in payload["preview_text"]
    assert payload["file_url"].startswith("/outputs/")
    assert payload["file_name"].endswith(".docx")
    assert history_count == 1


def test_generate_includes_uploaded_txt_context(tmp_path):
    client = make_test_client(tmp_path)

    response = client.post(
        "/api/generate",
        data={
            "loai_van_ban": "Cong van",
            "so_ky_hieu": "02/CV-TEST",
            "ten_co_quan": "Co quan kiem thu",
            "nguoi_ky": "Nguyen Van A",
            "chuc_vu": "Giam doc",
            "trich_yeu": "Ve viec xu ly file upload",
            "user_request": "Hay tom tat noi dung upload.",
        },
        files={"context_file": ("context.txt", b"Noi dung upload dac biet ABC123", "text/plain")},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert "Noi dung upload dac biet ABC123" in response.json()["preview_text"]


def test_generate_rejects_unsupported_file_type(tmp_path):
    client = make_test_client(tmp_path)

    response = client.post(
        "/api/generate",
        data={"user_request": "Kiem thu file sai dinh dang."},
        files={"context_file": ("context.xlsx", b"bad", "application/octet-stream")},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 400


def test_generate_congvan_template_renders_staff_table(tmp_path):
    client = make_test_client(tmp_path)

    response = client.post(
        "/api/generate",
        data={
            "template_type": "congvan",
            "loai_van_ban": "Cong van",
            "so_ky_hieu": "06/CV-TEST",
            "ten_co_quan": "DOAN NGHI LE CAND",
            "nguoi_ky": "Pham Thanh Vuong",
            "chuc_vu": "TRUONG DOAN",
            "trich_yeu": "cu can bo tham gia hoat dong",
            "user_request": "Cu 2 can bo tham gia hoat dong.",
            "dia_danh": "Ha Noi",
            "don_vi_nhan": "Phong Cong tac chinh tri",
            "staff_list": "Ta Minh Quang | 2000 | HDLD | Ca si\nDo Hoang Bao Ly | 1999 | HDLD | Ca si",
        },
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200

    file_name = response.json()["file_name"]
    document = Document(f"outputs/{file_name}")
    table_text = "\n".join(cell.text for table in document.tables for row in table.rows for cell in row.cells)
    assert "Ta Minh Quang" in table_text
    assert "Do Hoang Bao Ly" in table_text
    assert "HDLD" in table_text
