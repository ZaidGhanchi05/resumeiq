import { useRef, useState } from 'react'
import { UploadCloud, FileText, Loader2, Sparkles, Check, Plus, X, Zap, ArrowRight, Briefcase, MessageCircle, BookmarkCheck } from 'lucide-react'
import { useApp } from '../state.jsx'
import { analyze } from '../api.js'
import { Card, StatCard, Chip, Pill, nice } from '../components/ui.jsx'
import { PillBars, Gauge, Bar } from '../components/charts.jsx'
import { SAMPLE_JD, SAMPLE_RESUME } from '../sample.js'

function Input({ file, setFile, text, setText, jd, setJd, label, setLabel, jdTitle, setJdTitle, user, onRun, loading, error }) {
  const ref = useRef(null)
  const [drag, setDrag] = useState(false)
  const pick = (f) => { if (f) { setFile(f); setText('') } }
  return (
    <div className="fade-up">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-semibold leading-tight tracking-tight">Resume Analyzer</h1>
          <p className="mt-1 text-sm text-mute">Upload a resume and a job description to get a match score, skill gaps and ATS feedback.</p>
        </div>
        <div className="flex gap-2">
          <Pill onClick={onRun} disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? 'Analyzing...' : 'Analyze resume'}
          </Pill>
          <Pill variant="outline" onClick={() => { setFile(null); setText(SAMPLE_RESUME); setJd(SAMPLE_JD) }}>Try sample</Pill>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="1. Your resume">
          <div
            onClick={() => ref.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]) }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-6 text-center transition
              ${drag ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50/40'}`}
          >
            <input ref={ref} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => pick(e.target.files[0])} />
            {file ? (
              <div className="flex items-center gap-3 text-sm font-medium">
                <FileText className="text-brand-700" size={20} /> {file.name}
                <button onClick={(e) => { e.stopPropagation(); setFile(null) }} className="rounded-full p-1 hover:bg-slate-100"><X size={14} /></button>
              </div>
            ) : (
              <>
                <UploadCloud className="mb-2 text-brand-600" size={28} />
                <p className="text-sm font-semibold">Drop your resume here or click to browse</p>
                <p className="mt-0.5 text-xs text-mute">PDF, DOCX or TXT, up to 5 MB</p>
              </>
            )}
          </div>
          <div className="my-3 flex items-center gap-3 text-[11px] uppercase tracking-wider text-mute">
            <span className="h-px flex-1 bg-slate-200" /> or paste text <span className="h-px flex-1 bg-slate-200" />
          </div>
          {user && <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="Version label, e.g. Resume v2 (saved to your history)"
            className="mb-3 w-full rounded-full border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white" />}
          <textarea value={text} onChange={(e) => { setText(e.target.value); setFile(null) }} rows={6}
            placeholder="Paste your resume text here..."
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-sm outline-none focus:border-brand-500 focus:bg-white" />
        </Card>

        <Card title="2. Job description" action={<Chip tone="slate">optional, unlocks match score</Chip>}>
          <input value={jdTitle} onChange={(e) => setJdTitle(e.target.value)} maxLength={120} placeholder="Job title (optional)"
            className="mb-3 w-full rounded-full border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white" />
          <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={13}
            placeholder="Paste the job description you are applying for..."
            className="h-[calc(100%-4.5rem)] min-h-[240px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-sm outline-none focus:border-brand-500 focus:bg-white" />
        </Card>
      </div>
      {error && <p className="mt-3 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">{error}</p>}
    </div>
  )
}

