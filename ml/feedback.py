"""AI feedback layer. Uses Groq (Llama 3.1) when GROQ_API_KEY is set; otherwise a deterministic
rule-based fallback built from the same analysis, so the app always works offline."""
import json, os, re
import httpx

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = (os.getenv("GROQ_MODEL") or "llama-3.1-8b-instant")


def rule_feedback(a: dict) -> dict:
    ats, cat = a["ats"], a["category"]["top"][0]
    strengths, improvements = [], []
    for c in ats["checks"]:
        (strengths if c["points"] >= 0.8 * c["max"] else improvements).append(c)
    out = {"source": "rules",
           "summary": f"Your resume reads most like a {cat['category'].replace('-', ' ').title()} profile "
                      f"({cat['confidence']*100:.0f}% confidence) with an ATS score of {ats['score']:.0f}/100.",
           "strengths": [f"{c['check']}: strong" for c in strengths][:4],
           "improvements": [c["tip"] for c in sorted(improvements, key=lambda c: c["points"] / c["max"])][:5]}
    m = a.get("match")
    if m:
        miss = [x["skill"] for x in m["gap"]["missing"]][:6]
        out["summary"] += f" Match with the job description: {m['score']:.0f}/100."
        if miss:
            out["improvements"].insert(0, "Add these JD skills only if you genuinely have them: " + ", ".join(miss))
    return out


def _prompt(a: dict, resume: str, jd: str | None) -> str:
    m = a.get("match")
    facts = {"predicted_category": a["category"]["top"][0], "ats_score": a["ats"]["score"],
             "weak_checks": [c["tip"] for c in a["ats"]["checks"] if c["points"] < 0.6 * c["max"]]}
    if m:
        facts.update(match_score=m["score"], matched_skills=m["gap"]["matched"][:15],
                     missing_skills=[x["skill"] for x in m["gap"]["missing"]][:15])
    return ("You are a precise resume coach. Use ONLY the facts and resume text below. Never invent experience.\n"
            f"FACTS: {json.dumps(facts)}\nRESUME (truncated): {resume[:3500]}\n"
            + (f"JOB DESCRIPTION: {jd[:1500]}\n" if jd else "")
            + 'Reply with JSON only: {"summary": str, "strengths": [str,...3], "improvements": [str,...5]}. '
              "Improvements must be specific and actionable; mention quantified results and missing keywords.")


def llm_feedback(a: dict, resume: str, jd: str | None) -> dict:
    key = os.getenv("GROQ_API_KEY")
    if not key:
        return rule_feedback(a)
    try:
        r = httpx.post(GROQ_URL, timeout=25, headers={"Authorization": f"Bearer {key}"},
                       json={"model": MODEL, "temperature": 0.3, "response_format": {"type": "json_object"},
                             "messages": [{"role": "user", "content": _prompt(a, resume, jd)}]})
        r.raise_for_status()
        data = json.loads(r.json()["choices"][0]["message"]["content"])
        return {"source": "groq", "summary": str(data["summary"]),
                "strengths": [str(x) for x in data["strengths"]][:4],
                "improvements": [str(x) for x in data["improvements"]][:6]}
    except Exception:
        return rule_feedback(a)   # never fail the request because the LLM is down
