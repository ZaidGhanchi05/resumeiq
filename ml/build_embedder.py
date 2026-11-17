"""Fit the LSA embedder on the TRAIN split of the Kaggle resumes + the seed job board.
(Test resumes are excluded so the ranking evaluation stays leakage-free.)"""
import sys, json
sys.path.insert(0, ".")
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from ml.embedder import LSAEmbedder
from ml.analyzer import clean

df = pd.read_csv("data/processed/resumes_clean.csv")
y = LabelEncoder().fit_transform(df.Category)
Xtr, _, _, _ = train_test_split(df.text_no_title, y, test_size=0.2, stratify=y, random_state=42)
jobs = json.load(open("data/jobs_seed.json"))
corpus = [clean(t) for t in Xtr] + [clean(j["title"] + " " + j["description"]) for j in jobs] * 3
emb = LSAEmbedder(128).fit(corpus)
emb.save()
print("fitted on", len(corpus), "docs; dim", emb.svd.n_components, "-> models/lsa_embedder.joblib")
