import os, sys, tempfile
from pathlib import Path
import pytest

_TMP = tempfile.mkdtemp()                     # isolate tests from real data: temp SQLite DB, in-memory vector index
os.environ.update(DATABASE_URL=f"sqlite:///{_TMP}/test.db", CHROMA_PATH="memory", JWT_SECRET="test-secret-test-secret-test-secret-32b")
os.environ["GROQ_API_KEY"] = ""   # present-but-empty so a real key in .env can never leak into the tests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

ML_RESUME = """Summary Machine learning engineer with experience in Python, Pandas, NumPy and scikit-learn.
Experience Built and deployed a churn classification model using XGBoost and FastAPI, improved accuracy by 12%.
Developed a retrieval augmented generation chatbot with LangChain and FAISS. Analysed 50000 records with SQL and Seaborn.
Led a team of 4 engineers and documented experiments in Jupyter Notebook. Education B.Tech Computer Science.
Skills Python SQL Git GitHub Docker Flask TensorFlow Hugging Face prompt engineering model evaluation clustering.
Projects Customer churn predictor, document question answering bot, sales dashboard.
Contact jane@example.com +91 98765 43210 github.com/jane linkedin.com/in/jane """ * 2

CHEF_RESUME = """Summary Executive chef with fifteen years leading kitchens. Experience Designed seasonal menus, managed food cost,
trained line cooks, ensured food safety and sanitation, prepared dishes in a high volume restaurant and handled inventory ordering.
Education Culinary arts diploma. Skills Menu design, butchery, pastry, kitchen management. """ * 3

ML_JD = ("Machine learning intern: Python, Pandas, NumPy, scikit-learn, classification, clustering, model evaluation, "
         "SQL, FastAPI, RAG pipelines with vector databases, prompt engineering, Jupyter, Git, PyTorch, Kaggle.")


@pytest.fixture(scope="session")
def analyzer():
    from ml.analyzer import Analyzer
    return Analyzer()
