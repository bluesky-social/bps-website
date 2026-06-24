/**
 * BpsAccount — Navbar account item.
 *
 * Three states (from useAuth):
 *   resolving → fixed-size ghost placeholder (or optimistic avatar hint)
 *   anon      → icon-only login button (desktop) / "My Account" link (mobile)
 *   authed    → avatar only (desktop) / avatar + "My Account" link (mobile)
 *
 * Desktop: renders as a fixed-width slot (40px) in the bpsNav bar — no
 *   layout shift between states. Uses the bpsNav token palette.
 * Mobile:  renders as a menu__link / menu__list-item row in the hamburger
 *   drawer; always "My Account" → /account in all states. Sign-in happens
 *   on the /account page itself.
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
      <span className={styles.popoverLabel}>Handle</span>
      <form className={styles.popoverRow} onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className={styles.handleInput}
          type="text"
          placeholder="you.bsky.social"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          aria-label="Handle"
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
  const { status, handle, profile, signIn } = useAuth()
  const [popoverOpen, setPopoverOpen] = useState(false)

  const handleSignIn = useCallback(
    async (handle) => {
      await signIn(handle)
    },
    [signIn],
  )

  const closePopover = useCallback(() => setPopoverOpen(false), [])

  // resolving — show optimistic avatar if available, otherwise ghost circle
  if (status === 'resolving') {
    const resolvingHandle = handle ?? profile?.handle
    if (resolvingHandle) {
      // Optimistic: returning user — show avatar so no flash
      return (
        <div className={styles.slot} aria-label="Loading account…" aria-busy="true" style={{ opacity: 0.55 }}>
          <Avatar
            src={profile?.avatar}
            handle={resolvingHandle}
            className={styles.avatar}
            fallbackClassName={styles.avatarFallback}
          />
        </div>
      )
    }
    return (
      <div className={styles.slot} aria-label="Loading account…" aria-busy="true">
        <div className={styles.resolvingGhost}>
          <span className={styles.ghostAvatar} />
        </div>
      </div>
    )
  }

  // anon — icon-only sign-in button; clicking opens SignInPopover
  if (status === 'anon') {
    return (
      <div className={`${styles.slot} ${styles.popoverAnchor}`}>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => setPopoverOpen((v) => !v)}
          aria-expanded={popoverOpen}
          aria-haspopup="dialog"
          aria-label="Sign in"
          title="Sign in"
        >
          <SignInIcon className={styles.signInIcon} />
        </button>
        {popoverOpen && (
          <SignInPopover onClose={closePopover} onSubmit={handleSignIn} />
        )}
      </div>
    )
  }

  // authed — avatar only, links to /account
  const rawHandle = handle ?? profile?.handle
  const displayHandle = rawHandle
    ? (rawHandle.startsWith('@') ? rawHandle.slice(1) : rawHandle)
    : '…'

  return (
    <div className={styles.slot}>
      <Link
        to="/account"
        className={styles.avatarLink}
        title={`Account: @${displayHandle}`}
        aria-label={`Account: @${displayHandle}`}
      >
        <Avatar
          src={profile?.avatar}
          handle={rawHandle}
          className={styles.avatar}
          fallbackClassName={styles.avatarFallback}
        />
      </Link>
    </div>
  )
}

// ── Mobile drawer rendering ───────────────────────────────────────────────────

function MobileAccount() {
  const { status, handle, profile } = useAuth()
  const mobileSidebar = useNavbarMobileSidebar()

  const closeSidebar = () => mobileSidebar.toggle()

  // All states render the same "My Account" link → /account.
  // Sign-in happens on the /account page itself; no inline form in the drawer.

  if (status === 'resolving') {
    const resolvingHandle = handle ?? profile?.handle
    return (
      <li className="menu__list-item">
        <Link
          className="menu__link"
          to="/account"
          onClick={closeSidebar}
          style={resolvingHandle ? { opacity: 0.65 } : undefined}
        >
          <span className={styles.mobileItem}>
            {resolvingHandle ? (
              <Avatar
                src={profile?.avatar}
                handle={resolvingHandle}
                className={styles.mobileAvatar}
                fallbackClassName={styles.mobileAvatarFallback}
              />
            ) : (
              <span className={styles.mobileAvatarFallback} aria-hidden="true">
                <PersonIcon />
              </span>
            )}
            <span>My Account</span>
          </span>
        </Link>
      </li>
    )
  }

  if (status === 'anon') {
    return (
      <li className="menu__list-item">
        <Link
          className="menu__link"
          to="/account"
          onClick={closeSidebar}
        >
          <span className={styles.mobileItem}>
            <span className={styles.mobileAvatarFallback} aria-hidden="true">
              <PersonIcon />
            </span>
            <span>My Account</span>
          </span>
        </Link>
      </li>
    )
  }

  // authed
  const rawHandle = handle ?? profile?.handle

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
            handle={rawHandle}
            className={styles.mobileAvatar}
            fallbackClassName={styles.mobileAvatarFallback}
          />
          <span>My Account</span>
        </span>
      </Link>
    </li>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

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

/** Generic person silhouette — used for the anon/resolving mobile row avatar slot. */
function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ width: '12px', height: '12px' }}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
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
