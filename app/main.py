from contextlib import asynccontextmanager
from pathlib import Path

from app.compat import apply_collections_compat


from fastapi import Depends, FastAPI, File as FastApiFile, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pydocx import PyDocX
from sqlalchemy.orm import Session

from app.database import BASE_DIR, get_db, init_db
from app.models import DocumentHistory, UserSettings
from app.services.ai_client import DEFAULT_SYSTEM_PROMPT, generate_ai_text
from app.services.file_reader import extract_text_from_upload
from app.services.word_renderer import render_word_document


@asynccontextmanager
async def lifespan(app: FastAPI):
    apply_collections_compat()
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


class GenerationRequest(BaseModel):
    template_type: str = "default"
    loai_van_ban: str = ""
    so_ky_hieu: str = ""
    ten_co_quan: str = ""
    nguoi_ky: str = ""
    chuc_vu: str = ""
    trich_yeu: str = ""
    user_request: str = ""
    dia_danh: str = ""
    don_vi_nhan: str = ""
    noi_luu: str = "VT"
    staff_list: str = ""
    generation_mode: str = "ai"
    manual_content: str = ""


def get_generation_request(
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
    generation_mode: str = Form("ai"),
    manual_content: str = Form(""),
) -> GenerationRequest:
    return GenerationRequest(**locals())


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


def _normalize_vietnamese_name_no_diacritics(s: str) -> str:
    """Fallback chuẩn hoá tên khi người dùng nhập không dấu.

    Ví dụ cần thiết:
    - "Nguyen Van B" -> "Nguyễn Văn B"
    - giữ nguyên phần số/ghi chú nếu có.

    Lưu ý: không thay thế thư viện chính thống, chỉ là mapping cơ bản.
    """
    if not s:
        return s

    raw = s.strip()
    parts = raw.split(" ")

    def fix_first_token(token: str) -> str:
        low = token.lower().strip()
        # handle possible trailing punctuation
        suffix = ""
        while low and low[-1] in ".,;:" :
            suffix = low[-1] + suffix
            low = low[:-1]
        mapping = {
            "nguyen": "Nguyễn",
            "van": "Văn",
            "thanh": "Thành",
            "minh": "Minh",
            "duc": "Đức",
            "hiep": "Hiệp",
            "khanh": "Khánh",
            "phuong": "Phương",
            "thu": "Thư",
            "tuan": "Tuấn",
            "linh": "Linh",
            "b": "B",
            "a": "A",
        }
        fixed = mapping.get(low, None)
        if fixed is None:
            # basic vowel restoration for common tokens ending with n or m kept as-is
            return token
        # preserve original capitalization for non-ascii letters
        if token and token[0].isupper():
            return fixed + suffix
        return fixed + suffix

    normalized = []
    for token in parts:
        t = token.strip()
        if not t:
            continue
        # If token is like "b" or "B" keep
        normalized.append(fix_first_token(t))

    # If input contains patterns like "thứ nhất" without dấu, keep as-is (backend template uses as text)
    return " ".join(normalized).strip()


def _build_render_context(form_data: GenerationRequest, preview_text: str) -> dict:
    nguoi_ky = form_data.nguoi_ky
    # chuẩn hoá tối thiểu để người ký không bị hiển thị thiếu dấu
    nguoi_ky = _normalize_vietnamese_name_no_diacritics(nguoi_ky)

    return {
        "template_type": form_data.template_type,
        "co_quan": form_data.ten_co_quan,
        "don_vi_soan_thao": form_data.ten_co_quan,
        "so_ky_hieu": form_data.so_ky_hieu,
        "dia_danh": form_data.dia_danh,
        "trich_yeu": form_data.trich_yeu,
        "don_vi_nhan": form_data.don_vi_nhan,
        "doan_mo_dau": preview_text,
        "doan_noi_dung_1": "",
        "doan_ket_thuc": f"{form_data.ten_co_quan} trao doi de tong hop, bao cao lanh dao theo quy dinh./.",
        "danh_sach_can_bo": parse_staff_list(form_data.staff_list),
        "noi_luu": form_data.noi_luu,
        "chuc_vu_nguoi_ky": form_data.chuc_vu,
        "noi_dung_ai_viet": preview_text,
        "nguoi_ky": nguoi_ky,
    }


@app.post("/api/generate")
async def generate_document(
    form_data: GenerationRequest = Depends(get_generation_request),
    context_file: UploadFile | None = FastApiFile(None),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    try:
        if form_data.generation_mode == "manual":
            preview_text = form_data.manual_content
        else:
            context_text = await extract_text_from_upload(context_file)
            preview_text = await generate_ai_text(
                system_prompt=DEFAULT_SYSTEM_PROMPT,
                context_text=context_text,
                user_request=form_data.user_request,
            )

        render_context = _build_render_context(form_data, preview_text)
        output_path = render_word_document(render_context)
        preview_html = PyDocX.to_html(output_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Không thể tạo văn bản: {exc}") from exc

    history = DocumentHistory(
        loai_van_ban=form_data.loai_van_ban,
        trich_yeu=form_data.trich_yeu,
        file_path=str(output_path),
    )
    db.add(history)
    db.commit()

    return {
        "preview_html": preview_html,
        "file_url": f"/outputs/{output_path.name}",
        "file_name": output_path.name,
    }
