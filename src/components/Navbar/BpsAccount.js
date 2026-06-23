/**
 * BpsAccount — Navbar account item.
 *
 * Three states (from useAuth):
 *   resolving → fixed-size ghost placeholder (or optimistic handle/avatar hint)
 *   anon      → "Sign in" affordance; clicking opens an inline popover that
 *               collects a handle and calls signIn(handle)
 *   authed    → avatar + handle, linking to /account
 *
 * Desktop: renders as a fixed-width slot (120px) in the bpsNav bar — no
 *   layout shift between states. Uses the bpsNav token palette.
 * Mobile:  renders as a menu__link / menu__list-item row in the hamburger
 *   drawer; closes the drawer on tap.
 *
 * SSR: useAuth is wrapped by AuthProvider (client-side only guard is in
 * AuthContext), so this component always has a valid context. During SSR the
 * status is 'resolving' — the ghost placeholder renders, which is stable.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from '@docusaurus/Link'
import { useNavbarMobileSidebar } from '@docusaurus/theme-common/internal'
import { useAuth } from '@site/src/auth/AuthContext'
import styles from './BpsAccount.module.css'

// ── Avatar helpers ────────────────────────────────────────────────────────────

/** First character of a handle (without leading "@") for the fallback monogram. */
function monogram(handle) {
  if (!handle) return '?'
  const h = handle.startsWith('@') ? handle.slice(1) : handle
  return h.charAt(0).toUpperCase()
}

function Avatar({ src, handle, className, fallbackClassName }) {
  const [imgErr, setImgErr] = useState(false)
  const mono = monogram(handle)

  if (src && !imgErr) {
    return (
      <img
        src={src}
        alt={handle ? `@${handle}` : 'Account'}
        className={className}
        onError={() => setImgErr(true)}
      />
    )
  }
  return (
    <span className={fallbackClassName} aria-hidden="true">
      {mono}
    </span>
  )
}

// ── Sign-in popover (desktop) ─────────────────────────────────────────────────

function SignInPopover({ onClose, onSubmit }) {
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)
  const popoverRef = useRef(null)

  // Auto-focus the input when the popover opens
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose()
      }
    }
    // Delay so the open-click doesn't immediately close
    const id = setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    const h = handle.trim()
    if (!h) return
    setLoading(true)
    setError(null)
    try {
      await onSubmit(h)
      // signIn redirects; if it returns, treat as success (nothing to do)
    } catch (err) {
      setError(err?.message || 'Could not sign in. Check your handle and try again.')
      setLoading(false)
    }
  }

  return (
    <div className={styles.popover} ref={popoverRef} role="dialog" aria-label="Sign in">
      <span className={styles.popoverLabel}>Bluesky handle</span>
      <form className={styles.popoverRow} onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className={styles.handleInput}
          type="text"
          placeholder="you.bsky.social"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          aria-label="Bluesky handle"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={loading}
        />
        <button
          type="submit"
          className={styles.goBtn}
          disabled={loading || !handle.trim()}
        >
          {loading ? '…' : 'Go →'}
        </button>
      </form>
      {error && <div className={styles.popoverError}>{error}</div>}
    </div>
  )
}

// ── Desktop bar rendering ─────────────────────────────────────────────────────

function DesktopAccount() {
  const { status, profile, signIn } = useAuth()
  const [popoverOpen, setPopoverOpen] = useState(false)

  const handleSignIn = useCallback(
    async (handle) => {
      await signIn(handle)
    },
    [signIn],
  )

  const closePopover = useCallback(() => setPopoverOpen(false), [])

  // resolving — show optimistic hint if available, otherwise ghost skeleton
  if (status === 'resolving') {
    if (profile?.handle) {
      // Optimistic: returning user — show their last-known state so no flash
      return (
        <div className={styles.slot} aria-label="Loading account…">
          <span className={styles.pill} style={{ opacity: 0.55 }}>
            <Avatar
              src={profile.avatar}
              handle={profile.handle}
              className={styles.avatar}
              fallbackClassName={styles.avatarFallback}
            />
            <span className={styles.handleText}>
              {profile.handle.startsWith('@') ? profile.handle.slice(1) : profile.handle}
            </span>
          </span>
        </div>
      )
    }
    return (
      <div className={styles.slot} aria-label="Loading account…" aria-busy="true">
        <div className={styles.resolvingGhost}>
          <span className={styles.ghostAvatar} />
          <span className={styles.ghostText} />
        </div>
      </div>
    )
  }

  // anon — sign-in affordance
  if (status === 'anon') {
    return (
      <div className={`${styles.slot} ${styles.popoverAnchor}`}>
        <button
          type="button"
          className={styles.pill}
          onClick={() => setPopoverOpen((v) => !v)}
          aria-expanded={popoverOpen}
          aria-haspopup="dialog"
        >
          <SignInIcon className={styles.signInIcon} />
          <span className={styles.handleText}>Sign in</span>
        </button>
        {popoverOpen && (
          <SignInPopover onClose={closePopover} onSubmit={handleSignIn} />
        )}
      </div>
    )
  }

  // authed
  const displayHandle = profile?.handle
    ? (profile.handle.startsWith('@') ? profile.handle.slice(1) : profile.handle)
    : '…'

  return (
    <div className={styles.slot}>
      <Link
        to="/account"
        className={styles.pill}
        title={`Account: @${displayHandle}`}
      >
        <Avatar
          src={profile?.avatar}
          handle={profile?.handle}
          className={styles.avatar}
          fallbackClassName={styles.avatarFallback}
        />
        <span className={styles.handleText}>{displayHandle}</span>
      </Link>
    </div>
  )
}

