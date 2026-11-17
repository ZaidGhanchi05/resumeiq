"""SQL layer (SQLAlchemy 2.x). SQLite by default; set DATABASE_URL for Postgres (e.g. Neon / Supabase)."""
import datetime as dt
import os
from pathlib import Path
from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

ROOT = Path(__file__).resolve().parent.parent


def _url() -> str:
    url = os.getenv("DATABASE_URL") or f"sqlite:///{ROOT / 'data' / 'app.db'}"
    return url.replace("postgres://", "postgresql://", 1)          # some hosts still hand out the old scheme


URL = _url()
engine = create_engine(URL, pool_pre_ping=True, connect_args={"check_same_thread": False} if URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)


class Analysis(Base):
    """One saved analysis. The resume text itself is NOT stored, only the computed result."""
    __tablename__ = "analyses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(80), default="")
    jd_title: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow, index=True)
    category: Mapped[str] = mapped_column(String(60))
    confidence: Mapped[float] = mapped_column(Float)
    ats_score: Mapped[float] = mapped_column(Float)
    match_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    resume_words: Mapped[int] = mapped_column(Integer, default=0)
    skills: Mapped[list] = mapped_column(JSON, default=list)
    result: Mapped[dict] = mapped_column(JSON)


def init_db():
    Base.metadata.create_all(engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
