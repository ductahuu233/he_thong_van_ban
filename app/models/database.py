from datetime import UTC, datetime
from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ten_co_quan: Mapped[str] = mapped_column(String(255), default="")
    ten_giam_doc: Mapped[str] = mapped_column(String(255), default="")
    chuc_vu: Mapped[str] = mapped_column(String(255), default="")


class DocumentHistory(Base):
    __tablename__ = "document_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    loai_van_ban: Mapped[str] = mapped_column(String(255), default="")
    trich_yeu: Mapped[str] = mapped_column(Text, default="")
    ngay_tao: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    file_path: Mapped[str] = mapped_column(String(500), default="")
