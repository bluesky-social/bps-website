import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import useIsBrowser from '@docusaurus/useIsBrowser'
import { buildClient } from '@site/src/api/client'

const AuthContext = createContext(null)
const HINT_KEY = 'bps_auth_hint'

// Browser-only: guarded so they're safe even if ever called outside an effect
// (during SSR there is no localStorage). Callers today only invoke these from
// effects/callbacks, but the guard makes the SSR-safety explicit.
function readHint() {
  if (typeof localStorage === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(HINT_KEY) || 'null') } catch { return null }
}
function writeHint(hint) {
  if (typeof localStorage === 'undefined') return
  try { hint ? localStorage.setItem(HINT_KEY, JSON.stringify(hint)) : localStorage.removeItem(HINT_KEY) } catch {}
}

export function AuthProvider({ children }) {
  const isBrowser = useIsBrowser()
  const { siteConfig } = useDocusaurusContext()
  const apiOrigin = siteConfig.customFields?.apiOrigin
  const client = React.useMemo(() => buildClient(apiOrigin), [apiOrigin])

  // Optimistic: start from the last-known hint so returning users don't flash.
  const [state, setState] = useState({ status: 'resolving', did: null, profile: null, hasEmail: false })

  const refresh = useCallback(async () => {
    try {
      const who = await client.whoami()
      let profile = null
      try { profile = await client.profile() } catch { /* profile optional */ }
      const next = { status: 'authed', did: who.did, hasEmail: who.hasEmail, profile }
      setState(next)
      writeHint({ did: who.did, handle: profile?.handle, avatar: profile?.avatar })
    } catch (err) {
      setState({ status: 'anon', did: null, profile: null, hasEmail: false })
      writeHint(null)
    }
  }, [client])

  useEffect(() => {
    if (!isBrowser) return
    // Seed optimistic state from the hint (still 'resolving' authority-wise).
    const hint = readHint()
    if (hint?.did) {
      setState((s) => s.status === 'resolving'
        ? { status: 'resolving', did: hint.did, profile: { handle: hint.handle, avatar: hint.avatar }, hasEmail: false }
        : s)
    }
    refresh()
  }, [isBrowser, refresh])

  const signIn = useCallback(async (handle) => {
    const { authorizeUrl } = await client.oauthStart(handle)
    window.location.assign(authorizeUrl)
  }, [client])

  const logout = useCallback(async () => {
    try { await client.logout() } finally {
      setState({ status: 'anon', did: null, profile: null, hasEmail: false })
      writeHint(null)
    }
  }, [client])

  // Local-only reset — same state transition as logout's finally-block but
  // without a network call. Used by DangerZone after accountDelete() succeeds:
  // the backend has already destroyed the session, so a server logout would
  // 401; we just need the client-side state + hint cleared.
  const resetToAnon = useCallback(() => {
    setState({ status: 'anon', did: null, profile: null, hasEmail: false })
    writeHint(null)
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, client, signIn, logout, resetToAnon, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
