/**
 * DangerZone — account deletion.
 *
 * Visually distinct destructive section, separated from the rest of the
 * account page. Clearly communicates what deletion does, requires the user
 * to type their handle as an explicit confirmation gate, then calls
 * client.accountDelete() and resets local auth state before redirecting to '/'.
 *
 * Deletion flow:
 *   1. User reads the consequences and expands the confirmation panel.
 *   2. User types their handle (case-insensitive, trimmed) to unlock the button.
 *   3. On submit → client.accountDelete() (backend hard-deletes + clears cookie).
 *   4. On success → local state reset to anon (writeHint(null) + setState anon)
 *      + window.location.assign('/').
 *      logout() is NOT called over the network because the session is already
 *      destroyed — we perform the same local reset it does without a round-trip.
 *   5. On error → normalized message shown inline; no redirect.
 *
 * In-flight: button disabled + "Deleting…" label; input disabled.
 *
 * Consumes useAuth(): { profile, client } and a local reset helper exposed
 * by AuthContext as `resetToAnon()` (a new minimal export that does the
 * same setState+writeHint reset as the finally-block in logout() without the
 * network call). If resetToAnon is undefined (e.g. old context), falls back to
 * calling logout().catch(()=>{}).
 */

import React, { useState, useCallback, useRef } from 'react'
import { useAuth } from '@site/src/auth/AuthContext'
import styles from './DangerZone.module.css'

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeHandle(raw) {
  return (raw ?? '').trim().toLowerCase().replace(/^@/, '')
}

// ── Consequence list ─────────────────────────────────────────────────────────

