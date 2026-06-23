/**
 * AccountApp — client-only root of the /account page.
 *
 * Consumes useAuth() and switches on status:
 *   resolving → skeleton screen
 *   anon      → sign-in prompt (reuses the same handle-entry pattern as BpsAccount)
 *   authed    → ProfileHeader + EmailSection (+ TODO: ApiKeysSection, DangerZone)
 *
 * This component is ONLY ever rendered inside a <BrowserOnly> subtree (via
 * account.js), so it's safe to call useAuth() here without SSR guards.
 */

import React, { useState } from 'react'
import { useAuth } from '@site/src/auth/AuthContext'
import ProfileHeader from './ProfileHeader'
import EmailSection from './EmailSection'
import styles from './AccountApp.module.css'

// ── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonSection({ lines = 3 }) {
  return (
    <div className={styles.skeletonSection}>
      <div className={styles.skeletonHeading} />
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={styles.skeletonLine}
          style={{ width: `${70 - i * 12}%`, animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  )
}

function SkeletonScreen() {
  return (
    <div className={styles.wrap}>
      <div className={styles.container}>
        {/* Profile header skeleton */}
        <div className={styles.skeletonHeader}>
          <div className={styles.skeletonAvatar} />
          <div className={styles.skeletonHeaderLines}>
            <div className={styles.skeletonLine} style={{ width: '45%' }} />
            <div
              className={styles.skeletonLine}
              style={{ width: '30%', animationDelay: '0.1s' }}
            />
          </div>
        </div>

        <div className={styles.divider} />

        <SkeletonSection lines={2} />
        <SkeletonSection lines={3} />
      </div>
    </div>
  )
}

// ── Sign-in prompt ───────────────────────────────────────────────────────────

function SignInPrompt() {
  const { signIn } = useAuth()
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const h = handle.trim()
    if (!h) return
    setLoading(true)
    setError(null)
    try {
      await signIn(h)
      // signIn redirects; if it somehow returns, nothing to do
    } catch (err) {
      setError(err?.message || 'Could not start sign-in. Check your handle and try again.')
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.anonContainer}>
        <div className={styles.anonIcon} aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </div>

        <h1 className={styles.anonTitle}>Sign in to manage your account</h1>
        <p className={styles.anonLede}>
          Enter your Bluesky handle to continue with your Bluesky Protocol
          Services account.
        </p>

        <form className={styles.anonForm} onSubmit={handleSubmit}>
          <label className={styles.inputLabel} htmlFor="acct-handle">
            Bluesky handle
          </label>
          <div className={styles.inputRow}>
            <input
              id="acct-handle"
              className={styles.handleInput}
              type="text"
              placeholder="you.bsky.social"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              disabled={loading}
            />
            <button
              type="submit"
              className={styles.signInBtn}
              disabled={loading || !handle.trim()}
            >
              {loading ? 'Redirecting…' : 'Sign in →'}
            </button>
          </div>
          {error && (
            <div className={styles.anonError} role="alert">
              {error}
            </div>
          )}
        </form>

        <p className={styles.anonNote}>
          You'll be redirected to Bluesky to authorize access.
        </p>
      </div>
    </div>
  )
}

// ── Authed view ──────────────────────────────────────────────────────────────

function AuthedView() {
  return (
    <div className={styles.wrap}>
      <div className={styles.container}>
        <ProfileHeader />

        <div className={styles.divider} />

        <EmailSection />

        {/* TODO: Task 6 — ApiKeysSection */}
        {/* TODO: Task 7 — DangerZone */}
      </div>
    </div>
  )
}

// ── Root switch ──────────────────────────────────────────────────────────────

export default function AccountApp() {
  const { status } = useAuth()

  if (status === 'resolving') return <SkeletonScreen />
  if (status === 'anon') return <SignInPrompt />
  return <AuthedView />
}