// ── Mobile drawer rendering ───────────────────────────────────────────────────

function MobileAccount() {
  const { status, profile, signIn } = useAuth()
  const mobileSidebar = useNavbarMobileSidebar()
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const closeSidebar = () => mobileSidebar.toggle()

  async function handleMobileSubmit(e) {
    e.preventDefault()
    const h = handle.trim()
    if (!h) return
    setLoading(true)
    setError(null)
    try {
      await signIn(h)
    } catch (err) {
      setError(err?.message || 'Could not sign in.')
      setLoading(false)
    }
  }

  if (status === 'resolving') {
    if (profile?.handle) {
      const displayHandle = profile.handle.startsWith('@')
        ? profile.handle.slice(1)
        : profile.handle
      return (
        <li className="menu__list-item">
          <span className="menu__link" style={{ opacity: 0.55 }}>
            <span className={styles.mobileItem}>
              <Avatar
                src={profile.avatar}
                handle={profile.handle}
                className={styles.mobileAvatar}
                fallbackClassName={styles.mobileAvatarFallback}
              />
              <span>@{displayHandle}</span>
            </span>
          </span>
        </li>
      )
    }
    // Loading ghost in drawer
    return (
      <li className="menu__list-item">
        <span className="menu__link" aria-busy="true">
          <span className={styles.mobileItem} style={{ opacity: 0.45 }}>
            <span className={styles.mobileAvatarFallback}>?</span>
            <span>Loading…</span>
          </span>
        </span>
      </li>
    )
  }

  if (status === 'anon') {
    if (mobileExpanded) {
      return (
        <li className="menu__list-item">
          <div style={{ padding: '4px 16px 12px' }}>
            <form onSubmit={handleMobileSubmit} className={styles.mobileSignInRow}>
              <input
                className={styles.handleInput}
                type="text"
                placeholder="you.bsky.social"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                aria-label="Bluesky handle"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={loading}
              />
              <button
                type="submit"
                className={styles.goBtn}
                disabled={loading || !handle.trim()}
              >
                {loading ? 'Signing in…' : 'Sign in →'}
              </button>
              {error && <div className={styles.popoverError}>{error}</div>}
            </form>
          </div>
        </li>
      )
    }
    return (
      <li className="menu__list-item">
        <button
          type="button"
          className="menu__link"
          onClick={() => setMobileExpanded(true)}
        >
          <span className={styles.mobileItem}>
            <SignInIcon className={styles.signInIcon} />
            <span>Sign in</span>
          </span>
        </button>
      </li>
    )
  }

  // authed
  const displayHandle = profile?.handle
    ? (profile.handle.startsWith('@') ? profile.handle.slice(1) : profile.handle)
    : '…'

  return (
    <li className="menu__list-item">
      <Link
        className="menu__link"
        to="/account"
        onClick={closeSidebar}
      >
        <span className={styles.mobileItem}>
          <Avatar
            src={profile?.avatar}
            handle={profile?.handle}
            className={styles.mobileAvatar}
            fallbackClassName={styles.mobileAvatarFallback}
          />
          <span>@{displayHandle}</span>
        </span>
      </Link>
    </li>
  )
}

// ── Icon ──────────────────────────────────────────────────────────────────────

function SignInIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Arrow pointing into a box — login metaphor */}
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  )
}

// ── Exported component ────────────────────────────────────────────────────────

/**
 * `mobile` prop injected by Docusaurus when rendering the hamburger drawer;
 * false/undefined on the desktop bar.
 */
export default function BpsAccount({ mobile }) {
  if (mobile) return <MobileAccount />
  return <DesktopAccount />
}
