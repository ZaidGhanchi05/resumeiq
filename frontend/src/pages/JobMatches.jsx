import { Fragment, useRef, useState } from 'react'
import { Loader2, Search, Plus, Trash2, X, Check, ArrowRight, Users, Briefcase, UploadCloud } from 'lucide-react'
import { rankJobs, addJob, deleteJob, rankCandidates } from '../api.js'
import { useApp } from '../state.jsx'
import { Card, Chip, Pill, nice } from '../components/ui.jsx'
import ResumePicker from '../components/ResumePicker.jsx'
import { Bar } from '../components/charts.jsx'

function Ring({ value }) {
  const r = 30, c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 76 76" className="h-[76px] w-[76px] shrink-0">
      <circle cx="38" cy="38" r={r} fill="none" stroke="#e8edf4" strokeWidth="9" />
      <circle cx="38" cy="38" r={r} fill="none" stroke="#2563eb" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(c * value) / 100} ${c}`} transform="rotate(-90 38 38)" style={{ transition: 'stroke-dasharray .8s ease' }} />
      <text x="38" y="43" textAnchor="middle" style={{ fontSize: 19, fontWeight: 700 }} className="fill-ink">{Math.round(value)}</text>
    </svg>
  )
}

function JobCard({ job, rank, onTailor, onDelete }) {
  return (
    <div className="fade-up card flex flex-col gap-4 p-5 sm:flex-row" style={{ animationDelay: `${rank * 50}ms` }}>
      <div className="flex items-start gap-4">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${rank === 1 ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand-800'}`}>{rank}</span>
        <Ring value={job.score} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[16px] font-semibold">{job.title}</h3>
          {job.source === 'custom' && <Chip tone="orange">your listing</Chip>}
          {job.category && <Chip tone="slate">{nice(job.category)}</Chip>}
        </div>
        <p className="mt-0.5 text-xs text-mute">{[job.company, job.location].filter(Boolean).join(' · ')}</p>
        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink/70">{job.snippet}</p>
        <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <div><div className="mb-1 flex justify-between text-[11px] text-mute"><span>Semantic fit</span><span>{Math.round(job.semantic)}</span></div><Bar value={job.semantic} /></div>
          <div><div className="mb-1 flex justify-between text-[11px] text-mute"><span>Skill match</span><span>{Math.round(job.skill_match)}</span></div><Bar value={job.skill_match} /></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.matched.slice(0, 6).map((s) => <Chip key={s}><Check size={11} />{s}</Chip>)}
          {job.missing.slice(0, 5).map((s) => <Chip key={s} tone="orange"><Plus size={11} />{s}</Chip>)}
        </div>
      </div>
      <div className="flex gap-2 sm:flex-col sm:items-end">
        <Pill variant="outline" className="!px-4 !py-2 text-xs" onClick={() => onTailor(job)}>Tailor for this job <ArrowRight size={13} /></Pill>
        {job.source === 'custom' && <button onClick={() => onDelete(job)} className="rounded-full p-2 text-mute hover:bg-orange-50 hover:text-orange-700" title="Delete"><Trash2 size={15} /></button>}
      </div>
    </div>
  )
}

function AddJobModal({ onClose, onAdded }) {
  const [f, setF] = useState({ title: '', company: '', location: '', description: '' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await addJob(f); onAdded() } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const field = 'w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white'
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="fade-up w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Add a job to your board</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100"><X size={16} /></button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input required className={`${field} sm:col-span-2`} placeholder="Job title" value={f.title} onChange={set('title')} />
          <input className={field} placeholder="Company" value={f.company} onChange={set('company')} />
          <input className={field} placeholder="Location" value={f.location} onChange={set('location')} />
          <textarea required rows={7} className={`${field} resize-none sm:col-span-2`} placeholder="Paste the job description (30+ words)" value={f.description} onChange={set('description')} />
        </div>
        {err && <p className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700">{err}</p>}
        <Pill className="mt-4 w-full" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />}Add and re-rank</Pill>
      </form>
    </div>
  )
}

