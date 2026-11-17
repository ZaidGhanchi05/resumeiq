"""AI career coach: grounded chat (RAG over the user's resume + job description), bullet rewriter, cover letter.

RAG flow:  resume/JD -> chunks (ids R1.. / J1..) -> embeddings -> ChromaDB collection per session
           question -> top-k chunks -> LLM answers using ONLY those chunks and cites them like [R2].
Without a Groq key the same retrieval runs and a rule-based answer is returned (mode = "offline")."""
import json, re, time, uuid
from collections import OrderedDict
import chromadb
from ml import llm
from ml.analyzer import ACTION_VERBS, clean
from ml.skills import extract_skills

MAX_RESUME, MAX_JD, MAX_MSG = 20000, 8000, 1000


def chunk_text(text: str, max_words: int = 60) -> list:
    """Split into sentence/bullet-sized pieces, then pack them into chunks of at most ~max_words words."""
    parts = []
    for line in re.split(r"\n+|(?<=[.!?])\s+(?=[A-Z])", text or ""):
        line = line.strip()
        words = line.split()
        if len(words) > max_words * 1.5:                                    # unbroken PDF text: window it
            parts += [" ".join(words[i:i + max_words]) for i in range(0, len(words), max_words)]
        elif line:
            parts.append(line)
    chunks, cur, n = [], [], 0
    for p in parts:
        w = len(p.split())
        if cur and n + w > max_words:
            chunks.append(" ".join(cur)); cur, n = [], 0
        cur.append(p); n += w
    if cur: chunks.append(" ".join(cur))
    return [c for c in chunks if len(c.split()) >= 4]


