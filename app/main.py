from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import BASE_DIR, get_db, init_db
from app.models import DocumentHistory, UserSettings
from app.services.ai_client import DEFAULT_SYSTEM_PROMPT, generate_ai_text
from app.services.file_reader import extract_text_from_upload
from app.services.word_renderer import render_word_document


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Administrative Document Generator", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
app.mount("/outputs", StaticFiles(directory=BASE_DIR / "outputs"), name="outputs")

INDEX_HTML = BASE_DIR / "templates" / "index.html"


class SettingsUpdate(BaseModel):
    ten_co_quan: str = ""
    ten_giam_doc: str = ""
    chuc_vu: str = ""


def get_or_create_settings(db: Session) -> UserSettings:
    settings = db.query(UserSettings).order_by(UserSettings.id).first()
    if settings is None:
        settings = UserSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def parse_staff_list(raw_text: str) -> list[dict[str, str]]:
    staff: list[dict[str, str]] = []
    for index, line in enumerate(raw_text.splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        parts = [part.strip() for part in line.split("|")]
        while len(parts) < 4:
            parts.append("")
        staff.append(
            {
                "stt": str(len(staff) + 1),
                "ho_ten": parts[0],
                "nam_sinh": parts[1],
                "chuc_vu": parts[2],
                "ghi_chu": parts[3],
            }
        )
    return staff


@app.get("/")
def read_root() -> FileResponse:
    return FileResponse(Path(INDEX_HTML), media_type="text/html")


@app.get("/api/settings")
def read_settings(db: Session = Depends(get_db)) -> dict[str, int | str]:
    settings = get_or_create_settings(db)
    return {
        "id": settings.id,
        "ten_co_quan": settings.ten_co_quan,
        "ten_giam_doc": settings.ten_giam_doc,
        "chuc_vu": settings.chuc_vu,
    }


@app.post("/api/settings")
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)) -> dict[str, int | str]:
    settings = get_or_create_settings(db)
    settings.ten_co_quan = payload.ten_co_quan
    settings.ten_giam_doc = payload.ten_giam_doc
    settings.chuc_vu = payload.chuc_vu
    db.commit()
    db.refresh(settings)
    return {
        "id": settings.id,
        "ten_co_quan": settings.ten_co_quan,
        "ten_giam_doc": settings.ten_giam_doc,
        "chuc_vu": settings.chuc_vu,
    }


@app.post("/api/generate")
async def generate_document(
    template_type: str = Form("default"),
    loai_van_ban: str = Form(""),
    so_ky_hieu: str = Form(""),
    ten_co_quan: str = Form(""),
    nguoi_ky: str = Form(""),
    chuc_vu: str = Form(""),
    trich_yeu: str = Form(""),
    user_request: str = Form(""),
    dia_danh: str = Form(""),
    don_vi_nhan: str = Form(""),
    noi_luu: str = Form("VT"),
    staff_list: str = Form(""),
    context_file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    try:
        context_text = await extract_text_from_upload(context_file)
        preview_text = await generate_ai_text(
            system_prompt=DEFAULT_SYSTEM_PROMPT,
            context_text=context_text,
            user_request=user_request,
        )
        output_path = render_word_document(
            {
                "template_type": template_type,
                "co_quan": ten_co_quan,
                "don_vi_soan_thao": ten_co_quan,
                "so_ky_hieu": so_ky_hieu,
                "dia_danh": dia_danh,
                "trich_yeu": trich_yeu,
                "don_vi_nhan": don_vi_nhan,
                "doan_mo_dau": preview_text,
                "doan_noi_dung_1": "",
                "doan_ket_thuc": f"{ten_co_quan} trao doi de tong hop, bao cao lanh dao theo quy dinh./.",
                "danh_sach_can_bo": parse_staff_list(staff_list),
                "noi_luu": noi_luu,
                "chuc_vu_nguoi_ky": chuc_vu,
                "noi_dung_ai_viet": preview_text,
                "nguoi_ky": nguoi_ky,
            }
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Không thể tạo văn bản: {exc}") from exc

    history = DocumentHistory(
        loai_van_ban=loai_van_ban,
        trich_yeu=trich_yeu,
        file_path=str(output_path),
    )
    db.add(history)
    db.commit()

    return {
        "preview_text": preview_text,
        "file_url": f"/outputs/{output_path.name}",
        "file_name": output_path.name,
    }
