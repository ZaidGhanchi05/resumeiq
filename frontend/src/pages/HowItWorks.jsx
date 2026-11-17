import { FileUp, Eraser, Brain, Target, ShieldCheck, Sparkles, Briefcase, MessageCircle, Database } from 'lucide-react'
import { Card, Chip } from '../components/ui.jsx'

const steps = [
  [FileUp, 'Extract', 'PDF, DOCX or TXT is converted to plain text (pypdf, python-docx).'],
  [Eraser, 'Clean', 'URLs, symbols and whitespace are normalised so training and serving see identical text.'],
  [Brain, 'Predict role', 'TF-IDF features feed a classifier chosen by 5-fold cross validation from five candidates. The top words that drove the prediction are shown.'],
  [Target, 'Match and gap', 'Skill extraction against a 150+ skill lexicon, plus TF-IDF cosine similarity with the job description, combined into one score.'],
  [ShieldCheck, 'ATS score', 'Rule-based checks: standard sections, contact details, length, quantified results, action verbs and keyword coverage.'],
  [Sparkles, 'AI feedback', 'Groq Llama 3.1 writes specific advice grounded in the facts above, with a deterministic fallback if the API is unavailable.'],
  [Briefcase, 'Job matching', 'Resumes and job listings become vectors in ChromaDB. A cosine search shortlists the closest jobs, and the skill matcher explains each fit. Recruiters can rank many resumes for one job.'],
  [MessageCircle, 'Career coach (RAG)', 'Your resume and the job description are split into passages and indexed per session. Questions retrieve the best passages and the answer cites them, so it stays grounded in what you wrote.'],
  [Database, 'History (SQL)', 'Signed-in users get every analysis saved in SQL (SQLite, or Postgres via DATABASE_URL) with hashed passwords and JWT sessions. Only scores are stored, never your resume text.'],
]

export default function HowItWorks() {
  return (
    <div className="space-y-4">
      <div className="fade-up">
        <h1 className="text-[34px] font-semibold leading-tight tracking-tight">How it works</h1>
        <p className="mt-1 text-sm text-mute">From upload to advice to job matches: the pipeline behind each page.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {steps.map(([Icon, t, d], i) => (
          <Card key={t}>
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon size={19} /></span>
              <div><div className="text-[11px] font-bold uppercase tracking-wider text-mute">Step {i + 1}</div><div className="font-semibold">{t}</div></div>
            </div>
            <p className="text-sm leading-relaxed text-ink/75">{d}</p>
          </Card>
        ))}
      </div>
      <Card title="Tech stack">
        <div className="flex flex-wrap gap-2">
          {['Python', 'Pandas', 'NumPy', 'scikit-learn', 'XGBoost', 'KMeans', 'TF-IDF', 'FastAPI', 'ChromaDB', 'RAG', 'Embeddings (LSA)', 'SQLAlchemy', 'SQLite / PostgreSQL', 'JWT', 'Groq Llama 3.1', 'React', 'Vite', 'Tailwind CSS', 'Recharts', 'pytest', 'Docker', 'Hugging Face Spaces', 'Vercel'].map((s) => <Chip key={s}>{s}</Chip>)}
        </div>
      </Card>
    </div>
  )
}
