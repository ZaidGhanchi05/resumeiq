from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel
from backend.auth import current_user, current_user_optional
from backend.extract import read_resume
from ml.jobstore import rank_candidates

router = APIRouter(prefix="/api", tags=["jobs"])
MAX_CUSTOM_JOBS = 20
MAX_CANDIDATES = 15


class JobIn(BaseModel):
    title: str
    company: str = ""
    location: str = ""
    description: str


def _uid(u): return u.id if u else None


@router.get("/jobs")
def list_jobs(request: Request, user=Depends(current_user_optional)):
    return {"jobs": request.app.state.jobs.list_jobs(_uid(user))}


@router.post("/jobs")
def add_job(j: JobIn, request: Request, user=Depends(current_user)):
    store = request.app.state.jobs
    if not (2 <= len(j.title.strip()) <= 120): raise HTTPException(400, "Title must be 2-120 characters.")
    if not (30 <= len(j.description.strip().split()) * 1 <= 1200): raise HTTPException(400, "Description must be 30-1200 words.")
    if store.count_custom(user.id) >= MAX_CUSTOM_JOBS: raise HTTPException(400, f"You can save up to {MAX_CUSTOM_JOBS} custom jobs.")
    job = store.add_job(j.title, j.company[:120], j.description, j.location[:80], owner=user.id)
    return {k: v for k, v in job.items() if k != "owner"}


@router.delete("/jobs/{job_id}")
def delete_job(job_id: str, request: Request, user=Depends(current_user)):
    if not request.app.state.jobs.delete_job(job_id, user.id): raise HTTPException(404, "Job not found (seed listings cannot be deleted).")
    return {"deleted": job_id}


@router.post("/jobs/rank")
def rank_jobs(request: Request, resume: UploadFile | None = File(None), resume_text: str = Form(""),
              top_k: int = Form(10), user=Depends(current_user_optional)):
    text = read_resume(resume, resume_text)
    store = request.app.state.jobs
    jobs = store.rank_jobs(text, top_k=max(1, min(top_k, 20)), owner=_uid(user))
    return {"jobs": jobs, "meta": {"indexed": len(store.list_jobs(_uid(user))), "embedder": request.app.state.embedder.name,
                                   "words": len(text.split())}}


@router.post("/candidates/rank")
def rank_cands(request: Request, jd: str = Form(...), resumes: list[UploadFile] = File(...)):
    if len(jd.split()) < 20: raise HTTPException(400, "Paste a fuller job description (at least 20 words).")
    if len(resumes) > MAX_CANDIDATES: raise HTTPException(400, f"Upload at most {MAX_CANDIDATES} resumes at a time.")
    cands, skipped = [], []
    for f in resumes:
        try: cands.append((f.filename, read_resume(f)))
        except HTTPException as e: skipped.append({"name": f.filename, "reason": e.detail})
    if not cands: raise HTTPException(400, "None of the files could be read. " + (skipped[0]["reason"] if skipped else ""))
    s = request.app.state
    return {"candidates": rank_candidates(s.embedder, s.analyzer, jd, cands), "skipped": skipped}
