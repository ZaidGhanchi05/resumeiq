from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.auth import current_user
from backend.db import Analysis, User, get_db

router = APIRouter(prefix="/api/history", tags=["history"])


def _row(a: Analysis):
    return {"id": a.id, "label": a.label, "jd_title": a.jd_title, "created_at": a.created_at.isoformat() + "Z",
            "category": a.category, "confidence": a.confidence, "ats_score": a.ats_score, "match_score": a.match_score,
            "resume_words": a.resume_words, "skills": a.skills}


def _own(db: Session, user: User, aid: int) -> Analysis:
    a = db.get(Analysis, aid)
    if not a or a.user_id != user.id: raise HTTPException(404, "Not found.")      # same answer for missing and for someone else's
    return a


@router.get("")
def list_history(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Analysis).where(Analysis.user_id == user.id).order_by(Analysis.created_at.desc()).limit(200)).all()
    return {"items": [_row(a) for a in rows]}


@router.get("/{aid}")
def get_one(aid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = _own(db, user, aid)
    return {**_row(a), "result": a.result}


@router.delete("/{aid}")
def delete_one(aid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own(db, user, aid)); db.commit()
    return {"deleted": aid}
