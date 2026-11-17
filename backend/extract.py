"""Turn an uploaded resume (PDF / DOCX / TXT) into plain text."""
import io
from pypdf import PdfReader
import docx

MAX_BYTES = 5 * 1024 * 1024


def extract_text(filename: str, data: bytes) -> str:
    if len(data) > MAX_BYTES:
        raise ValueError("File too large (max 5 MB)")
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(data))
        return "\n".join((p.extract_text() or "") for p in reader.pages)
    if name.endswith(".docx"):
        d = docx.Document(io.BytesIO(data))
        return "\n".join(p.text for p in d.paragraphs)
    if name.endswith(".txt"):
        return data.decode("utf-8", errors="ignore")
    raise ValueError("Unsupported file type. Upload a PDF, DOCX or TXT.")


def read_resume(upload, text: str = "") -> str:
    """Resume text from an upload or pasted text; raises HTTP 400 with a readable message."""
    from fastapi import HTTPException
    t = (text or "").strip()
    if upload is not None and upload.filename:
        try:
            t = extract_text(upload.filename, upload.file.read()).strip()
        except ValueError as e:
            raise HTTPException(400, str(e))
        except Exception:
            raise HTTPException(400, f"Could not read '{upload.filename}'. Is it a valid, text-based PDF/DOCX?")
    if len(t.split()) < 50:
        raise HTTPException(400, "Resume text is too short or unreadable (need at least 50 words).")
    return t
