import { useEffect, useState } from 'react'
import { LayoutDashboard, BarChart3, Workflow, Github, Sparkles, Briefcase, MessageCircle, History as HistoryIcon, LogOut } from 'lucide-react'
import Analyze from './pages/Analyze.jsx'
import Performance from './pages/Performance.jsx'
import HowItWorks from './pages/HowItWorks.jsx'
import JobMatches from './pages/JobMatches.jsx'
import Coach from './pages/Coach.jsx'
import History from './pages/History.jsx'
import AuthModal from './components/AuthModal.jsx'
import { useApp } from './state.jsx'
import { getHealth } from './api.js'

const NAV = [
  ['analyze', 'Analyzer', LayoutDashboard],
  ['jobs', 'Job matches', Briefcase],
  ['coach', 'Career coach', MessageCircle],
  ['history', 'History', HistoryIcon],
  ['performance', 'Model performance', BarChart3],
  ['how', 'How it works', Workflow],
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-white"><Sparkles size={18} /></span>
      <span className="text-xl font-semibold tracking-tight">ResumeIQ</span>
    </div>
  )
}

export default function App() {
  const { page, go: setPage, user, signOut, setAuthOpen } = useApp()
  const [health, setHealth] = useState(null)
  useEffect(() => { getHealth().then(setHealth).catch(() => setHealth(false)) }, [])

  return (
    <div className="mx-auto max-w-[1440px] p-3 sm:p-5">
      <div className="rounded-[2rem] bg-white/70 p-3 shadow-[0_20px_60px_rgba(30,58,138,0.10)] backdrop-blur sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[250px_1fr]">
          <aside className="card hidden flex-col justify-between p-5 lg:flex lg:min-h-[calc(100vh-8rem)]">
            <div>
              <Logo />
              <p className="mb-2 mt-9 text-[11px] font-semibold uppercase tracking-wider text-mute">Menu</p>
              <nav className="space-y-1">
                {NAV.map(([id, label, Icon]) => (
                  <button key={id} onClick={() => setPage(id)}
                    className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition
                      ${page === id ? 'bg-brand-50 text-ink' : 'text-mute hover:bg-slate-50 hover:text-ink'}`}>
                    {page === id && <span className="absolute -left-5 top-1/2 h-8 w-1.5 -translate-y-1/2 rounded-r-full bg-brand-700" />}
                    <Icon size={18} className={page === id ? 'text-brand-700' : ''} /> {label}
                  </button>
                ))}
              </nav>
              <p className="mb-2 mt-8 text-[11px] font-semibold uppercase tracking-wider text-mute">General</p>
              <a href="https://github.com/ZaidGhanchi05" target="_blank" rel="noreferrer"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-mute hover:bg-slate-50 hover:text-ink">
                <Github size={18} /> Source code
              </a>
            </div>
            <div className="dark-card rounded-2xl p-4 text-white">
              <p className="text-sm font-semibold">Tailor every application</p>
              <p className="mt-1 text-xs text-brand-200">A resume scored against the exact job description beats a generic one.</p>
              <button onClick={() => setPage('analyze')} className="mt-3 w-full rounded-full bg-brand-600 py-2 text-xs font-semibold hover:bg-brand-500">Analyze now</button>
            </div>
          </aside>

          <main className="min-w-0 space-y-3">
            <header className="card flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="flex items-center gap-3 lg:hidden"><Logo /></div>
              <nav className="flex max-w-full gap-1 overflow-x-auto lg:hidden">
                {NAV.map(([id, label]) => (
                  <button key={id} onClick={() => setPage(id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${page === id ? 'bg-brand-700 text-white' : 'text-mute'}`}>{label.split(' ')[0]}</button>
                ))}
              </nav>
              <div className="hidden items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs text-mute lg:flex">
                <span className={`h-2 w-2 rounded-full ${health ? 'bg-emerald-500' : health === false ? 'bg-orange-500' : 'bg-slate-300'}`} />
                {health ? `API online - ${health.classes} role categories` : health === false ? 'API offline' : 'Connecting...'}
              </div>
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden text-right leading-tight sm:block"><div className="max-w-[200px] truncate text-sm font-semibold">{user.email}</div><div className="text-[11px] text-mute">History is being saved</div></div>
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 text-sm font-bold uppercase text-brand-800">{user.email[0]}</span>
                  <button onClick={signOut} title="Sign out" className="rounded-full p-2 text-mute hover:bg-slate-100 hover:text-ink"><LogOut size={16} /></button>
                </div>
              ) : (
                <button onClick={() => setAuthOpen(true)} className="rounded-full bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-900">Sign in</button>
              )}
            </header>
            <div className="rounded-[1.75rem] bg-slate-50/80 p-4 sm:p-5">
              {page === 'analyze' && <Analyze />}
              {page === 'jobs' && <JobMatches />}
              {page === 'coach' && <Coach />}
              {page === 'history' && <History />}
              {page === 'performance' && <Performance />}
              {page === 'how' && <HowItWorks />}
            </div>
          </main>
        </div>
      </div>
      <AuthModal />
    </div>
  )
}
