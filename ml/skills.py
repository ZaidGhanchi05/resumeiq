"""Skill lexicon: canonical skill -> (group, aliases). Matching is whole-word, case-insensitive."""
import re
LEX = {
 # programming / data
 "Python":("Programming",["python"]),"Java":("Programming",["java"]),"JavaScript":("Programming",["javascript","js","es6"]),
 "TypeScript":("Programming",["typescript"]),"C++":("Programming",["c++"]),"C#":("Programming",["c#"]),"R":("Programming",["r programming","rstudio"]),
 "SQL":("Data",["sql","mysql","postgresql","postgres","sqlite","t-sql","pl/sql"]),"NoSQL":("Data",["nosql","mongodb","cassandra","dynamodb","firebase"]),
 "Pandas":("Data",["pandas"]),"NumPy":("Data",["numpy"]),"Matplotlib":("Data",["matplotlib"]),"Seaborn":("Data",["seaborn"]),
 "Data Visualisation":("Data",["data visualization","data visualisation","tableau","power bi","powerbi","matplotlib","seaborn","plotly"]),
 "Excel":("Data",["excel","spreadsheets","vlookup","pivot tables"]),"Data Analysis":("Data",["data analysis","data analytics","statistical analysis","eda"]),
 "Statistics":("Data",["statistics","statistical","hypothesis testing","regression analysis"]),
 # ml / ai
 "Machine Learning":("ML/AI",["machine learning","ml"]),"Deep Learning":("ML/AI",["deep learning","neural networks","cnn","rnn","lstm"]),
 "scikit-learn":("ML/AI",["scikit-learn","sklearn","scikit learn"]),"TensorFlow":("ML/AI",["tensorflow","keras"]),"PyTorch":("ML/AI",["pytorch"]),
 "XGBoost":("ML/AI",["xgboost","lightgbm","gradient boosting"]),"NLP":("ML/AI",["nlp","natural language processing","text mining"]),
 "Computer Vision":("ML/AI",["computer vision","opencv","image processing"]),"Classification":("ML/AI",["classification","classifier"]),
 "Regression":("ML/AI",["regression"]),"Clustering":("ML/AI",["clustering","k-means","kmeans"]),"Model Evaluation":("ML/AI",["model evaluation","cross-validation","cross validation","precision","recall","f1"]),
 "LLM":("ML/AI",["llm","llms","large language model","gpt","openai","anthropic","gemini","llama"]),"Prompt Engineering":("ML/AI",["prompt engineering","prompt design"]),
 "RAG":("ML/AI",["rag","retrieval augmented generation","retrieval-augmented generation"]),"LangChain":("ML/AI",["langchain","llamaindex","llama index"]),
 "Hugging Face":("ML/AI",["hugging face","huggingface","transformers"]),"Vector Database":("ML/AI",["vector database","faiss","pinecone","chromadb","chroma","pgvector","embeddings"]),
 "Jupyter":("Tools",["jupyter","colab"]),"Kaggle":("Tools",["kaggle"]),
 # backend / web / devops
 "FastAPI":("Backend",["fastapi"]),"Flask":("Backend",["flask"]),"Django":("Backend",["django"]),"Node.js":("Backend",["node.js","nodejs","express.js","express"]),
 "REST APIs":("Backend",["rest api","rest apis","restful","api development","microservices"]),"React":("Frontend",["react","react.js","reactjs","next.js"]),
 "HTML/CSS":("Frontend",["html","css","html5","css3","tailwind"]),"Git":("Tools",["git","github","gitlab","version control"]),
 "Docker":("DevOps",["docker","kubernetes","containers"]),"AWS":("DevOps",["aws","amazon web services","azure","gcp","google cloud"]),
 "CI/CD":("DevOps",["ci/cd","jenkins","github actions"]),"Linux":("DevOps",["linux","unix","bash","shell scripting"]),
 "Agile":("Process",["agile","scrum","kanban","jira"]),
 # business / soft
 "Communication":("Soft",["communication","presentation","public speaking","written communication"]),"Leadership":("Soft",["leadership","team lead","mentoring","managed a team","team management"]),
 "Project Management":("Business",["project management","pmp","stakeholder"]),"Budgeting":("Business",["budgeting","forecasting","financial reporting","budget"]),
 "Customer Service":("Business",["customer service","client relations","customer satisfaction"]),"Sales":("Business",["sales","business development","lead generation","crm","salesforce"]),
 "Marketing":("Business",["marketing","seo","social media","content creation","branding"]),"Recruitment":("Business",["recruitment","recruiting","talent acquisition","onboarding","payroll"]),
 "Accounting":("Business",["accounting","accounts payable","accounts receivable","reconciliation","gaap","auditing","quickbooks"]),
 "Teaching":("Business",["curriculum","lesson plans","classroom management","teaching"]),"Healthcare":("Business",["patient care","clinical","hipaa","nursing","medical records"]),
 "Design":("Business",["photoshop","illustrator","figma","adobe","ui/ux","graphic design"]),"Operations":("Business",["operations management","supply chain","logistics","inventory","quality assurance"]),
}
_PAT = {}
for canon,(grp,aliases) in LEX.items():
    alts = sorted(set(a.lower() for a in aliases+[canon]), key=len, reverse=True)
    _PAT[canon] = re.compile(r"(?<![A-Za-z0-9+#])(" + "|".join(re.escape(a) for a in alts) + r")(?![A-Za-z0-9+#])", re.I)

def extract_skills(text: str) -> set:
    return {c for c,p in _PAT.items() if p.search(text)}

def group_of(skill: str) -> str:
    return LEX[skill][0]