class CoachService:
    def __init__(self, embedder, analyzer, max_sessions: int = 200, ttl: int = 7200):
        self.emb, self.an, self.max_sessions, self.ttl = embedder, analyzer, max_sessions, ttl
        self.client = chromadb.EphemeralClient()
        self.sessions: OrderedDict = OrderedDict()   # swap for Redis + a shared vector DB to scale beyond one process

    # ---------- sessions ----------
    def _gc(self):
        now = time.time()
        for sid in [s for s, v in self.sessions.items() if now - v["created"] > self.ttl]: self._drop(sid)
        while len(self.sessions) > self.max_sessions: self._drop(next(iter(self.sessions)))

    def _drop(self, sid):
        v = self.sessions.pop(sid, None)
        if v:
            try: self.client.delete_collection(v["col"])
            except Exception: pass

    def start(self, resume: str, jd: str | None = None) -> dict:
        self._gc()
        resume, jd = resume[:MAX_RESUME], (jd or "")[:MAX_JD]
        chunks = {}
        for i, c in enumerate(chunk_text(resume), 1): chunks[f"R{i}"] = {"src": "resume", "text": c}
        for i, c in enumerate(chunk_text(jd), 1): chunks[f"J{i}"] = {"src": "jd", "text": c}
        if not chunks: raise ValueError("Not enough text to coach on.")
        sid = uuid.uuid4().hex[:12]; col_name = f"sess-{sid}"
        col = self.client.create_collection(col_name, metadata={"hnsw:space": "cosine"})
        ids = list(chunks)
        col.add(ids=ids, documents=[chunks[i]["text"] for i in ids], embeddings=self.emb.embed([clean(chunks[i]["text"]) for i in ids]),
                metadatas=[{"src": chunks[i]["src"]} for i in ids])
        facts = {"ats": self.an.ats_score(resume, jd or None), "gap": self.an.skill_gap(resume, jd) if jd else None}
        self.sessions[sid] = {"col": col_name, "chunks": chunks, "resume": resume, "jd": jd, "facts": facts, "created": time.time()}
        return {"session_id": sid, "resume_chunks": sum(c["src"] == "resume" for c in chunks.values()),
                "jd_chunks": sum(c["src"] == "jd" for c in chunks.values()), "mode": "groq" if llm.available() else "offline"}

    def _get(self, sid):
        s = self.sessions.get(sid)
        if not s: raise KeyError(sid)
        return s

    # ---------- chat ----------
    def retrieve(self, sid: str, message: str, k: int = 5) -> list:
        s = self._get(sid); col = self.client.get_collection(s["col"])
        res = col.query(query_embeddings=self.emb.embed([clean(message)]), n_results=min(k, col.count()), include=["distances"])
        return [{"id": i, "source": s["chunks"][i]["src"], "text": s["chunks"][i]["text"], "score": round(1 - d, 3)}
                for i, d in zip(res["ids"][0], res["distances"][0])]

    def chat(self, sid: str, message: str, history: list | None = None) -> dict:
        s = self._get(sid); message = message.strip()[:MAX_MSG]
        sources = self.retrieve(sid, message)
        facts = s["facts"]; gap = facts["gap"]
        fact_lines = [f"ATS score: {facts['ats']['score']}/100. Weak checks: " + "; ".join(c["tip"] for c in facts["ats"]["checks"] if c["points"] < 0.6 * c["max"])]
        if gap: fact_lines.append(f"JD skills matched: {', '.join(gap['matched']) or 'none'}. JD skills missing: {', '.join(m['skill'] for m in gap['missing']) or 'none'}.")
        context = "\n".join(f"[{c['id']}] ({'resume' if c['source']=='resume' else 'job description'}) {c['text']}" for c in sources)
        msgs = [{"role": "system", "content": "You are a precise, encouraging career coach. Answer ONLY from the CONTEXT chunks and FACTS. "
                 "Cite chunk ids like [R2] when you use them. If the answer is not in the context, say so and suggest what to add. "
                 "Be concrete and concise (under 170 words). " + llm.SAFETY}]
        for h in (history or [])[-6:]:
            if h.get("role") in ("user", "assistant") and isinstance(h.get("content"), str):
                msgs.append({"role": h["role"], "content": h["content"][:1500]})
        msgs.append({"role": "user", "content": f"FACTS:\n" + "\n".join(fact_lines) + f"\n\nCONTEXT:\n{context}\n\nQUESTION: {message}"})
        answer = llm.chat(msgs, temperature=0.3, max_tokens=500)
        mode = "groq"
        if not answer:
            answer, mode = self._offline_answer(s, message, sources), "offline"
        return {"answer": answer.strip(), "sources": sources, "mode": mode}

    def _offline_answer(self, s, message: str, sources: list) -> str:
        q = message.lower(); facts = s["facts"]; gap = facts["gap"]; ats = facts["ats"]
        weak = [c for c in sorted(ats["checks"], key=lambda c: c["points"] / c["max"]) if c["points"] < 0.8 * c["max"]]
        cite = lambda: " ".join(f"[{c['id']}]" for c in [c for c in sources if c["source"] == "resume"][:3])   # resume evidence only
        if re.search(r"missing|gap|lack|skills?|require|keyword", q):
            if not gap: return "Add a job description to this session to see which skills you are missing. Your resume currently shows: " + ", ".join(sorted(extract_skills(s["resume"]))[:12]) + "."
            miss = [m["skill"] for m in gap["missing"]]
            return (f"You match {len(gap['matched'])} of {len(gap['jd_skills'])} skills in this job description ({gap['coverage']*100:.0f}%). "
                    + (f"Missing: {', '.join(miss)}. Only add the ones you genuinely have, and back each with a project line. " if miss else "No skill gaps found. ")
                    + (f"Closest evidence in your resume: {cite()}" if cite() else ""))
        if re.search(r"ats|format|section|length|score", q):
            return f"Your ATS score is {ats['score']:.0f}/100. " + ("Fix first: " + "; ".join(c["tip"] for c in weak[:3]) + "." if weak else "Every check looks strong.")
        if re.search(r"improve|fix|better|first|priority|strengthen|weak|advice", q):
            steps = [c["tip"] for c in weak[:3]]
            if gap and gap["missing"]: steps.append("Mirror these JD skills if you have them: " + ", ".join(m["skill"] for m in gap["missing"][:4]))
            return "Priorities: " + " ".join(f"{i}) {t}." for i, t in enumerate(steps, 1)) if steps else "Your resume is in good shape; tailor the summary to each job description."
        if re.search(r"summary|headline|objective|intro", q):
            sk = ", ".join(sorted(extract_skills(s["resume"]))[:5])
            return f"Template: 'Computer science student skilled in {sk or '[your top skills]'}, with hands-on projects in [domain] that achieved [metric]. Seeking a [role] position to [goal].' Fill the brackets with your real details."
        top = " ".join(f"[{c['id']}] {c['text'][:160]}" for c in sources[:2])
        return "(Offline mode, no LLM key set.) Closest passages in your documents: " + top

    # ---------- bullet rewriter ----------
    WEAK = [("worked on", "Built"), ("responsible for", "Owned"), ("helped with", "Contributed to"), ("helped", "Supported"),
            ("involved in", "Contributed to"), ("was part of", "Contributed to"), ("participated in", "Contributed to"),
            ("assisted in", "Supported"), ("handled", "Managed"), ("did", "Delivered"), ("made", "Built")]

    def rewrite_bullet(self, bullet: str, jd: str | None = None) -> dict:
        bullet = re.sub(r"^[\s\-•*]+", "", bullet.strip())[:500]
        msgs = [{"role": "system", "content": "You rewrite resume bullets. Keep every fact the user gave; do NOT invent numbers or tools. "
                 "Where a metric would help but is unknown, use a bracket placeholder like [X%]. Start with a strong action verb. " + llm.SAFETY},
                {"role": "user", "content": f"BULLET: {bullet}\n" + (f"JOB DESCRIPTION (for keywords): {jd[:1500]}\n" if jd else "")
                 + 'Reply JSON only: {"versions": [three improved bullets, each under 30 words], "tips": [up to 3 short reasons]}'}]
        raw = llm.chat(msgs, json_mode=True, temperature=0.4, max_tokens=500)
        if raw:
            try:
                d = json.loads(raw)
                v = [str(x) for x in d["versions"]][:3]
                if v: return {"mode": "groq", "original": bullet, "versions": v, "tips": [str(x) for x in d.get("tips", [])][:3]}
            except Exception:
                pass
        return self._template_rewrite(bullet)

    def _template_rewrite(self, bullet: str) -> dict:
        b = bullet.rstrip(".")
        low, tips, replaced = b.lower(), [], False
        for weak, strong in self.WEAK:
            if low.startswith(weak + " "):
                b = strong + " " + b[len(weak) + 1:]; replaced = True
                tips.append(f"Replaced the weak opener '{weak}' with '{strong}'."); break
        b = b[0].upper() + b[1:] if b else b
        skills = sorted(extract_skills(bullet))
        has_num = bool(re.search(r"\d", bullet))
        v1 = b + ("" if has_num else ", achieving [X%] improvement in [metric]")
        v2 = b + ("" if not skills or any(s.lower() in b.lower() for s in skills) else f" using {', '.join(skills[:3])}") + ("" if has_num else ", impacting [N users / records]")
        v3 = f"{b.split(' ')[0]} {' '.join(b.split(' ')[1:])} - [result: what improved and by how much], by [method / tool]".replace("  ", " ")
        if not has_num: tips.append("Add a number: accuracy, % improvement, users, records or time saved.")
        if not skills: tips.append("Name the tools or technologies you used.")
        if not replaced and b.split(" ")[0].lower() not in ACTION_VERBS: tips.append("Start with a strong action verb (built, deployed, improved).")
        return {"mode": "template", "original": bullet, "versions": [v1, v2, v3], "tips": tips[:3],
                "note": "Template mode (no LLM key): fill the [brackets] with your real numbers."}

    # ---------- cover letter ----------
    def _highlights(self, resume: str, jd: str | None, n: int = 2) -> list:
        jd_sk = extract_skills(jd or "")
        scored = []
        for c in chunk_text(resume, 40):
            low = c.lower(); has_verb = any(v in re.findall(r"[a-z]+", low) for v in ACTION_VERBS)
            sc = 2 * has_verb + bool(re.search(r"\d", c)) + len(extract_skills(c) & jd_sk)
            if has_verb: scored.append((sc, c))
        return [c for _, c in sorted(scored, key=lambda t: -t[0])[:n]]

    def cover_letter(self, resume: str, jd: str, name: str = "", company: str = "", role: str = "") -> dict:
        resume, jd = resume[:MAX_RESUME], jd[:MAX_JD]
        role, company, name = role.strip() or "the advertised role", company.strip() or "your company", name.strip()
        msgs = [{"role": "system", "content": "You write concise, honest cover letters (max 230 words, 3 short paragraphs, no clichés). "
                 "Use only facts present in the resume. Sign off with the candidate's name if given. " + llm.SAFETY},
                {"role": "user", "content": f"ROLE: {role}\nCOMPANY: {company}\nCANDIDATE: {name or 'unknown'}\nRESUME:\n{resume[:3500]}\nJOB DESCRIPTION:\n{jd[:1800]}"}]
        text = llm.chat(msgs, temperature=0.5, max_tokens=520)
        if text: return {"mode": "groq", "text": text.strip()}
        gap = self.an.skill_gap(resume, jd); hl = self._highlights(resume, jd)
        matched = ", ".join(gap["matched"][:6]) or "the core skills listed in the posting"
        miss = [m["skill"] for m in gap["missing"][:3]]
        emphasis = ("The posting's emphasis on " + ", ".join(gap["matched"][:4]) + " matches the work I have been doing.") if gap["matched"] \
            else "I believe my project experience is a good fit for the responsibilities described."
        body = ["Dear Hiring Manager,", f"I am writing to apply for {role} at {company}. {emphasis}",
                f"My background includes hands-on experience with {matched}." + (" Highlights from my resume: " + " ".join(f"\"{(h[:200].rstrip() + '...') if len(h) > 200 else h.rstrip('.') + '.'}\"" for h in hl) if hl else ""),
                ("I am also keen to build depth in " + ", ".join(miss) + ", and I learn new tools quickly by shipping projects." if miss else "I enjoy turning requirements into working, tested software and would welcome the chance to contribute."),
                f"Thank you for your time and consideration.\n\nSincerely,\n{name or '[Your name]'}"]
        return {"mode": "template", "text": "\n\n".join(body), "note": "Template mode (no LLM key): review and personalise before sending."}