function ConsequenceList() {
  return (
    <ul className={styles.consequenceList} aria-label="What account deletion removes">
      <li className={styles.consequenceItem}>
        <span className={styles.consequenceIcon} aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 4h12M5 4V2.5A1.5 1.5 0 0 1 6.5 1h3A1.5 1.5 0 0 1 11 2.5V4M6 7v5M10 7v5M3 4l.75 9A1.5 1.5 0 0 0 5.25 14.5h5.5A1.5 1.5 0 0 0 12.25 13L13 4" />
          </svg>
        </span>
        Your account and profile data will be permanently removed
      </li>
      <li className={styles.consequenceItem}>
        <span className={styles.consequenceIcon} aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="12" height="9" rx="1.5" />
            <path d="M4 6V4.5a4 4 0 0 1 8 0V6" />
            <circle cx="8" cy="10.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </span>
        All API keys will be revoked and deleted immediately
      </li>
      <li className={styles.consequenceItem}>
        <span className={styles.consequenceIcon} aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="6" />
            <path d="M5.5 8l2 2 3.5-3.5" />
          </svg>
        </span>
        Your atproto OAuth session will be revoked
      </li>
      <li className={styles.consequenceItem}>
        <span className={styles.consequenceIcon} aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1v8M3 6.5C1.5 7.5 1 9 1 10a5 5 0 0 0 10 0c0-1-.5-2.5-2-3.5" />
          </svg>
        </span>
        This action is permanent and cannot be undone
      </li>
    </ul>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function DangerZone() {
  const { profile, client, resetToAnon, logout } = useAuth()
  const handle = profile?.handle ?? ''
  const normalizedExpected = normalizeHandle(handle)

  // Whether the destructive panel is expanded
  const [expanded, setExpanded] = useState(false)
  // What the user has typed in the confirmation input
  const [typed, setTyped] = useState('')
  // delete flow: idle | deleting | error
  const [deleteStatus, setDeleteStatus] = useState('idle')
  const [deleteError, setDeleteError] = useState(null)

  const inputRef = useRef(null)
  // Synchronous in-flight lock — prevents double-submit in the render-timing
  // window before the isDeleting state update propagates.
  const inFlightRef = useRef(false)

  const typedNormalized = normalizeHandle(typed)
  const confirmed = normalizedExpected.length > 0 && typedNormalized === normalizedExpected
  const isDeleting = deleteStatus === 'deleting'

  function handleExpand() {
    setExpanded(true)
    // Focus the input on next tick after it's rendered
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleCancel() {
    if (isDeleting) return
    setExpanded(false)
    setTyped('')
    setDeleteStatus('idle')
    setDeleteError(null)
  }

  const handleDelete = useCallback(async () => {
    if (!confirmed || isDeleting) return
    // Synchronous guard — catches double-submit before React re-renders with
    // the new isDeleting state.
    if (inFlightRef.current) return
    inFlightRef.current = true
    setDeleteStatus('deleting')
    setDeleteError(null)
    try {
      await client.accountDelete()
      // Backend has cleared the cookie. Reset local auth state without a
      // network round-trip (session is already gone on the server).
      if (typeof resetToAnon === 'function') {
        resetToAnon()
      } else {
        // Fallback: logout() resets local state; ignore network errors since
        // the backend session is already destroyed.
        logout().catch(() => {})
      }
      window.location.assign('/')
    } catch (err) {
      setDeleteStatus('error')
      setDeleteError(err?.message || 'Could not delete account. Please try again.')
    } finally {
      inFlightRef.current = false
    }
  }, [confirmed, isDeleting, client, resetToAnon, logout])

  return (
    <section className={styles.section} aria-labelledby="danger-zone-heading">
      {/* Section header — always visible */}
      <div className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2L2 17h16L10 2z" />
            <line x1="10" y1="9" x2="10" y2="12.5" />
            <circle cx="10" cy="15" r="0.75" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <h2 id="danger-zone-heading" className={styles.heading}>
          Danger Zone
        </h2>
      </div>

      {/* Collapsed state — summary + expand button */}
      {!expanded && (
        <div className={styles.collapsedBody}>
          <div className={styles.deleteRow}>
            <div className={styles.deleteRowText}>
              <span className={styles.deleteRowTitle}>Delete this account</span>
              <span className={styles.deleteRowDesc}>
                Permanently removes your account, all API keys, and revokes access.
                This cannot be undone.
              </span>
            </div>
            <button
              type="button"
              className={styles.expandBtn}
              onClick={handleExpand}
              aria-expanded="false"
              aria-controls="danger-zone-panel"
            >
              Delete account
            </button>
          </div>
        </div>
      )}

      {/* Expanded confirmation panel */}
      {expanded && (
        <div
          id="danger-zone-panel"
          className={styles.confirmPanel}
          role="region"
          aria-label="Account deletion confirmation"
        >
          {/* What will be deleted */}
          <div className={styles.consequenceBlock}>
            <p className={styles.consequenceIntro}>
              Deleting your account will immediately and permanently:
            </p>
            <ConsequenceList />
          </div>

          {/* Handle confirmation gate */}
          <div className={styles.confirmGate}>
            <label className={styles.confirmLabel} htmlFor="delete-confirm-handle">
              Type your handle{' '}
              {handle && (
                <code className={styles.handleHint}>{handle}</code>
              )}{' '}
              to confirm
            </label>
            <input
              ref={inputRef}
              id="delete-confirm-handle"
              type="text"
              className={`${styles.confirmInput}${confirmed ? ` ${styles.confirmInputValid}` : ''}`}
              placeholder={handle || 'your.handle'}
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value)
                if (deleteStatus === 'error') {
                  setDeleteStatus('idle')
                  setDeleteError(null)
                }
              }}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={isDeleting}
              aria-describedby={
                deleteStatus === 'error' ? 'delete-error-msg' : 'delete-handle-hint'
              }
              aria-invalid={deleteStatus === 'error' ? 'true' : undefined}
            />
            <p id="delete-handle-hint" className={styles.confirmHint}>
              Handle matching is case-insensitive. The{' '}
              <code className={styles.handleHint}>@</code> prefix is optional.
            </p>
          </div>

          {/* Error display */}
          {deleteStatus === 'error' && deleteError && (
            <div id="delete-error-msg" className={styles.errorMsg} role="alert">
              <svg className={styles.errorIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="8" cy="8" r="6.5" />
                <line x1="8" y1="5" x2="8" y2="8.5" />
                <circle cx="8" cy="11" r="0.7" fill="currentColor" stroke="none" />
              </svg>
              {deleteError}
            </div>
          )}

          {/* Action buttons */}
          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleCancel}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={handleDelete}
              disabled={!confirmed || isDeleting}
              aria-disabled={!confirmed || isDeleting}
            >
              {isDeleting ? (
                <>
                  <span className={styles.deletingSpinner} aria-hidden="true" />
                  Deleting…
                </>
              ) : (
                <>
                  <svg className={styles.deleteBtnIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 4h12M5 4V2.5A1.5 1.5 0 0 1 6.5 1h3A1.5 1.5 0 0 1 11 2.5V4M6 7v5M10 7v5M3 4l.75 9A1.5 1.5 0 0 0 5.25 14.5h5.5A1.5 1.5 0 0 0 12.25 13L13 4" />
                  </svg>
                  Yes, permanently delete
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
