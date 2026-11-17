# ResumeIQ

AI resume analyzer, job matcher and career coach. Upload a resume and a job description to get a predicted job family,
a match score, missing skills, an ATS score and AI feedback. Rank a job board for a resume (or rank candidates for a job)
with a vector database, chat with a coach grounded in your own documents, rewrite weak bullet points, draft cover letters
and track your scores across resume versions.

**Stack:** Python, Pandas, NumPy, scikit-learn, XGBoost, ChromaDB, FastAPI, SQLAlchemy (SQLite / PostgreSQL), JWT,
Groq Llama 3.1, React, Vite, Tailwind CSS, Recharts, pytest, Docker.

## Features

| Page | What it does | Tech |
|---|---|---|
| Analyzer | Role prediction, resume-vs-JD match score, skill gap, ATS score, AI feedback | TF-IDF + XGBoost, skill lexicon, Groq |
| Job matches | Ranks a job board for your resume. Recruiter mode ranks up to 15 resumes for one job. Signed-in users can add their own listings | ChromaDB, embeddings, retrieve and re-rank |
| Career coach | Chat grounded in your resume and JD with cited passages, bullet rewriter, cover letter writer | RAG over per-session ChromaDB collections |
| History | Accounts, saved analyses, score-over-time chart | SQLAlchemy, scrypt, JWT |
| Model performance | Evaluation metrics, model comparison, confusion matrix | Recharts |

Every LLM-backed feature has an offline fallback, so the app works without an API key.

## Results

Measured on data the models never saw during training or tuning.

| Metric | Value |
|---|---|
| Role classifier top-1 accuracy (24 classes, 497 test resumes) | 73.6% |
| Role classifier top-3 accuracy | 93.2% |
| Macro F1 / 5-fold CV accuracy | 68.7% / 70.7% (+/- 1.7) |
| Resume-to-JD matching, mean ROC-AUC | 0.88 |
| Job retrieval hit@3 (433 test resumes, 30 listings; random baseline 14.6%) | 73.9% |
| Job retrieval hit@1 / MRR | 51.0% / 0.61 |
| Automated tests | 32 |

Dataset: Kaggle [Resume Dataset](https://www.kaggle.com/datasets/snehaanbhawal/resume-dataset) (about 2,500 resumes, 24 job categories).
Five models were compared with stratified 5-fold cross-validation (Complement NB, Logistic Regression, Linear SVM,
Random Forest, XGBoost); XGBoost is shipped. Full tables are in `reports/` and on the Model performance page.

Notes on the evaluation:
- The first line of every resume in the dataset is its job title, which leaks the label (79.5% accuracy with it). It is removed for the shipped model.
- The skill weight in the job ranking (0.1) was chosen on a validation sample from the training split and evaluated once on the test split. Vector similarity carries the accuracy; the skill matcher adds explainability (matched and missing skills).
- The job board is 30 hand-written listings, so retrieval metrics are a sanity check rather than a production benchmark.
- The ATS scorer is rule-based and is only sanity-checked.

## Limitations

- The dataset has no data-science or ML category, so an ML resume is usually labelled "Engineering" or "IT". Read the prediction as the closest of 24 generic job families.
- Tree-model probabilities are over-confident; calibration would improve the confidence shown.
- Embeddings are LSA (TF-IDF + SVD), which needs no downloads. Set `EMBEDDER=sbert` to use sentence-transformers.
- Tests mock the LLM; without a Groq key the offline fallbacks are used.

## Project structure

```
ml/         training, evaluation, analyzer, embeddings, job store, coach, LLM client
backend/    FastAPI app: auth, history, jobs, coach routes, SQL models
frontend/   React + Vite + Tailwind dashboard
data/       job board seed (jobs_seed.json); Kaggle CSV goes in data/raw/
models/     trained classifier and embedder
reports/    metrics, figures, comparison tables
tests/      pytest suite
```

## Setup

Requires Python 3.11+ and Node 18+.

```bash
pip install -r requirements.txt
```

Download `Resume.csv` from the Kaggle dataset above into `data/raw/`, then train and evaluate (the trained models in `models/` are already included, so this step is optional):

```bash
python ml/eda.py
python ml/prepare_data.py
python ml/train.py
python ml/evaluate.py
python ml/build_embedder.py
python ml/eval_ranking.py
```

Configure `.env` (all values are optional; see the comments inside the file), then start the API and the frontend:

```bash
uvicorn backend.main:app --port 8000
cd frontend && npm install && npm run dev
```

Open http://localhost:5173. Run the tests with `pytest`.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/analyze` | Analyze a resume (file or text) with an optional job description |
| POST | `/api/jobs/rank` | Rank job listings for a resume |
| POST | `/api/candidates/rank` | Rank up to 15 resumes for one job description |
| GET / POST / DELETE | `/api/jobs` | List, add, delete your custom listings (add and delete need sign-in) |
| POST | `/api/coach/session`, `/api/coach/chat` | Start a grounded coaching session and chat |
| POST | `/api/coach/rewrite`, `/api/coach/cover-letter` | Bullet rewriter and cover letter |
| POST | `/api/auth/register`, `/api/auth/login` | Create an account / sign in |
| GET / DELETE | `/api/history`, `/api/history/{id}` | Saved analyses (signed-in users) |
| GET | `/api/metrics`, `/api/health` | Evaluation numbers and service status |

Interactive docs are served at `/docs`.

## Docker

```bash
docker build -t resumeiq .
docker run -p 7860:7860 resumeiq
```
