const BASE = import.meta.env.VITE_API_URL || ''
const KEY = 'resumeiq_token'

export const tokenStore = {
  get() { try { return localStorage.getItem(KEY) } catch { return null } },
  set(t) { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY) } catch { /* private mode */ } },
}

async function req(path, { method = 'GET', body, form, json } = {}) {
  const headers = {}
  const t = tokenStore.get()
  if (t) headers.Authorization = `Bearer ${t}`
  let payload = form || body
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(json) }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload })
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try { const d = await res.json(); msg = typeof d.detail === 'string' ? d.detail : msg } catch { /* ignore */ }
    const e = new Error(msg); e.status = res.status; throw e
  }
  return res.json()
}

const resumeForm = ({ file, text }, extra = {}) => {
  const fd = new FormData()
  if (file) fd.append('resume', file); else fd.append('resume_text', text || '')
  Object.entries(extra).forEach(([k, v]) => fd.append(k, v ?? ''))
  return fd
}

// analyzer
export const analyze = ({ file, text, jd, label, jdTitle }) => req('/api/analyze', { method: 'POST', form: resumeForm({ file, text }, { jd, label, jd_title: jdTitle }) })
export const getMetrics = () => req('/api/metrics')
export const getHealth = () => req('/api/health')
export const assetUrl = (p) => `${BASE}${p}`

// auth + history
export const register = (email, password) => req('/api/auth/register', { method: 'POST', json: { email, password } })
export const login = (email, password) => req('/api/auth/login', { method: 'POST', json: { email, password } })
export const me = () => req('/api/auth/me')
export const getHistory = () => req('/api/history')
export const getHistoryItem = (id) => req(`/api/history/${id}`)
export const deleteHistoryItem = (id) => req(`/api/history/${id}`, { method: 'DELETE' })

// jobs
export const listJobs = () => req('/api/jobs')
export const addJob = (job) => req('/api/jobs', { method: 'POST', json: job })
export const deleteJob = (id) => req(`/api/jobs/${id}`, { method: 'DELETE' })
export const rankJobs = ({ file, text }, topK = 8) => req('/api/jobs/rank', { method: 'POST', form: resumeForm({ file, text }, { top_k: topK }) })
export const rankCandidates = (jd, files) => {
  const fd = new FormData(); fd.append('jd', jd); files.forEach((f) => fd.append('resumes', f))
  return req('/api/candidates/rank', { method: 'POST', form: fd })
}

// coach
export const coachStart = ({ file, text }, jd) => req('/api/coach/session', { method: 'POST', form: resumeForm({ file, text }, { jd }) })
export const coachChat = (session_id, message, history) => req('/api/coach/chat', { method: 'POST', json: { session_id, message, history } })
export const coachRewrite = (bullet, jd) => req('/api/coach/rewrite', { method: 'POST', json: { bullet, jd } })
export const coachLetter = ({ file, text, jd, name, company, role }) => req('/api/coach/cover-letter', { method: 'POST', form: resumeForm({ file, text }, { jd, name, company, role }) })
