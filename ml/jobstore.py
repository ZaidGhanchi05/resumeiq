"""Job board in a ChromaDB vector index + two-stage ranking (retrieve with embeddings, re-rank with skill match).

Stage 1  vector search  : cosine similarity between the resume embedding and every job embedding.
Stage 2  re-ranking     : the shortlist is re-scored with the explainable skill-gap / TF-IDF matcher.
fit score = (1 - W) * semantic score + W * skill-match score, with W = SKILL_WEIGHT chosen on a validation
set (ml/eval_ranking.py): the skill matcher mostly adds explainability (matched / missing skills), not accuracy.
"""
import json, os, uuid
from pathlib import Path
import chromadb
import numpy as np
from ml.analyzer import clean

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "data" / "jobs_seed.json"
SEM_FULL = 0.8   # embedding cosine at which the semantic score saturates at 100
SKILL_WEIGHT = 0.1


def semantic_score(sim: float) -> float:
    return round(100 * float(np.clip(sim / SEM_FULL, 0, 1)), 1)


class JobStore:
    def __init__(self, embedder, analyzer, path: str | None = None):
        self.emb, self.an = embedder, analyzer
        path = os.getenv("CHROMA_PATH", "memory") if path is None else path
        if path in ("", "memory"):
            self.client = chromadb.EphemeralClient()
            suffix = "-" + uuid.uuid4().hex[:6]            # isolate in-memory stores from each other
        else:
            self.client = chromadb.PersistentClient(path=str(path))
            suffix = ""
        self.col = self.client.get_or_create_collection(f"jobs-{embedder.name}{suffix}", metadata={"hnsw:space": "cosine"})

    # ---- storage ----
    @staticmethod
    def _text(title, description): return f"{title}. {description}"

    def _upsert(self, jobs):
        if not jobs: return
        texts = [self._text(j["title"], j["description"]) for j in jobs]
        self.col.upsert(ids=[j["id"] for j in jobs], documents=texts,
                        embeddings=self.emb.embed([clean(t) for t in texts]),
                        metadatas=[{"title": j["title"], "company": j.get("company", ""), "location": j.get("location", ""),
                                    "category": j.get("category") or "", "source": j.get("source", "custom"), "owner": j.get("owner", ""),
                                    "description": j["description"]} for j in jobs])

    def seed(self, path=SEED):
        jobs = json.load(open(path))
        have = set(self.col.get(ids=[j["id"] for j in jobs])["ids"])
        self._upsert([j for j in jobs if j["id"] not in have])
        return self.col.count()

    @staticmethod
    def _visible(owner):
        """Seed listings (owner "") are shared; custom listings are visible only to the user who added them."""
        return {"owner": {"$in": ["", str(owner)]}} if owner else {"owner": ""}

    def add_job(self, title, company, description, location="", category="", owner="") -> dict:
        job = {"id": "custom-" + uuid.uuid4().hex[:8], "title": title.strip(), "company": company.strip(), "location": location.strip(),
               "category": category, "description": description.strip(), "source": "custom", "owner": str(owner)}
        self._upsert([job]); return job

    def count_custom(self, owner) -> int:
        return len(self.col.get(where={"owner": str(owner)})["ids"])

    def delete_job(self, job_id: str, owner) -> bool:
        r = self.col.get(ids=[job_id], include=["metadatas"])        # seed listings have owner "" so can never match
        if not r["ids"] or not owner or r["metadatas"][0].get("owner") != str(owner): return False
        self.col.delete(ids=[job_id]); return True

    def list_jobs(self, owner=None):
        r = self.col.get(where=self._visible(owner), include=["metadatas"])
        return sorted(({"id": i, **{k: v for k, v in m.items() if k != "owner"}} for i, m in zip(r["ids"], r["metadatas"])),
                      key=lambda j: (j["source"] != "custom", j["title"]))

    # ---- ranking ----
    def rank_jobs(self, resume: str, top_k: int = 10, retrieve_k: int = 20, owner=None) -> list:
        where = self._visible(owner); n = len(self.col.get(where=where)["ids"])
        if n == 0: return []
        q = self.emb.embed([clean(resume)])
        res = self.col.query(query_embeddings=q, n_results=min(retrieve_k, n), where=where, include=["metadatas", "distances"])
        out = []
        for jid, meta, dist in zip(res["ids"][0], res["metadatas"][0], res["distances"][0]):
            sim = 1.0 - float(dist)
            m = self.an.match_score(resume, meta["description"])
            sem = semantic_score(sim)
            out.append({"id": jid, "title": meta["title"], "company": meta["company"], "location": meta["location"],
                        "category": meta["category"], "source": meta["source"], "snippet": meta["description"][:170], "description": meta["description"],
                        "score": round((1 - SKILL_WEIGHT) * sem + SKILL_WEIGHT * m["score"], 1), "semantic": sem, "skill_match": m["score"],
                        "matched": m["gap"]["matched"], "missing": [x["skill"] for x in m["gap"]["missing"]],
                        "similarity": round(sim, 4)})
        out.sort(key=lambda r: r["score"], reverse=True)
        return out[:top_k]

    def retrieve_only(self, resume: str, k: int = 3) -> list:
        """Embedding-only ranking (used to measure how much re-ranking helps)."""
        q = self.emb.embed([clean(resume)])
        res = self.col.query(query_embeddings=q, n_results=min(k, self.col.count()), include=["metadatas"])
        return [m["category"] for m in res["metadatas"][0]]


def rank_candidates(embedder, analyzer, jd: str, candidates: list) -> list:
    """Recruiter mode: rank many resumes for ONE job description. candidates = [(name, text), ...]"""
    client = chromadb.EphemeralClient()
    col = client.create_collection("cand-" + uuid.uuid4().hex[:10], metadata={"hnsw:space": "cosine"})
    try:
        col.add(ids=[str(i) for i in range(len(candidates))], documents=[t[:2000] for _, t in candidates],
                embeddings=embedder.embed([clean(t) for _, t in candidates]))
        res = col.query(query_embeddings=embedder.embed([clean(jd)]), n_results=len(candidates), include=["distances"])
        sims = {int(i): 1.0 - float(d) for i, d in zip(res["ids"][0], res["distances"][0])}
    finally:
        client.delete_collection(col.name)
    rows = []
    for i, (name, text) in enumerate(candidates):
        m = analyzer.match_score(text, jd); sem = semantic_score(sims[i])
        cat = analyzer.predict_category(text, top_k=1)["top"][0]
        rows.append({"name": name, "score": round((1 - SKILL_WEIGHT) * sem + SKILL_WEIGHT * m["score"], 1), "semantic": sem, "skill_match": m["score"],
                     "ats": analyzer.ats_score(text, jd)["score"], "category": cat["category"],
                     "matched": m["gap"]["matched"], "missing": [x["skill"] for x in m["gap"]["missing"]],
                     "words": len(text.split())})
    rows.sort(key=lambda r: r["score"], reverse=True)
    for rank, r in enumerate(rows, 1): r["rank"] = rank
    return rows
