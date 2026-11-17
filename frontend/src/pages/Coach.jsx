import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, Sparkles, Copy, Check, RotateCcw, MessageCircle, Wand2, FileText, ChevronDown } from 'lucide-react'
import { coachStart, coachChat, coachRewrite, coachLetter } from '../api.js'
import { useApp } from '../state.jsx'
import { Card, Chip, Pill } from '../components/ui.jsx'
import ResumePicker from '../components/ResumePicker.jsx'

const modeChip = (m) => m === 'groq' ? <Chip tone="blue">Groq Llama 3.1</Chip> : <Chip tone="orange">{m === 'template' ? 'Template mode' : 'Offline mode'}</Chip>
const area = 'w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-sm outline-none focus:border-brand-500 focus:bg-white'

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false)
  return <button onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200) }}
    className="rounded-full p-1.5 text-mute hover:bg-brand-50 hover:text-brand-700" title="Copy">{ok ? <Check size={15} /> : <Copy size={15} />}</button>
}

function Sources({ items }) {
  const [open, setOpen] = useState(false)
  if (!items?.length) return null
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700"><ChevronDown size={12} className={open ? 'rotate-180' : ''} />Sources ({items.length})</button>
      {open && <ul className="mt-1.5 space-y-1.5">{items.map((s) => (
        <li key={s.id} className="rounded-xl bg-slate-50 px-3 py-2 text-[11.5px] leading-snug text-ink/70"><b className="text-brand-800">[{s.id}]</b> <span className="text-mute">{s.source === 'jd' ? 'job description' : 'resume'} · similarity {s.score}</span><br />{s.text}</li>))}</ul>}
    </div>
  )
}

