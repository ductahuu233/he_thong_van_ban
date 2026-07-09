from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DATABASE_URL = f"sqlite:///{DATA_DIR / 'app.db'}"
OUTPUT_DIR = BASE_DIR / "outputs"
TEMPLATE_PATH = DATA_DIR / "template_nghidinh30.docx"
CONGVAN_TEMPLATE_PATH = DATA_DIR / "template_congvan.docx"
QUYETDINH_TEMPLATE_PATH = DATA_DIR / "template_quyetdinh.docx"