function Results({ r }) {
  const app = useApp()
  const m = r.match, ats = r.ats, top = r.category.top[0]
  const gap = m?.gap
  const [tab, setTab] = useState('missing')
  const passed = ats.checks.filter((c) => c.points >= 0.8 * c.max).length
  const verdict = !m ? null : m.score >= 70 ? 'Strong match' : m.score >= 45 ? 'Moderate match' : 'Needs work'
  return (
    <div className="mt-6 space-y-4">
      <div className="fade-up flex flex-wrap items-center gap-3">
        {r.saved_id ? <Chip tone="blue"><BookmarkCheck size={13} />Saved to your history</Chip>
          : !app.user && <button onClick={() => app.setAuthOpen(true)} className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100">Sign in to save this analysis and track your progress</button>}
        <span className="flex-1" />
        <Pill variant="outline" className="!px-4 !py-2 text-xs" onClick={() => app.go('jobs')}><Briefcase size={14} />Find matching jobs</Pill>
        <Pill variant="outline" className="!px-4 !py-2 text-xs" onClick={() => app.go('coach')}><MessageCircle size={14} />Ask the career coach</Pill>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard primary delay={0} label="Match score" value={m ? Math.round(m.score) : '--'} unit={m ? '/ 100' : ''}
          sub={m ? `${verdict} for this job description` : 'Add a job description to unlock'} />
        <StatCard delay={70} label="ATS score" value={Math.round(ats.score)} unit="/ 100" sub={`${passed} of ${ats.checks.length} checks passed`} />
        <StatCard delay={140} label="Predicted role" value={<span className="text-[26px] leading-tight">{nice(top.category)}</span>}
          sub={`${Math.round(top.confidence * 100)}% model confidence`} />
        <StatCard delay={210} label="Skill coverage" value={gap ? Math.round(gap.coverage * 100) : r.skills?.length ?? 0}
          unit={gap ? '%' : 'skills'} sub={gap ? `${gap.matched.length} of ${gap.jd_skills.length} JD skills found` : 'skills detected in your resume'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card title="Role prediction" className="lg:col-span-5"
          action={<Chip tone="blue">closest of 24 Kaggle job families</Chip>}>
          <PillBars items={r.category.top} />
        </Card>

        <Card title="Job match" className="lg:col-span-3">
          <Gauge value={m ? m.score : null} label={m ? 'resume vs job description' : 'no job description'}
            legend={m ? [{ text: `Skills ${Math.round(m.skill_coverage * 100)}%`, cls: 'bg-brand-700' }, { text: `Text ${Math.round(m.text_similarity * 100)}%`, cls: 'bg-brand-300' }] : null} />
        </Card>

        <Card title="Skill gap" className="lg:col-span-4"
          action={gap && (
            <div className="flex rounded-full bg-slate-100 p-0.5 text-xs font-semibold">
              {['missing', 'matched'].map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`rounded-full px-3 py-1 capitalize ${tab === t ? 'bg-white text-brand-800 shadow-sm' : 'text-mute'}`}>{t}</button>
              ))}
            </div>
          )}>
          {gap ? (
            <div className="max-h-[210px] overflow-auto pr-1">
              <div className="flex flex-wrap gap-2">
                {(tab === 'missing' ? gap.missing.map((x) => x.skill) : gap.matched).map((s) => (
                  <Chip key={s} tone={tab === 'missing' ? 'orange' : 'blue'}>
                    {tab === 'missing' ? <Plus size={12} /> : <Check size={12} />} {s}
                  </Chip>
                ))}
                {(tab === 'missing' ? gap.missing : gap.matched).length === 0 &&
                  <p className="text-sm text-mute">{tab === 'missing' ? 'No gaps found. Nice.' : 'No overlap yet.'}</p>}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(r.skills || []).map((s) => <Chip key={s}>{s}</Chip>)}
              <p className="mt-2 w-full text-xs text-mute">Paste a job description to see which skills you are missing.</p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card title="AI feedback" className="lg:col-span-5"
          action={<Chip tone={r.feedback.source === 'groq' ? 'blue' : 'slate'}>{r.feedback.source === 'groq' ? 'Groq Llama 3.1' : 'Rule-based coach'}</Chip>}>
          <p className="text-sm leading-relaxed text-ink/80">{r.feedback.summary}</p>
          {r.feedback.strengths?.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {r.feedback.strengths.map((s) => (
                <li key={s} className="flex gap-2 text-sm"><Check size={16} className="mt-0.5 shrink-0 text-brand-600" />{s}</li>
              ))}
            </ul>
          )}
          <h4 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-mute">Improve next</h4>
          <ol className="space-y-2">
            {r.feedback.improvements.map((s, i) => (
              <li key={s} className="flex gap-3 text-sm">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-orange-100 text-[11px] font-bold text-orange-700">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="ATS checklist" className="lg:col-span-4">
          <div className="space-y-3.5">
            {ats.checks.map((c) => {
              const low = c.points < 0.6 * c.max
              return (
                <div key={c.check}>
                  <div className="mb-1 flex justify-between text-[13px]">
                    <span className="font-medium">{c.check}</span>
                    <span className="text-mute">{c.points}/{c.max}</span>
                  </div>
                  <Bar value={c.points} max={c.max} warn={low} />
                  {low && <p className="mt-1 text-[11.5px] text-orange-700">{c.tip}</p>}
                </div>
              )
            })}
          </div>
        </Card>

        <section className="dark-card rounded-3xl p-5 text-white lg:col-span-3">
          <h3 className="text-[15px] font-semibold">Why this role?</h3>
          <p className="mt-1 text-xs text-brand-200">Words in your resume that pushed the prediction</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {r.category.drivers.map((w) => <Chip key={w} tone="dark">{w}</Chip>)}
          </div>
          <div className="mt-6 border-t border-white/15 pt-4">
            <div className="flex items-center gap-2 text-brand-200 text-xs"><Zap size={14} /> Analysis time</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">{r.meta.latency_ms}<span className="ml-1 text-base font-medium text-brand-200">ms</span></div>
            <p className="mt-1 text-xs text-brand-200">{r.meta.words.toLocaleString()} words processed</p>
          </div>
        </section>
      </div>
    </div>
  )
}

export default function Analyze() {
  const app = useApp()
  const [file, setFile] = useState(null)
  const [text, setText] = useState(app.resumeText)
  const [jd, setJd] = useState(app.jd)
  const [jdTitle, setJdTitle] = useState(app.jdTitle)
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const result = app.result

  const run = async () => {
    if (!file && text.trim().split(/\s+/).length < 50) { setError('Upload a resume or paste at least 50 words of resume text.'); return }
    setError(''); setLoading(true)
    try {
      const r = await analyze({ file, text, jd, label, jdTitle })
      app.setResult(r); app.setResumeText(r.resume_text); app.setJd(jd); app.setJdTitle(jdTitle)
    } catch (e) { setError(e.message); app.setResult(null) }
    finally { setLoading(false) }
  }
  return (
    <>
      <Input {...{ file, setFile, text, setText, jd, setJd, label, setLabel, jdTitle, setJdTitle, user: app.user, loading, error }} onRun={run} />
      {result && <Results r={result} />}
      {!result && !loading && (
        <p className="mt-6 flex items-center gap-2 text-sm text-mute">
          No resume handy? Press <b className="text-brand-800">Try sample</b> <ArrowRight size={14} /> then <b className="text-brand-800">Analyze resume</b>.
        </p>
      )}
    </>
  )
}
