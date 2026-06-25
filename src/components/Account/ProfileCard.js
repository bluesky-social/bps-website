/**
 * ProfileCard — consolidated identity block.
 *
 * Structure (post-restructure):
 *   identity row [avatar | names(displayName, @handle, email-line) | signOut]
 *
 * Email is display-only: it is sourced from the user's Atmosphere account
 * (mirrored from their PDS) and shown read-only here — there is no modal and
 * no in-app editing. When the account has an email, the line shows an envelope
 * icon + address; when it has none, the line is omitted entirely.
 *
 * Consumes useAuth(): { handle, did, profile, email }
 */

import React, { useState, useCallback } from 'react'
import { useAuth } from '@site/src/auth/AuthContext'
import { EnvelopeIcon } from './icons'
import styles from './ProfileCard.module.css'

// ── Avatar ────────────────────────────────────────────────────────────────────

function monogram(handle) {
  if (!handle) return '?'
  const h = handle.startsWith('@') ? handle.slice(1) : handle
  return h.charAt(0).toUpperCase()
}

function Avatar({ src, handle }) {
  const [imgErr, setImgErr] = useState(false)
  const mono = monogram(handle)

  if (src && !imgErr) {
    return (
      <img
        src={src}
        alt={handle ? `@${handle}` : 'Account avatar'}
        className={styles.avatarImg}
        onError={() => setImgErr(true)}
      />
    )
  }

  return (
    <span
      className={styles.avatarFallback}
      role="img"
      aria-label={handle ? `@${handle}` : 'Account avatar'}
    >
      {mono}
    </span>
  )
}

// ── Email line (inline inside .names column) ──────────────────────────────────

/**
 * Display-only email row. Renders an envelope icon + address when the account
 * has an email on file; renders nothing otherwise (email is read-only and
 * sourced from the user's Atmosphere account, so an empty value isn't
 * actionable and shouldn't draw attention).
 */
function EmailLine({ email }) {
  if (!email) return null

  return (
    <span className={styles.emailLine}>
      {/* Envelope icon preceding the address */}
      <EnvelopeIcon className={styles.emailIcon} />
      <span className={styles.emailAddress}>{email}</span>
    </span>
  )
}

// ── ProfileCard ───────────────────────────────────────────────────────────────

export default function ProfileCard() {
  const { handle: whoamiHandle, did, profile, email, logout } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const rawHandle = whoamiHandle ?? profile?.handle ?? ''
  const handle = rawHandle.startsWith('@') ? rawHandle.slice(1) : rawHandle
  const displayName = profile?.displayName || handle || did || null
  const avatar = profile?.avatar || null

  const handleSignOut = useCallback(async () => {
    if (signingOut) return
    setSigningOut(true)
    await logout()
  }, [signingOut, logout])

  return (
    <section className={styles.card} aria-labelledby="profile-card-name">
      {/* Identity row: avatar | names(displayName + handle + email) | signOut */}
      <div className={styles.identity}>
        <div className={styles.avatarWrap}>
          <Avatar src={avatar} handle={handle} />
        </div>
        <div className={styles.names}>
          <h1 id="profile-card-name" className={styles.displayName}>
            {displayName || 'Unknown'}
          </h1>
          {handle && <span className={styles.handle}>@{handle}</span>}
          {/* Email as 3rd line — display-only, omitted when no email on file */}
          <EmailLine email={email} />
        </div>
        <button
          type="button"
          className={styles.signOutBtn}
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </section>
  )
}
