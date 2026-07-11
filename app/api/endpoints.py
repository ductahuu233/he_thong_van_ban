from pathlib import Path
from fastapi import APIRouter, Depends, File as FastApiFile, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydocx import PyDocX
from sqlalchemy.orm import Session

from app.core.config import BASE_DIR
from app.core.database import get_db
from app.models import DocumentHistory, UserSettings
from app.models.schemas import SettingsUpdate, GenerationRequest
from app.services.ai_service import DEFAULT_SYSTEM_PROMPT, generate_ai_text, ocr_image_via_llm
from app.services.file_service import extract_text_from_upload
from app.services.doc_generator import render_word_document

router = APIRouter()
INDEX_HTML = BASE_DIR / "templates" / "index.html"


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
    
    modified = False
    if not settings.ten_co_quan:
        settings.ten_co_quan = "HỘI ĐỒNG NHÂN DÂN THÀNH PHỐ HÀ NỘI"
        modified = True
    if not settings.ten_giam_doc:
        settings.ten_giam_doc = "Phùng Thị Hồng Hà"
        modified = True
    if not settings.chuc_vu:
        settings.chuc_vu = "CHỦ TỊCH"
        modified = True
        
    if modified:
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


def _normalize_vietnamese_name_no_diacritics(s: str) -> str:
    if not s:
        return s

    raw = s.strip()
    parts = raw.split(" ")

    def fix_first_token(token: str) -> str:
        low = token.lower().strip()
        suffix = ""
        while low and low[-1] in ".,;:":
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
            return token
        if token and token[0].isupper():
            return fixed + suffix
        return fixed + suffix

    normalized = []
    for token in parts:
        t = token.strip()
        if not t:
            continue
        normalized.append(fix_first_token(t))

    return " ".join(normalized).strip()


def _build_render_context(form_data: GenerationRequest, preview_text: str) -> dict:
    nguoi_ky = form_data.nguoi_ky
    nguoi_ky = _normalize_vietnamese_name_no_diacritics(nguoi_ky)

    return {
        "template_type": form_data.template_type,
        "loai_van_ban": form_data.loai_van_ban,
        "co_quan": form_data.ten_co_quan,
        "don_vi_soan_thao": form_data.ten_co_quan,
        "so_ky_hieu": form_data.so_ky_hieu,
        "dia_danh": form_data.dia_danh,
        "trich_yeu": form_data.trich_yeu,
        "don_vi_nhan": form_data.don_vi_nhan,
        "doan_mo_dau": preview_text,
        "doan_noi_dung_1": "",
        "doan_ket_thuc": f"{form_data.ten_co_quan} trao đổi để tổng hợp, báo cáo lãnh đạo theo quy định./.",
        "danh_sach_can_bo": parse_staff_list(form_data.staff_list),
        "noi_luu": form_data.noi_luu,
        "chuc_vu_nguoi_ky": form_data.chuc_vu,
        "noi_dung_ai_viet": preview_text,
        "nguoi_ky": nguoi_ky,
    }


@router.get("/")
def read_root() -> FileResponse:
    return FileResponse(Path(INDEX_HTML), media_type="text/html")


@router.get("/api/settings")
def read_settings(db: Session = Depends(get_db)) -> dict[str, int | str]:
    settings = get_or_create_settings(db)
    return {
        "id": settings.id,
        "ten_co_quan": settings.ten_co_quan,
        "ten_giam_doc": settings.ten_giam_doc,
        "chuc_vu": settings.chuc_vu,
    }


@router.post("/api/settings")
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


@router.post("/api/generate")
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
        "preview_text": preview_text,
        "file_url": f"/outputs/{output_path.name}",
        "file_name": output_path.name,
    }


@router.post("/api/scan-document")
async def scan_document(file: UploadFile = FastApiFile(...)) -> dict[str, str]:
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ quét các định dạng file hình ảnh (PNG, JPG, JPEG).")
    try:
        image_bytes = await file.read()
        extracted_text = await ocr_image_via_llm(image_bytes, file.content_type)
        return {"text": extracted_text}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Không thể nhận diện văn bản từ hình ảnh: {exc}") from exc

