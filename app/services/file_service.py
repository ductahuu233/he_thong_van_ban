from fastapi import UploadFile


async def extract_text_from_upload(upload: UploadFile | None) -> str:
    if upload is None or not upload.filename:
        return ""

    filename = upload.filename.lower()
    content = await upload.read()
    if not content:
        return ""

    if filename.endswith(".txt"):
        return content.decode("utf-8", errors="ignore")
    if filename.endswith(".pdf"):
        return extract_pdf_text(content)
    if filename.endswith(".docx"):
        return extract_docx_text(content)

    raise ValueError("Chỉ hỗ trợ file .txt, .pdf, .docx.")


def extract_pdf_text(content: bytes) -> str:
    from io import BytesIO

    from pypdf import PdfReader

    reader = PdfReader(BytesIO(content))
    return "\n".join(page.extract_text() or "" for page in reader.pages).strip()


def extract_docx_text(content: bytes) -> str:
    from io import BytesIO

    from docx import Document

    document = Document(BytesIO(content))
    return "\n".join(paragraph.text for paragraph in document.paragraphs).strip()
