/**
 * ProfileCard — consolidated identity block.
 *
 * Structure (post-restructure):
 *   identity row [avatar | names(displayName, @handle, email-line) | signOut]
 *
 * Email line shows: address + pencil-edit icon (has email) OR quiet "Add email"
 * affordance (no email). Clicking the icon/link opens an EmailModal overlay.
 *
 * EmailModal:
 *   - fixed overlay with dim backdrop; centered panel on design-system surface
 *   - role="dialog" aria-modal="true"; focus trapped within; Escape closes
 *   - clicking backdrop closes; focus returns to trigger on close
 *   - prefilled with current email; validates + calls client.accountSetEmail + refresh()
 *   - 400 InvalidEmail → inline error; generic fallback
 *
 * Consumes useAuth(): { handle, did, profile, hasEmail, email, client, refresh }
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
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

/** Mirrors the backend's email check exactly (server/src/router.ts setEmail handler). */
function isValidEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
}

// ── Email modal ───────────────────────────────────────────────────────────────

function EmailModal({ initialEmail, onClose }) {
  const { client, refresh } = useAuth()
  const [email, setEmail] = useState(initialEmail || '')
  const [status, setStatus] = useState('idle') // idle | submitting | error
  const [errorMsg, setErrorMsg] = useState(null)

  const inputRef = useRef(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  // Focus the input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Escape key closes the modal
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose()
      }
      // Focus trap: Tab and Shift+Tab cycle within the modal panel
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll(
          'input, button, [tabindex]:not([tabindex="-1"])'
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose],
  )

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
        onClose()
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
    [email, client, refresh, onClose],
  )

  const isSubmitting = status === 'submitting'
  const hasEmail = !!initialEmail

  return (
    <div
      className={styles.modalOverlay}
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        className={styles.modalPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-modal-heading"
      >
        <h2 id="email-modal-heading" className={styles.modalHeading}>
          {hasEmail ? 'Change email' : 'Add email'}
        </h2>

        <form
          className={styles.modalForm}
          onSubmit={handleSubmit}
          aria-label="Email address form"
        >
          <div className={styles.modalField}>
            <label className={styles.modalFieldLabel} htmlFor="modal-email">
              Email address
            </label>
            <input
              ref={inputRef}
              id="modal-email"
              className={`${styles.modalInput}${status === 'error' ? ` ${styles.modalInputError}` : ''}`}
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
              aria-describedby={status === 'error' ? 'modal-email-error' : undefined}
              aria-invalid={status === 'error' ? 'true' : undefined}
            />
            {status === 'error' && errorMsg && (
              <div id="modal-email-error" className={styles.modalErrorMsg} role="alert">
                {errorMsg}
              </div>
            )}
          </div>

          <div className={styles.modalActions}>
            <button
              type="submit"
              className={styles.modalSaveBtn}
              disabled={isSubmitting || !email.trim()}
            >
              {isSubmitting ? 'Saving…' : hasEmail ? 'Update email' : 'Add email'}
            </button>
            <button
              type="button"
              className={styles.modalCancelBtn}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Email line (inline inside .names column) ──────────────────────────────────

function EmailLine({ hasEmail, email, onEdit }) {
  if (hasEmail) {
    return (
      <span className={styles.emailLine}>
        <span className={styles.emailAddress}>{email || 'Email on file'}</span>
        <button
          type="button"
          className={styles.emailEditBtn}
          onClick={onEdit}
          aria-label="Edit email"
          title="Edit email"
        >
          {/* Pencil icon */}
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5z" />
          </svg>
        </button>
      </span>
    )
  }

  return (
    <span className={styles.emailLine}>
      <button
        type="button"
        className={styles.emailAddLink}
        onClick={onEdit}
        aria-label="Add email"
      >
        Add email
      </button>
    </span>
  )
}

// ── ProfileCard ───────────────────────────────────────────────────────────────

export default function ProfileCard() {
  const { handle: whoamiHandle, did, profile, hasEmail, email, logout } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const editTriggerRef = useRef(null)

  const rawHandle = (whoamiHandle ?? profile?.handle) ?? ''
  const handle = rawHandle.startsWith('@') ? rawHandle.slice(1) : rawHandle
  const displayName = profile?.displayName || handle || did || null
  const avatar = profile?.avatar || null

  const handleSignOut = useCallback(async () => {
    if (signingOut) return
    setSigningOut(true)
    await logout()
  }, [signingOut, logout])

  const openModal = useCallback(() => {
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    // Return focus to the trigger that opened the modal
    editTriggerRef.current?.focus()
  }, [])

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
          {handle && (
            <span className={styles.handle}>@{handle}</span>
          )}
          {/* Email as 3rd line — ref the trigger so modal can return focus */}
          <span ref={editTriggerRef} style={{ display: 'contents' }}>
            <EmailLine
              hasEmail={!!hasEmail}
              email={email}
              onEdit={openModal}
            />
          </span>
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

      {/* Email edit modal — rendered in-tree as a fixed overlay; safe inside BrowserOnly */}
      {modalOpen && (
        <EmailModal
          initialEmail={email || ''}
          onClose={closeModal}
        />
      )}
    </section>
  )
}
