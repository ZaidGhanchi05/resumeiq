"""Email + password accounts. Passwords: scrypt with a per-user salt. Sessions: signed JWT (HS256, 7 days)."""
import hashlib, hmac, os, re, secrets, time
from collections import defaultdict, deque
import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.db import User, get_db

SECRET = os.getenv("JWT_SECRET") or secrets.token_urlsafe(32)   # without JWT_SECRET, logins reset on every restart
if not os.getenv("JWT_SECRET"):
    print("WARNING: JWT_SECRET not set - using a random key (sessions will not survive a restart).")
TOKEN_DAYS = 7
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_DUMMY = None


def hash_password(pw: str) -> str:
    salt = os.urandom(16)
    return f"scrypt${salt.hex()}${hashlib.scrypt(pw.encode(), salt=salt, n=2 ** 14, r=8, p=1, dklen=32).hex()}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        _, salt, h = stored.split("$")
        got = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(salt), n=2 ** 14, r=8, p=1, dklen=32)
        return hmac.compare_digest(got, bytes.fromhex(h))
    except Exception:
        return False


def make_token(user_id: int) -> str:
    return jwt.encode({"sub": str(user_id), "exp": int(time.time()) + TOKEN_DAYS * 86400}, SECRET, algorithm="HS256")


def current_user_optional(authorization: str | None = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        uid = int(jwt.decode(authorization[7:], SECRET, algorithms=["HS256"])["sub"])
    except Exception:
        return None
    return db.get(User, uid)


def current_user(user=Depends(current_user_optional)):
    if user is None:
        raise HTTPException(401, "Please sign in.")
    return user


# tiny in-memory limiter for login/register attempts (use Redis or an API gateway when running several workers)
_attempts: dict = defaultdict(deque)


def _limit(key: str, n: int = 8, window: int = 60):
    q, now = _attempts[key], time.time()
    while q and now - q[0] > window: q.popleft()
    if len(q) >= n: raise HTTPException(429, "Too many attempts. Wait a minute and try again.")
    q.append(now)


router = APIRouter(prefix="/api/auth", tags=["auth"])


class Creds(BaseModel):
    email: str
    password: str


def _norm(c: Creds):
    email = c.email.strip().lower()
    if len(email) > 254 or not EMAIL_RE.match(email): raise HTTPException(400, "Enter a valid email address.")
    if not (8 <= len(c.password) <= 128): raise HTTPException(400, "Password must be 8-128 characters.")
    return email


def _out(u: User): return {"token": make_token(u.id), "user": {"id": u.id, "email": u.email}}


@router.post("/register")
def register(c: Creds, request: Request, db: Session = Depends(get_db)):
    email = _norm(c); _limit(f"reg:{request.client.host}")
    if db.scalar(select(User).where(User.email == email)): raise HTTPException(409, "That email is already registered.")
    u = User(email=email, password_hash=hash_password(c.password)); db.add(u); db.commit()
    return _out(u)


@router.post("/login")
def login(c: Creds, request: Request, db: Session = Depends(get_db)):
    global _DUMMY
    email = c.email.strip().lower(); _limit(f"login:{request.client.host}:{email}")
    u = db.scalar(select(User).where(User.email == email))
    _DUMMY = _DUMMY or hash_password("dummy-password")
    ok = verify_password(c.password, u.password_hash if u else _DUMMY)     # same work whether or not the user exists
    if not (u and ok): raise HTTPException(401, "Incorrect email or password.")
    return _out(u)


@router.get("/me")
def me(u: User = Depends(current_user)):
    return {"id": u.id, "email": u.email}
