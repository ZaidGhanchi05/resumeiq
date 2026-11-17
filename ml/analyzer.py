"""Resume analysis engine: category prediction, resume-JD match, skill gap, ATS score."""
import re, joblib, numpy as np
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from ml.skills import extract_skills, group_of

ROOT = Path(__file__).resolve().parent.parent
_JUNK = {"com","www","http","https","gmail","linkedin","github","india","pvt","ltd","inc","llc","city","state","name","company"}
ACTION_VERBS = {"built","developed","designed","implemented","led","managed","created","improved","reduced","increased","deployed","launched","optimized","automated","analyzed","delivered","trained","integrated","collaborated","achieved","streamlined","engineered","established","coordinated","directed","resolved"}
SECTIONS = {"summary":r"\b(summary|profile|objective|about)\b","experience":r"\b(experience|employment|work history|internship)\b",
            "education":r"\b(education|academic|b\.?tech|bachelor|master|degree)\b","skills":r"\b(skills|technologies|technical skills|competencies)\b",
            "projects":r"\b(projects?)\b"}

def clean(t: str) -> str:
    return re.sub(r"\s+"," ", t.replace("\xa0"," ")).strip()

class Analyzer:
    def __init__(self, model_path=ROOT/"models/category_model.joblib"):
        bundle = joblib.load(model_path)
        self.pipe, self.classes, self.model_name = bundle["pipeline"], bundle["classes"], bundle["name"]

    # ---- category prediction (+ explanation) ----
    def predict_category(self, text: str, top_k=3):
        text = clean(text); pipe = self.pipe
        vec, clf = pipe.named_steps["t"], pipe.named_steps["m"]
        X = vec.transform([text])
        if hasattr(clf, "predict_proba"): p = clf.predict_proba(X)[0]
        else:
            d = clf.decision_function(X)[0]; e = np.exp(d - d.max()); p = e/e.sum()
        idx = np.argsort(p)[::-1][:top_k]
        top = [{"category": self.classes[i], "confidence": round(float(p[i]),4)} for i in idx]
        return {"top": top, "drivers": self._drivers(X, vec, clf, idx[0])}

    def _drivers(self, X, vec, clf, cls_idx, n=8):
        """Words that pushed the prediction: tf-idf value x class weight (linear models) or feature importance."""
        names = np.array(vec.get_feature_names_out()); row = X.toarray()[0]
        if hasattr(clf, "coef_"): w = clf.coef_[cls_idx if clf.coef_.shape[0] > 1 else 0]
        elif hasattr(clf, "feature_importances_"): w = clf.feature_importances_
        elif hasattr(clf, "feature_log_prob_"): w = clf.feature_log_prob_[cls_idx]
        else: return []
        contrib = row * w; order = np.argsort(contrib)[::-1][:n * 3]
        return [names[i] for i in order if row[i] > 0 and not names[i].isdigit() and not (set(names[i].split()) & _JUNK)][:n]

    # ---- skill gap ----
    def skill_gap(self, resume: str, jd: str):
        r, j = extract_skills(resume), extract_skills(jd)
        matched, missing = sorted(r & j), sorted(j - r)
        coverage = len(matched)/len(j) if j else 0.0
        return {"resume_skills": sorted(r), "jd_skills": sorted(j), "matched": matched,
                "missing": [{"skill": s, "group": group_of(s)} for s in missing],
                "extra": sorted(r - j), "coverage": round(coverage,4)}

    # ---- match score ----
    def match_score(self, resume: str, jd: str):
        resume, jd = clean(resume), clean(jd)
        v = TfidfVectorizer(stop_words="english", ngram_range=(1,2), sublinear_tf=True).fit([resume, jd])
        sim = float(cosine_similarity(v.transform([resume]), v.transform([jd]))[0,0])
        gap = self.skill_gap(resume, jd)
        sim_scaled = min(1.0, sim/0.35)          # tf-idf cosine of a good match is rarely above ~0.35
        score = 100*(0.6*gap["coverage"] + 0.4*sim_scaled) if gap["jd_skills"] else 100*sim_scaled
        return {"score": round(score,1), "skill_coverage": gap["coverage"], "text_similarity": round(sim,4), "gap": gap}

    # ---- ATS score ----
    def ats_score(self, resume: str, jd: str | None = None):
        raw = resume; t = clean(resume); low = t.lower(); words = t.split(); n = len(words)
        checks = []
        def add(name, got, mx, tip): checks.append({"check": name, "points": round(got,1), "max": mx, "tip": tip})
        found = {k for k,p in SECTIONS.items() if re.search(p, low)}
        add("Standard sections", 25*len(found & {"experience","education","skills"})/3 + (5 if {"summary","projects"} & found else 0), 30,
            "Add clear Experience, Education and Skills headings" + ("" if found >= {"experience","education","skills"} else f" (missing: {', '.join(sorted({'experience','education','skills'}-found))})"))
        has_email = bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", t)); has_phone = bool(re.search(r"(\+?\d[\d\s().-]{8,}\d)", t)); has_link = bool(re.search(r"(linkedin|github)\.com", low))
        add("Contact details", 6*has_email + 4*has_phone + 5*has_link, 15, "Include email, phone and LinkedIn/GitHub links")
        add("Length", 15 if 350 <= n <= 900 else (10 if 250 <= n <= 1200 else 5), 15, f"Aim for 350-900 words (yours: {n})")
        nums = len(re.findall(r"\d+\s?%|\$\s?\d|\b\d{2,}\b", t))
        add("Quantified achievements", min(15, nums*2.5), 15, "Add numbers: accuracy, % improvement, users, time saved")
        verbs = sum(1 for w in re.findall(r"[a-z]+", low) if w in ACTION_VERBS)
        add("Action verbs", min(10, verbs*1.5), 10, "Start bullets with verbs like built, deployed, improved")
        ns = len(extract_skills(t)); add("Skill keywords", min(10, ns*1.0), 10, "List more relevant tools and technologies")
        if jd:
            g = self.skill_gap(t, jd); add("JD keyword coverage", 15*g["coverage"], 15, "Mirror missing JD skills you genuinely have")
        total = sum(c["points"] for c in checks); mx = sum(c["max"] for c in checks)
        return {"score": round(100*total/mx,1), "checks": checks}

    def analyze(self, resume: str, jd: str | None = None):
        out = {"category": self.predict_category(resume, top_k=5), "ats": self.ats_score(resume, jd)}
        if jd: out["match"] = self.match_score(resume, jd)
        else: out["skills"] = sorted(extract_skills(resume))
        return out
