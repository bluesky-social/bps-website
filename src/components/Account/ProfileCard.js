/**
 * ProfileCard — consolidated identity + email block.
 *
 * Combines avatar, display name, handle, and email management into one
 * compact block. Email lives below identity as a quiet secondary row, not a
 * separate section. No divider between identity and email — they read as one
 * unit of "who you are and how to reach you."
 *
 * Email behaviors preserved from EmailSection:
 *   - hasEmail → compact row: address + "Change email" link → inline form
 *   - no email  → prompt note + "Add email" inline form
 *   - validation mirrors backend: /^[^@]+@[^@]+$/
 *   - 400 InvalidEmail  → "That doesn't look like a valid email address."
 *   - other errors      → backend message or generic fallback
 *   - calls client.accountSetEmail + refresh() on save
 *
 * Consumes useAuth(): { handle, did, profile, hasEmail, email, client, refresh }
 */

import React, { useState, useCallback } from 'react'
import { useAuth } from '@site/src/auth/AuthContext'
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

// ── Email helpers ─────────────────────────────────────────────────────────────

/** Mirrors the backend's simple email check. */
function isValidEmail(email) {
  return /^[^@]+@[^@]+$/.test(email.trim())
}

// ── Email form ────────────────────────────────────────────────────────────────

function EmailForm({ onSuccess, onCancel, submitLabel = 'Save email', initialEmail = '' }) {
  const { client, refresh } = useAuth()
  const [email, setEmail] = useState(initialEmail)
  const [status, setStatus] = useState('idle') // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState(null)

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      const trimmed = email.trim()

      if (!isValidEmail(trimmed)) {
        setStatus('error')
        setErrorMsg("That doesn't look like a valid email address.")
        return
      }

      setStatus('submitting')
      setErrorMsg(null)

      try {
        await client.accountSetEmail(trimmed)
        await refresh()
        setStatus('success')
        setEmail('')
        onSuccess?.()
      } catch (err) {
        setStatus('error')
        if (err?.status === 400 && err?.error === 'InvalidEmail') {
          setErrorMsg("That doesn't look like a valid email address.")
        } else {
          setErrorMsg(
            err?.message || 'Could not save your email. Please try again.',
          )
        }
      }
    },
    [email, client, refresh, onSuccess],
  )

  const isSubmitting = status === 'submitting'

  return (
    <form
      className={styles.emailForm}
      onSubmit={handleSubmit}
      aria-label="Email address form"
    >
      <div className={styles.emailFormField}>
        <label className={styles.emailFieldLabel} htmlFor="acct-email">
          Email address
        </label>
        <div className={styles.emailInputRow}>
          <input
            id="acct-email"
            className={`${styles.emailInput}${status === 'error' ? ` ${styles.emailInputError}` : ''}`}
            type="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (status === 'error') setStatus('idle')
            }}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            disabled={isSubmitting}
            aria-describedby={status === 'error' ? 'email-error' : undefined}
            aria-invalid={status === 'error' ? 'true' : undefined}
          />
          <button
            type="submit"
            className={styles.emailSaveBtn}
            disabled={isSubmitting || !email.trim()}
          >
            {isSubmitting ? 'Saving…' : submitLabel}
          </button>
        </div>

        {status === 'error' && errorMsg && (
          <div id="email-error" className={styles.emailErrorMsg} role="alert">
            {errorMsg}
          </div>
        )}
      </div>

      {onCancel && (
        <button
          type="button"
          className={styles.emailCancelLink}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
      )}
    </form>
  )
}

// ── Email row — has email ──────────────────────────────────────────────────────

function HasEmailRow({ email }) {
  const [expanded, setExpanded] = useState(false)

  return expanded ? (
    <EmailForm
      submitLabel="Update email"
      initialEmail={email || ''}
      onSuccess={() => setExpanded(false)}
      onCancel={() => setExpanded(false)}
    />
  ) : (
    <div className={styles.emailRow}>
      {/* Envelope icon */}
      <svg
        className={styles.emailIcon}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="5" width="16" height="11" rx="2" />
        <polyline points="2 7 10 12 18 7" />
      </svg>
      <span className={styles.emailAddress}>{email || 'Email on file'}</span>
      <button
        type="button"
        className={styles.emailChangeLink}
        onClick={() => setExpanded(true)}
      >
        Change
      </button>
    </div>
  )
}

// ── Email row — no email ──────────────────────────────────────────────────────

function NoEmailRow() {
  const [expanded, setExpanded] = useState(false)

  return expanded ? (
    <EmailForm
      submitLabel="Add email"
      onSuccess={() => setExpanded(false)}
      onCancel={() => setExpanded(false)}
    />
  ) : (
    <div className={styles.emailRow}>
      {/* Envelope icon with subtle "missing" treatment */}
      <svg
        className={`${styles.emailIcon} ${styles.emailIconMissing}`}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="5" width="16" height="11" rx="2" />
        <polyline points="2 7 10 12 18 7" />
      </svg>
      <span className={styles.emailMissingText}>No email on file</span>
      <button
        type="button"
        className={styles.emailAddLink}
        onClick={() => setExpanded(true)}
      >
        Add email
      </button>
    </div>
  )
}

// ── ProfileCard ───────────────────────────────────────────────────────────────

export default function ProfileCard() {
  const { handle: whoamiHandle, did, profile, hasEmail, email } = useAuth()

  const rawHandle = (whoamiHandle ?? profile?.handle) ?? ''
  const handle = rawHandle.startsWith('@') ? rawHandle.slice(1) : rawHandle
  const displayName = profile?.displayName || handle || did || null
  const avatar = profile?.avatar || null

  return (
    <section className={styles.card} aria-labelledby="profile-card-name">
      {/* Identity row */}
      <div className={styles.identity}>
        <div className={styles.avatarWrap}>
          <Avatar src={avatar} handle={handle} />
        </div>
        <div className={styles.names}>
          <span id="profile-card-name" className={styles.displayName}>
            {displayName || 'Unknown'}
          </span>
          {handle && (
            <span className={styles.handle}>@{handle}</span>
          )}
        </div>
      </div>

      {/* Intra-card rule — quieter than the page divider */}
      <div className={styles.innerRule} role="separator" aria-hidden="true" />

      {/* Email row */}
      {hasEmail ? <HasEmailRow email={email} /> : <NoEmailRow />}
    </section>
  )
}
