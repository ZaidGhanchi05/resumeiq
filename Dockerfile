# Hugging Face Spaces (Docker SDK) / any container host. Serves the API on port 7860.
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ml ./ml
COPY backend ./backend
COPY models ./models
COPY reports ./reports
COPY data/jobs_seed.json ./data/jobs_seed.json
# SQLite + Chroma need a writable folder. Free Spaces lose it on restart: set DATABASE_URL to Postgres to keep accounts/history.
RUN mkdir -p data && chmod -R 777 data
ENV PORT=7860 CHROMA_PATH=memory
EXPOSE 7860
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