function Chat() {
  const app = useApp()
  const [file, setFile] = useState(null); const [text, setText] = useState(app.resumeText); const [jd, setJd] = useState(app.jd)
  const [session, setSession] = useState(null); const [msgs, setMsgs] = useState([]); const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const end = useRef(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [msgs, busy])

  const start = async () => {
    setErr(''); setBusy(true)
    try { setSession(await coachStart({ file, text }, jd)); setMsgs([]) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const send = async (q) => {
    const message = (q ?? input).trim(); if (!message || busy) return
    const history = msgs.map((m) => ({ role: m.role, content: m.content }))
    setMsgs((m) => [...m, { role: 'user', content: message }]); setInput(''); setBusy(true); setErr('')
    try {
      const r = await coachChat(session.session_id, message, history)
      setMsgs((m) => [...m, { role: 'assistant', content: r.answer, sources: r.sources, mode: r.mode }])
    } catch (e) {
      if (e.status === 404) { setSession(null); setErr('This session expired. Start a new one.') } else setErr(e.message)
    } finally { setBusy(false) }
  }

  if (!session) return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="1. Your resume"><ResumePicker file={file} setFile={setFile} text={text} setText={setText} rows={7} /></Card>
      <Card title="2. Job description" action={<Chip tone="slate">optional</Chip>}>
        <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={11} placeholder="Paste a job description so the coach can tailor its advice..." className={area} />
      </Card>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <Pill onClick={start} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}Start coaching session</Pill>
        {err && <span className="text-sm font-medium text-orange-700">{err}</span>}
        <span className="text-xs text-mute">Your documents are split into passages and indexed so answers stay grounded in what you wrote.</span>
      </div>
    </div>
  )
  const lastMode = [...msgs].reverse().find((m) => m.mode)?.mode ?? session.mode
  const ideas = ['What skills am I missing?', 'What should I fix first?', 'How do I improve my summary?', 'Which project should I highlight?']
  return (
    <Card className="flex min-h-[520px] flex-col" title="Career coach" action={<div className="flex items-center gap-2">{modeChip(lastMode)}
      <button onClick={() => { setSession(null); setMsgs([]) }} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-mute hover:bg-slate-100"><RotateCcw size={13} />New session</button></div>}>
      <div className="flex-1 space-y-4 overflow-y-auto pr-1" style={{ maxHeight: 460 }}>
        {msgs.length === 0 && <div className="rounded-2xl bg-brand-50/70 p-4 text-sm text-ink/80">Indexed <b>{session.resume_chunks}</b> resume passages{session.jd_chunks ? <> and <b>{session.jd_chunks}</b> job-description passages</> : ''}. Ask anything, or try a suggestion below.</div>}
        {msgs.map((m, i) => m.role === 'user' ? (
          <div key={i} className="flex justify-end"><div className="max-w-[82%] rounded-2xl rounded-br-md bg-brand-800 px-4 py-2.5 text-sm text-white">{m.content}</div></div>
        ) : (
          <div key={i} className="flex"><div className="max-w-[88%] rounded-2xl rounded-bl-md bg-slate-50 px-4 py-3 text-sm leading-relaxed">
            <p className="whitespace-pre-wrap">{m.content}</p><Sources items={m.sources} /></div></div>
        ))}
        {busy && <div className="flex items-center gap-2 text-xs text-mute"><Loader2 size={14} className="animate-spin" />Thinking...</div>}
        <div ref={end} />
      </div>
      {err && <p className="mt-2 text-xs font-medium text-orange-700">{err}</p>}
      <div className="mt-3 flex flex-wrap gap-2">{ideas.map((q) => <button key={q} onClick={() => send(q)} className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-100">{q}</button>)}</div>
      <form onSubmit={(e) => { e.preventDefault(); send() }} className="mt-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your resume..." maxLength={1000}
          className="flex-1 rounded-full border border-slate-200 bg-slate-50/60 px-5 py-3 text-sm outline-none focus:border-brand-500 focus:bg-white" />
        <button disabled={busy || !input.trim()} className="grid h-11 w-11 place-items-center rounded-full bg-brand-800 text-white hover:bg-brand-900 disabled:opacity-50"><Send size={16} /></button>
      </form>
    </Card>
  )
}

function Rewriter() {
  const app = useApp()
  const [bullet, setBullet] = useState(''); const [jd, setJd] = useState(app.jd)
  const [r, setR] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const run = async () => { setErr(''); setBusy(true); try { setR(await coachRewrite(bullet, jd)) } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Your bullet point">
        <textarea value={bullet} onChange={(e) => setBullet(e.target.value)} rows={4} placeholder="e.g. worked on a chatbot using LangChain and FAISS" className={area} />
        <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={4} placeholder="Optional: paste the job description to match its keywords" className={`${area} mt-3`} />
        <div className="mt-3 flex items-center gap-3"><Pill onClick={run} disabled={busy || bullet.trim().split(/\s+/).length < 3}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}Rewrite</Pill>
          {err && <span className="text-sm font-medium text-orange-700">{err}</span>}</div>
      </Card>
      <Card title="Improved versions" action={r && modeChip(r.mode)}>
        {!r ? <p className="text-sm text-mute">Three stronger rewrites will appear here. Numbers in [brackets] are placeholders; only use real ones.</p> : (
          <div className="space-y-3">
            {r.versions.map((v, i) => (
              <div key={i} className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-sm"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-800">{i + 1}</span><p className="flex-1 leading-relaxed">{v}</p><CopyBtn text={v} /></div>))}
            {r.tips?.length > 0 && <ul className="space-y-1 text-xs text-mute">{r.tips.map((t) => <li key={t}>• {t}</li>)}</ul>}
            {r.note && <p className="rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-700">{r.note}</p>}
          </div>)}
      </Card>
    </div>
  )
}

function CoverLetter() {
  const app = useApp()
  const [file, setFile] = useState(null); const [text, setText] = useState(app.resumeText); const [jd, setJd] = useState(app.jd)
  const [f, setF] = useState({ name: '', company: '', role: app.jdTitle })
  const [r, setR] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [out, setOut] = useState('')
  const run = async () => {
    setErr(''); setBusy(true)
    try {
      const res = await coachLetter({ file, text, jd, ...f }); setR(res); setOut(res.text)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const inp = 'rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white'
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Card title="Your resume"><ResumePicker file={file} setFile={setFile} text={text} setText={setText} rows={5} /></Card>
        <Card title="The job">
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <input className={inp} placeholder="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input className={inp} placeholder="Company" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
            <input className={inp} placeholder="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} />
          </div>
          <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={5} placeholder="Paste the job description" className={area} />
          <div className="mt-3 flex items-center gap-3"><Pill onClick={run} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}Write cover letter</Pill>
            {err && <span className="text-sm font-medium text-orange-700">{err}</span>}</div>
        </Card>
      </div>
      <Card title="Cover letter" action={r && <div className="flex items-center gap-2">{modeChip(r.mode)}<CopyBtn text={out} /></div>}>
        {!r ? <p className="text-sm text-mute">Your letter appears here, ready to edit. It only uses facts from your resume.</p> : (
          <>
            <textarea value={out} onChange={(e) => setOut(e.target.value)} rows={18} className={`${area} leading-relaxed`} />
            {r.note && <p className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-700">{r.note}</p>}
          </>)}
      </Card>
    </div>
  )
}

export default function Coach() {
  const [tab, setTab] = useState('chat')
  return (
    <div className="space-y-4">
      <div className="fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[34px] font-semibold leading-tight tracking-tight">Career coach</h1>
          <p className="mt-1 text-sm text-mute">Grounded in your resume and the job description. Works offline too, with an LLM key it gets sharper.</p>
        </div>
        <div className="flex rounded-full bg-white p-1 text-sm font-semibold shadow-sm">
          {[['chat', 'Chat', MessageCircle], ['rewrite', 'Bullet rewriter', Wand2], ['letter', 'Cover letter', FileText]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 ${tab === id ? 'bg-brand-800 text-white' : 'text-mute'}`}><Icon size={15} />{label}</button>
          ))}
        </div>
      </div>
      {tab === 'chat' ? <Chat /> : tab === 'rewrite' ? <Rewriter /> : <CoverLetter />}
    </div>
  )
}
