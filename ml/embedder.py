"""Text -> dense vector. Pluggable so the same code works offline and in production.

  LSAEmbedder  : TF-IDF + truncated SVD (latent semantic analysis). Trains in seconds on CPU,
                 no downloads. Default, and the one used for the reported evaluation.
  SBertEmbedder: sentence-transformers (all-MiniLM-L6-v2). Enable with EMBEDDER=sbert when the
                 model can be downloaded (e.g. on Hugging Face Spaces or your laptop).
"""
import os
from pathlib import Path
import joblib
import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import Normalizer

ROOT = Path(__file__).resolve().parent.parent
LSA_PATH = ROOT / "models" / "lsa_embedder.joblib"


class LSAEmbedder:
    name = "lsa-128"

    def __init__(self, dim: int = 128):
        self.dim = dim
        self.tfidf = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True,
                                     min_df=2, max_features=12000)
        self.svd = TruncatedSVD(dim, random_state=42)
        self.norm = Normalizer(copy=False)

    def fit(self, texts):
        X = self.tfidf.fit_transform(texts)
        self.svd.n_components = min(self.dim, X.shape[1] - 1)
        self.norm.transform(self.svd.fit_transform(X))
        self.svd.components_ = self.svd.components_.astype(np.float32)   # halves the file size
        self.tfidf.idf_ = self.tfidf.idf_.astype(np.float32)
        return self

    def embed(self, texts) -> list:
        Z = self.svd.transform(self.tfidf.transform(list(texts)))
        return self.norm.transform(Z).tolist()

    def save(self, path=LSA_PATH):
        joblib.dump(self, path, compress=3)


class SBertEmbedder:
    name = "sbert-minilm"

    def __init__(self, model="sentence-transformers/all-MiniLM-L6-v2"):
        from sentence_transformers import SentenceTransformer
        self.model = SentenceTransformer(model)

    def embed(self, texts) -> list:
        return self.model.encode(list(texts), normalize_embeddings=True).tolist()


_cached = None


def get_embedder():
    global _cached
    if _cached is None:
        if os.getenv("EMBEDDER", "lsa").lower() == "sbert":
            _cached = SBertEmbedder()
        else:
            if not LSA_PATH.exists():
                raise FileNotFoundError("models/lsa_embedder.joblib missing - run: python ml/build_embedder.py")
            _cached = joblib.load(LSA_PATH)
    return _cached
