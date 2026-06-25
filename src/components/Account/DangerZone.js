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
import {
  TrashIcon,
  LockKeyholeIcon,
  CircleCheckIcon,
  DropIcon,
  WarningTriangleIcon,
  AlertCircleIcon,
} from './icons'
import styles from './DangerZone.module.css'

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeHandle(raw) {
  return (raw ?? '').trim().toLowerCase().replace(/^@/, '')
}

// ── Consequence list ─────────────────────────────────────────────────────────

function ConsequenceList() {
  return (
    <ul
      className={styles.consequenceList}
      aria-label="What account deletion removes"
    >
      <li className={styles.consequenceItem}>
        <span className={styles.consequenceIcon} aria-hidden="true">
          <TrashIcon />
        </span>
        Your account and profile data will be permanently removed
      </li>
      <li className={styles.consequenceItem}>
        <span className={styles.consequenceIcon} aria-hidden="true">
          <LockKeyholeIcon />
        </span>
        All API keys will be revoked and deleted immediately
      </li>
      <li className={styles.consequenceItem}>
        <span className={styles.consequenceIcon} aria-hidden="true">
          <CircleCheckIcon />
        </span>
        Your atproto OAuth session will be revoked
      </li>
      <li className={styles.consequenceItem}>
        <span className={styles.consequenceIcon} aria-hidden="true">
          <DropIcon />
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
  const confirmed =
    normalizedExpected.length > 0 && typedNormalized === normalizedExpected
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
      setDeleteError(
        err?.message || 'Could not delete account. Please try again.',
      )
    } finally {
      inFlightRef.current = false
    }
  }, [confirmed, isDeleting, client, resetToAnon, logout])

  return (
    <section className={styles.section} aria-labelledby="danger-zone-heading">
      {/* Section header — always visible */}
      <div className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <WarningTriangleIcon />
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
                Permanently removes your account, all API keys, and revokes
                access. This cannot be undone.
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
            <label
              className={styles.confirmLabel}
              htmlFor="delete-confirm-handle"
            >
              Type your handle{' '}
              {handle && <code className={styles.handleHint}>{handle}</code>} to
              confirm
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
                deleteStatus === 'error'
                  ? 'delete-error-msg'
                  : 'delete-handle-hint'
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
              <AlertCircleIcon className={styles.errorIcon} />
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
                  <TrashIcon
                    className={styles.deleteBtnIcon}
                    strokeWidth="1.8"
                    aria-hidden="true"
                  />
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
