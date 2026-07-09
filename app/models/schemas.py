from pydantic import BaseModel

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
