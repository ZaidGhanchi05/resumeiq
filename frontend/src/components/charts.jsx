import { nice } from './ui.jsx'

/* Vertical "pill" bars - solid fill over a hatched track, like the reference dashboard. */
export function PillBars({ items }) {
  const tones = ['bg-brand-900', 'bg-brand-700', 'bg-brand-500', 'bg-brand-300', 'bg-brand-200']
  return (
    <div className="flex h-[210px] items-end justify-between gap-3 px-1">
      {items.map((it, i) => {
        const pct = Math.max(6, Math.round(it.confidence * 100))
        return (
          <div key={it.category} className="flex w-full min-w-0 flex-col items-center gap-2">
            <div className="hatch relative h-[150px] w-full max-w-[52px] overflow-hidden rounded-full">
              <div className={`absolute inset-x-0 bottom-0 rounded-full transition-all duration-700 ${tones[i] || tones[4]}`}
                   style={{ height: `${pct}%` }} />
              <span className={`absolute left-1/2 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[10px] font-bold
                ${i === 0 ? 'bg-white text-brand-800' : 'text-ink/60'}`}
                style={i === 0 ? { top: 8 } : { bottom: `calc(${pct}% + 4px)` }}>
                {Math.round(it.confidence * 100)}%
              </span>
            </div>
            <span title={nice(it.category)} className="line-clamp-2 min-h-[28px] text-center text-[10.5px] font-medium leading-tight text-mute">
              {nice(it.category)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* Half-circle gauge with hatched remainder. */
export function Gauge({ value, label, sub, legend }) {
  const r = 92, len = Math.PI * r
  const v = Math.max(0, Math.min(100, value ?? 0))
  const path = `M ${120 - r} 124 A ${r} ${r} 0 0 1 ${120 + r} 124`
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 240 150" className="w-full max-w-[300px]">
        <defs>
          <pattern id="hatchP" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="#eef2f7" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="#aeb9ca" strokeWidth="2" />
          </pattern>
          <linearGradient id="gaugeG" x1="0" x2="1">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke="url(#hatchP)" strokeWidth="30" strokeLinecap="round" />
        <path d={path} fill="none" stroke="url(#gaugeG)" strokeWidth="30" strokeLinecap="round"
              strokeDasharray={`${(len * v) / 100} ${len}`} style={{ transition: 'stroke-dasharray 0.9s ease' }} />
        <text x="120" y="108" textAnchor="middle" className="fill-ink" style={{ fontSize: 40, fontWeight: 700 }}>
          {value == null ? '--' : `${Math.round(v)}%`}
        </text>
        <text x="120" y="130" textAnchor="middle" className="fill-slate-500" style={{ fontSize: 11 }}>{label}</text>
      </svg>
      {sub}
      {legend && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-mute">
          {legend.map((l) => (
            <span key={l.text} className="inline-flex items-center gap-1.5">
              <i className={`inline-block h-2.5 w-2.5 rounded-full ${l.cls}`} />{l.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Bar({ value, max = 100, warn = false }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-all duration-700 ${warn ? 'bg-accent' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
