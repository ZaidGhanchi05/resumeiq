"""Evaluate job retrieval + choose the re-ranking blend WITHOUT touching the test set.

1. Candidate lists (top-10 by embedding) are scored for a VALIDATION sample drawn from the training split.
   The skill-match weight w in  fit = (1-w)*semantic + w*skill_match  is chosen there (best hit@3).
2. The chosen w is then applied once to the held-out TEST resumes (the same split as the classifier).
A resume 'hits' if a listing from its own Kaggle job family is in the top-k. Only resumes whose family has at
least one seed listing are scored. The board is small and hand-written: this is a retrieval sanity check,
not a production relevance benchmark."""
import sys, json, math
sys.path.insert(0, ".")
import numpy as np, pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from ml.analyzer import Analyzer
from ml.embedder import get_embedder
from ml.jobstore import JobStore, SKILL_WEIGHT

df = pd.read_csv("data/processed/resumes_clean.csv")
y = LabelEncoder().fit_transform(df.Category)
Xtr, Xte, _, _ = train_test_split(df.text_no_title, y, test_size=0.2, stratify=y, random_state=42)
an = Analyzer(); store = JobStore(get_embedder(), an, "memory"); N = store.seed()
counts = pd.Series([j["category"] for j in store.list_jobs()]).value_counts()
def pick(idx): d = df.loc[idx]; return d[d.Category.isin(counts.index)]
val = pick(Xtr.index).sample(300, random_state=0); test = pick(Xte.index)
print("val", len(val), "| test", len(test), "| jobs", N)

def candidates(d):
    return [(cat, store.rank_jobs(t, top_k=10, retrieve_k=10)) for t, cat in zip(d.text_no_title, d.Category)]

def score(cands, w, k=3):
    hit1 = hitk = rr = 0
    for cat, cs in cands:
        order = sorted(cs, key=lambda c: (1 - w) * c["semantic"] + w * c["skill_match"], reverse=True)[:k]
        cats = [c["category"] for c in order]
        hit1 += cats[0] == cat; hitk += cat in cats
        rr += next((1 / (i + 1) for i, c in enumerate(cats) if c == cat), 0)
    n = len(cands); return {"hit@1": hit1 / n, f"hit@{k}": hitk / n, "MRR": rr / n}

WS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1.0]
cv = candidates(val); grid_val = {w: score(cv, w) for w in WS}
# ties on hit@3 go to the larger weight: same accuracy, more explainable (skill overlap breaks ties)
best_w = max(WS, key=lambda w: (round(grid_val[w]["hit@3"], 3), w))
assert best_w == SKILL_WEIGHT, f"validation chose {best_w}, jobstore ships {SKILL_WEIGHT}: update ml/jobstore.py"
print("validation grid (hit@3):", {w: round(g["hit@3"], 3) for w, g in grid_val.items()}, "-> chosen w =", best_w)

ct = candidates(test)
def chance(m, k=3): return 1 - math.comb(N - m, k) / math.comb(N, k)
base = float(np.mean([chance(counts[c]) for c, _ in ct]))
res = {"chosen_skill_weight": best_w, "validation_hit@3_by_weight": {str(w): round(g["hit@3"], 4) for w, g in grid_val.items()},
       "test": {"embedding_only(w=0)": {k: round(v, 4) for k, v in score(ct, 0).items()},
                "final(chosen w)": {k: round(v, 4) for k, v in score(ct, best_w).items()},
                "old_50_50_blend": {k: round(v, 4) for k, v in score(ct, 0.5).items()},
                "random_baseline_hit@3": round(base, 4)},
       "n_test_resumes": len(test), "n_val_resumes": len(val), "n_jobs": N, "embedder": get_embedder().name}
json.dump(res, open("reports/ranking_eval.json", "w"), indent=1); print(json.dumps(res["test"], indent=1))
