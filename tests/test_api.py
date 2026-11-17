import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.extract import extract_text
from tests.conftest import ML_RESUME, ML_JD


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/api/health").json()
    assert r["status"] == "ok" and r["classes"] == 24


def test_analyze_text_with_jd(client):
    r = client.post("/api/analyze", data={"resume_text": ML_RESUME, "jd": ML_JD})
    assert r.status_code == 200
    body = r.json()
    assert {"category", "ats", "match", "feedback", "meta"} <= body.keys()
    assert body["feedback"]["source"] in {"rules", "groq"}
    assert body["meta"]["latency_ms"] < 5000


def test_analyze_file_upload(client):
    r = client.post("/api/analyze", files={"resume": ("cv.txt", ML_RESUME.encode(), "text/plain")})
    assert r.status_code == 200 and "skills" in r.json()


def test_analyze_rejects_short_text(client):
    assert client.post("/api/analyze", data={"resume_text": "too short"}).status_code == 400


def test_analyze_rejects_bad_file_type(client):
    r = client.post("/api/analyze", files={"resume": ("cv.exe", b"x" * 500, "application/octet-stream")})
    assert r.status_code == 400


def test_metrics_endpoint(client):
    r = client.get("/api/metrics").json()
    assert {"summary", "evaluation", "comparison", "clustering"} <= r.keys()


def test_extract_limits():
    with pytest.raises(ValueError):
        extract_text("a.txt", b"x" * (6 * 1024 * 1024))
    assert extract_text("a.txt", b"hello") == "hello"
