import json, os, time
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")   # local dev only; in production the host injects real env vars. Must run before the imports below.

import pandas as pd
from fastapi import Depends, FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from backend import auth, db, routes_coach, routes_history, routes_jobs
from backend.db import Analysis, get_db
from backend.extract import read_resume
from ml.analyzer import Analyzer
from ml.coach import CoachService
from ml.embedder import get_embedder
from ml.feedback import llm_feedback
from ml.jobstore import JobStore


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    analyzer, embedder = Analyzer(), get_embedder()
    app.state.analyzer, app.state.embedder = analyzer, embedder
    app.state.jobs = JobStore(embedder, analyzer)
    app.state.jobs.seed()
    app.state.coach = CoachService(embedder, analyzer)
    yield


app = FastAPI(title="ResumeIQ API", version="2.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "*").split(","), allow_methods=["*"], allow_headers=["*"])
for r in (auth.router, routes_history.router, routes_jobs.router, routes_coach.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    a = app.state.analyzer
    return {"status": "ok", "model": a.model_name, "classes": len(a.classes), "embedder": app.state.embedder.name,
            "jobs_indexed": app.state.jobs.col.count()}


@app.post("/api/analyze")
def analyze(resume: UploadFile | None = File(None), resume_text: str = Form(""), jd: str = Form(""),
            label: str = Form(""), jd_title: str = Form(""),
            user=Depends(auth.current_user_optional), session: Session = Depends(get_db)):
    t0 = time.perf_counter()
    text = read_resume(resume, resume_text)
    jd = jd.strip() or None
    result = app.state.analyzer.analyze(text, jd)
    result["feedback"] = llm_feedback(result, text, jd)
    result["meta"] = {"words": len(text.split()), "has_jd": bool(jd), "latency_ms": round((time.perf_counter() - t0) * 1000)}
    saved = None
    if user:   # signed-in users get a history entry (result only; the resume text itself is never stored)
        top = result["category"]["top"][0]
        row = Analysis(user_id=user.id, label=label.strip()[:80] or time.strftime("Analysis %d %b %H:%M"), jd_title=jd_title.strip()[:120],
                       category=top["category"], confidence=top["confidence"], ats_score=result["ats"]["score"],
                       match_score=result["match"]["score"] if jd else None, resume_words=len(text.split()),
                       skills=result["match"]["gap"]["resume_skills"] if jd else result["skills"], result=dict(result))
        session.add(row); session.commit(); saved = row.id
    result["saved_id"] = saved
    result["resume_text"] = text     # returned so the UI can reuse it on other pages
    return result


@app.get("/api/metrics")
def metrics():
    """Real evaluation numbers produced by ml/train.py, ml/evaluate.py and ml/eval_ranking.py."""
    rep = ROOT / "reports"
    out = {}
    for key, fn in {"summary": "best_model_summary.json", "evaluation": "evaluation.json", "ranking": "ranking_eval.json"}.items():
        p = rep / fn
        out[key] = json.loads(p.read_text()) if p.exists() else None
    for key, fn in {"comparison": "model_comparison.csv", "clustering": "clustering_metrics.csv"}.items():
        p = rep / fn
        out[key] = pd.read_csv(p).round(4).to_dict("records") if p.exists() else []
    return out


app.mount("/reports", StaticFiles(directory=ROOT / "reports"), name="reports")
