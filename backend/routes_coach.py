from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel
from backend.extract import read_resume

router = APIRouter(prefix="/api/coach", tags=["coach"])


class ChatIn(BaseModel):
    session_id: str
    message: str
    history: list[dict] = []


class RewriteIn(BaseModel):
    bullet: str
    jd: str = ""


@router.post("/session")
def start(request: Request, resume: UploadFile | None = File(None), resume_text: str = Form(""), jd: str = Form("")):
    text = read_resume(resume, resume_text)
    try: return request.app.state.coach.start(text, jd.strip() or None)
    except ValueError as e: raise HTTPException(400, str(e))


@router.post("/chat")
def chat(c: ChatIn, request: Request):
    if not c.message.strip(): raise HTTPException(400, "Type a question first.")
    try: return request.app.state.coach.chat(c.session_id, c.message, c.history)
    except KeyError: raise HTTPException(404, "This coaching session expired. Start a new one.")


@router.post("/rewrite")
def rewrite(r: RewriteIn, request: Request):
    if len(r.bullet.split()) < 3: raise HTTPException(400, "Paste a full resume bullet (at least 3 words).")
    return request.app.state.coach.rewrite_bullet(r.bullet, r.jd.strip() or None)


@router.post("/cover-letter")
def cover_letter(request: Request, resume: UploadFile | None = File(None), resume_text: str = Form(""), jd: str = Form(""),
                 name: str = Form(""), company: str = Form(""), role: str = Form("")):
    text = read_resume(resume, resume_text)
    if len(jd.split()) < 20: raise HTTPException(400, "Paste the job description (at least 20 words).")
    return request.app.state.coach.cover_letter(text, jd, name[:80], company[:120], role[:120])
