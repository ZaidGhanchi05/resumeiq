import { ArrowUpRight } from 'lucide-react'

export function Card({ title, action, className = '', children }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function StatCard({ label, value, unit, sub, primary = false, delay = 0 }) {
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className={`fade-up rounded-3xl p-5 ${primary ? 'brand-card text-white' : 'card text-ink'}`}
    >
      <div className="flex items-start justify-between">
        <span className={`text-[14px] font-medium ${primary ? 'text-white/90' : 'text-ink'}`}>{label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-full border ${primary ? 'bg-white text-brand-700 border-white' : 'border-slate-300 text-ink'}`}>
          <ArrowUpRight size={15} />
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-[40px] font-semibold leading-none tracking-tight">{value}</span>
        {unit && <span className={`text-sm font-medium ${primary ? 'text-white/70' : 'text-mute'}`}>{unit}</span>}
      </div>
      <p className={`mt-3 text-xs ${primary ? 'text-brand-200' : 'text-mute'}`}>{sub}</p>
    </div>
  )
}

export function Chip({ children, tone = 'blue' }) {
  const tones = {
    blue: 'bg-brand-50 text-brand-700 border-brand-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
    dark: 'bg-white/10 text-white border-white/15',
  }
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>
}

export function Pill({ children, onClick, variant = 'solid', disabled, className = '' }) {
  const v = variant === 'solid'
    ? 'bg-brand-800 text-white hover:bg-brand-900 shadow-sm'
    : 'border border-brand-800 text-brand-800 hover:bg-brand-50'
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${v} ${className}`}>
      {children}
    </button>
  )
}

export const nice = (s = '') =>
  ({ 'INFORMATION-TECHNOLOGY': 'IT', 'BUSINESS-DEVELOPMENT': 'Biz Dev', 'PUBLIC-RELATIONS': 'PR', 'DIGITAL-MEDIA': 'Digital Media', HR: 'HR', BPO: 'BPO' }[s]
    || s.toLowerCase().replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
