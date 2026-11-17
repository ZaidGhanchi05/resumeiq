"""Clean the Kaggle resume dataset and build two text variants:
  text_full      - full resume text
  text_no_title  - same text with the leading job-title line removed (stricter, avoids label leakage)
"""
import re, pandas as pd
from pathlib import Path

RAW = Path("data/raw/Resume.csv")
OUT = Path("data/processed/resumes_clean.csv")

def normalise(t: str) -> str:
    t = t.replace("\xa0", " ")
    t = re.sub(r"[^\x00-\x7F]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()

def split_title(raw: str):
    raw = raw.replace("\xa0", " ").lstrip()
    m = re.split(r"\s{3,}", raw, maxsplit=1)
    title = m[0].strip()
    rest = m[1] if len(m) > 1 else ""
    return title, rest

def main():
    df = pd.read_csv(RAW, usecols=["ID", "Resume_str", "Category"])
    df = df.drop_duplicates(subset="Resume_str").copy()
    parts = df.Resume_str.map(split_title)
    df["title"] = parts.map(lambda p: normalise(p[0]))
    df["text_no_title"] = parts.map(lambda p: normalise(p[1]))
    df["text_full"] = df.Resume_str.map(normalise)
    df["n_words"] = df.text_full.str.split().str.len()
    df = df[df.n_words >= 50].drop(columns="Resume_str").reset_index(drop=True)
    df.to_csv(OUT, index=False)
    print(f"saved {OUT}: {df.shape}, classes={df.Category.nunique()}")

if __name__ == "__main__":
    main()
