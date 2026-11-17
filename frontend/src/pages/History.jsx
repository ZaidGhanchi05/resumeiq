import { useEffect, useState } from 'react'
import { Loader2, Lock, Trash2, ArrowUpRight, LineChart as LineIcon } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { getHistory, getHistoryItem, deleteHistoryItem } from '../api.js'
import { useApp } from '../state.jsx'
import { Card, StatCard, Chip, Pill, nice } from '../components/ui.jsx'

const fmt = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export default function History() {
  const app = useApp()
  const [items, setItems] = useState(null); const [err, setErr] = useState('')
  const load = () => getHistory().then((r) => setItems(r.items)).catch((e) => setErr(e.message))
  useEffect(() => { if (app.user) load(); else setItems(null) }, [app.user])

  const open = async (id) => {
    try { const full = await getHistoryItem(id); app.setResult(full.result); app.setJd(''); app.setJdTitle(full.jd_title || ''); app.go('analyze') }
    catch (e) { setErr(e.message) }
  }
  const remove = async (id) => { try { await deleteHistoryItem(id); load() } catch (e) { setErr(e.message) } }

  if (!app.user) return (
    <div className="space-y-4">
      <div className="fade-up"><h1 className="text-[34px] font-semibold leading-tight tracking-tight">History</h1>
        <p className="mt-1 text-sm text-mute">Track how your resume improves from one version to the next.</p></div>
      <Card className="grid place-items-center py-14 text-center">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Lock size={24} /></span>
        <h3 className="text-lg font-semibold">Sign in to save your analyses</h3>
        <p className="mt-1 max-w-sm text-sm text-mute">Every analysis you run while signed in is saved with its scores, so you can chart your progress. Your resume text itself is never stored.</p>
        <Pill className="mt-5" onClick={() => app.setAuthOpen(true)}>Sign in or create account</Pill>
      </Card>
    </div>
  )
  if (!items) return <div className="grid h-64 place-items-center text-mute">{err ? <p className="text-orange-700">{err}</p> : <Loader2 className="animate-spin" />}</div>

  const asc = [...items].reverse()
  const chart = asc.map((i) => ({ when: fmt(i.created_at), name: i.label, 'ATS score': Math.round(i.ats_score), 'Match score': i.match_score == null ? null : Math.round(i.match_score) }))
  const matches = items.filter((i) => i.match_score != null)
  const delta = asc.length > 1 ? Math.round(asc[asc.length - 1].ats_score - asc[0].ats_score) : null
  return (
    <div className="space-y-4">
      <div className="fade-up"><h1 className="text-[34px] font-semibold leading-tight tracking-tight">History</h1>
        <p className="mt-1 text-sm text-mute">Signed in as {app.user.email}</p></div>
      {items.length === 0 ? (
        <Card className="grid place-items-center py-14 text-center">
          <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700"><LineIcon size={24} /></span>
          <h3 className="text-lg font-semibold">No saved analyses yet</h3>
          <p className="mt-1 text-sm text-mute">Run an analysis on the Analyzer page while signed in and it appears here.</p>
          <Pill className="mt-5" onClick={() => app.go('analyze')}>Go to Analyzer</Pill>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard primary label="Analyses saved" value={items.length} sub="newest first below" />
            <StatCard delay={70} label="Best match score" value={matches.length ? Math.round(Math.max(...matches.map((m) => m.match_score))) : '--'} unit={matches.length ? '/ 100' : ''} sub={matches.length ? 'highest against any job description' : 'add a job description to track it'} />
            <StatCard delay={140} label="Latest ATS score" value={Math.round(items[0].ats_score)} unit="/ 100" sub={items[0].label} />
            <StatCard delay={210} label="ATS change" value={delta == null ? '--' : `${delta > 0 ? '+' : ''}${delta}`} unit={delta == null ? '' : 'pts'} sub={delta == null ? 'needs two analyses' : 'first analysis to latest'} />
          </div>
          <Card title="Score over time">
            <div className="h-[260px]">
              <ResponsiveContainer>
                <LineChart data={chart} margin={{ left: -15, right: 12, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="#e8edf4" />
                  <XAxis dataKey="when" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(15,23,42,.12)' }} labelFormatter={(l, p) => p?.[0]?.payload?.name ? `${p[0].payload.name} (${l})` : l} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="ATS score" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} connectNulls />
                  <Line type="monotone" dataKey="Match score" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="All analyses">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="text-left text-xs text-mute"><th className="pb-2">Version</th><th>Job</th><th>Role</th><th>ATS</th><th>Match</th><th>Date</th><th /></tr></thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-t border-slate-100">
                      <td className="py-3 font-medium">{i.label}</td><td className="text-mute">{i.jd_title || '-'}</td>
                      <td><Chip tone="slate">{nice(i.category)}</Chip></td><td>{Math.round(i.ats_score)}</td><td>{i.match_score == null ? '-' : Math.round(i.match_score)}</td>
                      <td className="text-mute">{fmt(i.created_at)}</td>
                      <td className="text-right"><button onClick={() => open(i.id)} className="mr-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">Open <ArrowUpRight size={12} /></button>
                        <button onClick={() => remove(i.id)} className="rounded-full p-1.5 text-mute hover:bg-orange-50 hover:text-orange-700" title="Delete"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {err && <p className="text-sm font-medium text-orange-700">{err}</p>}
    </div>
  )
}