function FindJobs() {
  const app = useApp()
  const [file, setFile] = useState(null)
  const [text, setText] = useState(app.resumeText)
  const [jobs, setJobs] = useState(null); const [meta, setMeta] = useState(null)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [adding, setAdding] = useState(false)

  const run = async () => {
    setErr(''); setBusy(true)
    try { const r = await rankJobs({ file, text }, 8); setJobs(r.jobs); setMeta(r.meta) }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const tailor = (j) => { app.setJd(j.description); app.setJdTitle(j.title); if (text) app.setResumeText(text); app.go('analyze') }
  const remove = async (j) => { try { await deleteJob(j.id); run() } catch (e) { setErr(e.message) } }

  return (
    <div className="space-y-4">
      <Card title="Your resume" action={
        <Pill variant="outline" className="!px-4 !py-2 text-xs" onClick={() => (app.user ? setAdding(true) : app.setAuthOpen(true))}><Plus size={14} />Add a job</Pill>}>
        <ResumePicker file={file} setFile={setFile} text={text} setText={setText} rows={4} />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Pill onClick={run} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}Find matching jobs</Pill>
          {meta && <span className="text-xs text-mute">Searched {meta.indexed} listings with {meta.embedder} embeddings in ChromaDB</span>}
        </div>
        {err && <p className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700">{err}</p>}
      </Card>
      {jobs && <div className="space-y-3">{jobs.map((j, i) => <JobCard key={j.id} job={j} rank={i + 1} onTailor={tailor} onDelete={remove} />)}</div>}
      {!jobs && !busy && <p className="text-sm text-mute">Paste or upload a resume to rank the job board. Sign in to add your own job listings.</p>}
      {adding && <AddJobModal onClose={() => setAdding(false)} onAdded={() => { setAdding(false); run() }} />}
    </div>
  )
}

function Recruiter() {
  const app = useApp()
  const ref = useRef(null)
  const [files, setFiles] = useState([]); const [jd, setJd] = useState(app.jd)
  const [res, setRes] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [open, setOpen] = useState(null)
  const run = async () => {
    setErr(''); setBusy(true)
    try { setRes(await rankCandidates(jd, files)); setOpen(null) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Candidate resumes" action={<Chip tone="slate">up to 15 files</Chip>}>
          <div onClick={() => ref.current?.click()} className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 px-4 py-6 text-center hover:border-brand-300 hover:bg-brand-50/40">
            <input ref={ref} type="file" multiple accept=".pdf,.docx,.txt" hidden onChange={(e) => setFiles(Array.from(e.target.files).slice(0, 15))} />
            <UploadCloud className="mb-2 text-brand-600" size={26} />
            <p className="text-sm font-semibold">{files.length ? `${files.length} resume${files.length > 1 ? 's' : ''} selected` : 'Click to select resumes'}</p>
            <p className="text-xs text-mute">PDF, DOCX or TXT</p>
          </div>
          {files.length > 0 && <ul className="mt-3 max-h-28 space-y-1 overflow-auto text-xs text-mute">{files.map((f) => <li key={f.name} className="truncate">{f.name}</li>)}</ul>}
        </Card>
        <Card title="Job description">
          <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={7} placeholder="Paste the role you are hiring for..."
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-sm outline-none focus:border-brand-500 focus:bg-white" />
        </Card>
      </div>
      <div className="flex items-center gap-3">
        <Pill onClick={run} disabled={busy || !files.length}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}Rank candidates</Pill>
        {err && <span className="text-sm font-medium text-orange-700">{err}</span>}
      </div>
      {res && (
        <Card title="Ranking">
          {res.skipped.length > 0 && <p className="mb-3 rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-700">Skipped: {res.skipped.map((s) => `${s.name} (${s.reason})`).join('; ')}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead><tr className="text-left text-xs text-mute"><th className="pb-2">#</th><th>Candidate</th><th className="w-44">Fit score</th><th>Role</th><th>ATS</th><th /></tr></thead>
              <tbody>
                {res.candidates.map((c) => (
                  <Fragment key={c.name}>
                    <tr className="border-t border-slate-100">
                      <td className="py-3 font-semibold text-brand-800">{c.rank}</td>
                      <td className="max-w-[200px] truncate font-medium">{c.name}</td>
                      <td><div className="flex items-center gap-2"><div className="w-24"><Bar value={c.score} /></div><span className="font-semibold">{Math.round(c.score)}</span></div></td>
                      <td><Chip tone="slate">{nice(c.category)}</Chip></td><td>{Math.round(c.ats)}</td>
                      <td><button onClick={() => setOpen(open === c.name ? null : c.name)} className="text-xs font-semibold text-brand-700 hover:underline">{open === c.name ? 'Hide' : 'Skills'}</button></td>
                    </tr>
                    {open === c.name && (
                      <tr><td /><td colSpan={5} className="pb-3"><div className="flex flex-wrap gap-1.5">
                        {c.matched.map((s) => <Chip key={s}><Check size={11} />{s}</Chip>)}{c.missing.map((s) => <Chip key={s} tone="orange"><Plus size={11} />{s}</Chip>)}
                      </div></td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

export default function JobMatches() {
  const [tab, setTab] = useState('jobs')
  return (
    <div className="space-y-4">
      <div className="fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[34px] font-semibold leading-tight tracking-tight">Job matches</h1>
          <p className="mt-1 text-sm text-mute">Vector search finds the closest jobs; the skill matcher explains each fit.</p>
        </div>
        <div className="flex rounded-full bg-white p-1 text-sm font-semibold shadow-sm">
          {[['jobs', 'Find jobs for me', Briefcase], ['recruiter', 'Recruiter mode', Users]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 ${tab === id ? 'bg-brand-800 text-white' : 'text-mute'}`}><Icon size={15} />{label}</button>
          ))}
        </div>
      </div>
      {tab === 'jobs' ? <FindJobs /> : <Recruiter />}
    </div>
  )
}
