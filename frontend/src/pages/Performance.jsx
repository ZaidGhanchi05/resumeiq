import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { BarChart, Bar as RBar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from 'recharts'
import { getMetrics, assetUrl } from '../api.js'
import { Card, StatCard, Chip, nice } from '../components/ui.jsx'

const pct = (x) => (x == null ? '--' : (Math.round(x * 1000) / 10).toFixed(1))

export default function Performance() {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { getMetrics().then(setD).catch((e) => setErr(e.message)) }, [])
  if (err) return <p className="rounded-2xl bg-orange-50 p-4 text-sm text-orange-700">{err}</p>
  if (!d) return <div className="grid h-64 place-items-center text-mute"><Loader2 className="animate-spin" /></div>

  const strict = d.summary?.text_no_title, ev = d.evaluation, rk = d.ranking?.test
  const rows = d.comparison || []
  const models = [...new Set(rows.map((r) => r.model))]
  const chart = models.map((m) => ({
    model: m,
    strict: Number(pct(rows.find((r) => r.model === m && r.variant === 'text_no_title')?.test_acc)),
    leaky: Number(pct(rows.find((r) => r.model === m && r.variant === 'text_full')?.test_acc)),
  }))
  const shipped = rows.find((r) => r.model === strict?.best_model && r.variant === 'text_no_title')
  const perClass = strict ? Object.entries(strict.per_class).map(([k, v]) => ({ name: nice(k), f1: Number(pct(v['f1-score'])), n: v.support }))
    .sort((a, b) => b.f1 - a.f1) : []

  return (
    <div className="space-y-4">
      <div className="fade-up">
        <h1 className="text-[34px] font-semibold leading-tight tracking-tight">Model performance</h1>
        <p className="mt-1 text-sm text-mute">Every number here is computed on a held-out test set the model never saw during training.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard primary label="Top-1 accuracy" value={pct(ev?.top1_accuracy)} unit="%" sub={`${strict?.best_model} on ${ev?.n_test} unseen resumes`} />
        <StatCard delay={70} label="Top-3 accuracy" value={pct(ev?.top3_accuracy)} unit="%" sub="true role within top 3 predictions" />
        <StatCard delay={140} label="Macro F1" value={pct(ev?.macro_f1)} unit="%" sub="averaged equally over 24 roles" />
        <StatCard delay={210} label="5-fold CV accuracy" value={pct(shipped?.cv_acc_mean)} unit="%" sub={`+/- ${pct(shipped?.cv_acc_std)} across folds`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card title="Model comparison (test accuracy %)" className="lg:col-span-7"
          action={<Chip tone="orange">title leakage check</Chip>}>
          <div className="h-[300px]">
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ left: -10, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#e8edf4" />
                <XAxis dataKey="model" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(15,23,42,.12)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <RBar isAnimationActive={false} dataKey="strict" name="Title removed (honest)" fill="#2563eb" radius={[8, 8, 0, 0]} />
                <RBar isAnimationActive={false} dataKey="leaky" name="With title line (leaky)" fill="#fdba74" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-mute">
            The first line of every Kaggle resume is its job title, which leaks the label. We report and ship the stricter model that never sees that line, so the accuracy reflects real-world resumes.
          </p>
        </Card>

        <Card title="Per-role F1 (shipped model)" className="lg:col-span-5">
          <div className="h-[330px] overflow-auto pr-1">
            <div style={{ height: Math.max(300, perClass.length * 20) }}>
              <ResponsiveContainer>
                <BarChart data={perClass} layout="vertical" margin={{ left: 20, right: 12 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10.5 }} tickLine={false} axisLine={false} interval={0} />
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(15,23,42,.12)' }} />
                  <RBar isAnimationActive={false} dataKey="f1" radius={[0, 8, 8, 0]} barSize={11}>
                    {perClass.map((p) => <Cell key={p.name} fill={p.f1 >= 70 ? '#2563eb' : p.f1 >= 50 ? '#60a5fa' : '#f97316'} />)}
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card title="Confusion matrix" className="lg:col-span-7">
          <img src={assetUrl('/reports/figures/05_confusion_text_no_title.png')} alt="Confusion matrix" className="w-full rounded-xl" />
        </Card>
        <div className="space-y-4 lg:col-span-5">
          <Card title="Resume-to-JD matching">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[['AUC', ev?.match_mean_auc], ['Precision@10', ev?.match_mean_precision_at_10], ['MRR', ev?.match_mean_reciprocal_rank]].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-brand-50 p-3">
                  <div className="text-2xl font-semibold text-brand-800">{v == null ? '--' : v.toFixed(2)}</div>
                  <div className="text-[11px] text-mute">{k}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-mute">Ranking test: given a job description for a role, do resumes of that role score above the rest?</p>
          </Card>
          <Card title="ATS scorer sanity check">
            <p className="text-sm">Complete resumes outscore truncated ones in <b className="text-brand-800">{pct(ev?.ats_full_beats_degraded_pct)}%</b> of cases
              ({ev?.ats_mean_full?.toFixed(0)} vs {ev?.ats_mean_degraded?.toFixed(0)} average).</p>
          </Card>
          {rk && (
            <Card title="Job retrieval (ChromaDB)" action={<Chip tone="blue">{d.ranking.embedder}</Chip>}>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[['Hit@3', rk['final(chosen w)']['hit@3']], ['Hit@1', rk['final(chosen w)']['hit@1']], ['Random', rk['random_baseline_hit@3']]].map(([k, v], i) => (
                  <div key={k} className={`rounded-2xl p-3 ${i === 2 ? 'bg-orange-50' : 'bg-brand-50'}`}>
                    <div className={`text-2xl font-semibold ${i === 2 ? 'text-orange-700' : 'text-brand-800'}`}>{pct(v)}%</div>
                    <div className="text-[11px] text-mute">{k}{i === 2 ? ' (hit@3)' : ''}</div></div>))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-mute">On {d.ranking.n_test_resumes} held-out resumes against {d.ranking.n_jobs} job listings, the right job family appears in the top 3 for {pct(rk['final(chosen w)']['hit@3'])}% of resumes. The 50/50 skill blend I first tried scored only {pct(rk.old_50_50_blend['hit@3'])}%, so the skill weight was tuned on a validation set. A small hand-written board: a sanity check, not a production benchmark.</p>
            </Card>
          )}
          <Card title="KMeans clustering (unsupervised)">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-mute"><th>k</th><th>Silhouette</th><th>ARI</th><th>NMI</th></tr></thead>
              <tbody>
                {(d.clustering || []).map((c) => (
                  <tr key={c.k} className="border-t border-slate-100"><td className="py-1 font-medium">{c.k}</td>
                    <td>{c.silhouette.toFixed(3)}</td><td>{c.ARI.toFixed(3)}</td><td>{c.NMI.toFixed(3)}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      <Card title="All models">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-xs text-mute">
              <th className="pb-2">Model</th><th>Input</th><th>CV acc</th><th>Test acc</th><th>Macro F1</th><th>Train time</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.model + r.variant} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{r.model}</td>
                  <td><Chip tone={r.variant === 'text_no_title' ? 'blue' : 'orange'}>{r.variant === 'text_no_title' ? 'title removed' : 'with title'}</Chip></td>
                  <td>{pct(r.cv_acc_mean)}% <span className="text-mute">+/-{pct(r.cv_acc_std)}</span></td>
                  <td>{pct(r.test_acc)}%</td><td>{pct(r.macro_f1)}%</td><td>{Math.round(r.train_seconds)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
