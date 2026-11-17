import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { me, tokenStore } from './api.js'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const [page, setPage] = useState('analyze')
  const [user, setUser] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [resumeText, setResumeText] = useState('')   // shared between Analyzer, Jobs and Coach
  const [jd, setJd] = useState('')
  const [jdTitle, setJdTitle] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (tokenStore.get()) me().then(setUser).catch(() => tokenStore.set(null))
  }, [])

  const signIn = useCallback((token, u) => { tokenStore.set(token); setUser(u); setAuthOpen(false) }, [])
  const signOut = useCallback(() => { tokenStore.set(null); setUser(null) }, [])
  const go = useCallback((p) => { setPage(p); window.scrollTo({ top: 0 }) }, [])

  return (
    <Ctx.Provider value={{ page, go, user, signIn, signOut, authOpen, setAuthOpen, resumeText, setResumeText, jd, setJd, jdTitle, setJdTitle, result, setResult }}>
      {children}
    </Ctx.Provider>
  )
}
