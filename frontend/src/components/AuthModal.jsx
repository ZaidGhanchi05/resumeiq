import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { login, register } from '../api.js'
import { useApp } from '../state.jsx'
import { Pill } from './ui.jsx'

export default function AuthModal() {
  const { authOpen, setAuthOpen, signIn } = useApp()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (!authOpen) return null

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const r = await (mode === 'login' ? login : register)(email, password)
      signIn(r.token, r.user); setPassword('')
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const field = 'w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm outline-none focus:border-brand-500 focus:bg-white'
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-950/40 p-4 backdrop-blur-sm" onClick={() => setAuthOpen(false)}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="fade-up w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p className="mt-1 text-xs text-mute">Saves your analyses so you can track your score over time. Your resume text is never stored.</p>
          </div>
          <button type="button" onClick={() => setAuthOpen(false)} className="rounded-full p-1.5 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="mb-4 flex rounded-full bg-slate-100 p-0.5 text-xs font-semibold">
          {[['login', 'Sign in'], ['register', 'Create account']].map(([m, l]) => (
            <button key={m} type="button" onClick={() => { setMode(m); setErr('') }}
              className={`flex-1 rounded-full py-2 ${mode === m ? 'bg-white text-brand-800 shadow-sm' : 'text-mute'}`}>{l}</button>
          ))}
        </div>
        <div className="space-y-3">
          <input className={field} type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={field} type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <p className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700">{err}</p>}
        <Pill className="mt-4 w-full" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />}{mode === 'login' ? 'Sign in' : 'Create account'}</Pill>
      </form>
    </div>
  )
}
