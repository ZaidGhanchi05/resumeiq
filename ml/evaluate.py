"""Independent evaluation of the shipped model + matching/ATS modules on the held-out test split."""
import sys, json, numpy as np, pandas as pd
sys.path.insert(0, ".")
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, roc_auc_score, f1_score
from ml.analyzer import Analyzer
from data.jds.sample_jds import JDS

df = pd.read_csv("data/processed/resumes_clean.csv")
le = LabelEncoder().fit(df.Category); y = le.transform(df.Category)
_, Xte, _, yte = train_test_split(df.text_no_title, y, test_size=0.2, stratify=y, random_state=42)
idx_te = Xte.index
A = Analyzer()
assert list(le.classes_) == A.classes

# 1) classifier: top-1 / top-3 / top-5 on the held-out split (no job title in the text)
P = A.pipe.predict_proba(Xte) if hasattr(A.pipe, "predict_proba") else None
order = np.argsort(-P, axis=1)
out = {"model": A.model_name, "n_test": int(len(yte))}
for k in (1, 3, 5): out[f"top{k}_accuracy"] = float(np.mean([yte[i] in order[i, :k] for i in range(len(yte))]))
out["macro_f1"] = float(f1_score(yte, order[:, 0], average="macro"))

# 2) resume-JD matching as a ranking task: does a JD for category C rank C-resumes above others?
rows = []
sub = df.loc[idx_te]
for cat, jd in JDS.items():
    scores = np.array([A.match_score(t, jd)["score"] for t in sub.text_no_title])
    rel = (sub.Category.values == cat).astype(int)
    if rel.sum() < 3: continue
    top10 = np.argsort(-scores)[:10]
    rank_first = int(np.where(rel[np.argsort(-scores)] == 1)[0][0]) + 1
    rows.append({"jd_category": cat, "n_relevant": int(rel.sum()), "auc": roc_auc_score(rel, scores),
                 "precision_at_10": float(rel[top10].mean()), "first_relevant_rank": rank_first})
M = pd.DataFrame(rows); M.to_csv("reports/match_eval.csv", index=False)
out["match_mean_auc"] = float(M.auc.mean()); out["match_mean_precision_at_10"] = float(M.precision_at_10.mean())
out["match_mean_reciprocal_rank"] = float((1 / M.first_relevant_rank).mean())

# 3) ATS sanity: complete resumes should outscore deliberately degraded ones
rng = np.random.default_rng(0); full = []; degraded = []
for t in sub.text_no_title.sample(150, random_state=1):
    full.append(A.ats_score(t)["score"])
    cut = " ".join(t.split()[: max(60, len(t.split()) // 6)])     # truncated resume: drops sections / detail
    degraded.append(A.ats_score(cut)["score"])
out["ats_mean_full"] = float(np.mean(full)); out["ats_mean_degraded"] = float(np.mean(degraded))
out["ats_full_beats_degraded_pct"] = float(np.mean(np.array(full) > np.array(degraded)))

json.dump(out, open("reports/evaluation.json", "w"), indent=2); print(json.dumps(out, indent=2)); print(M.round(3))
