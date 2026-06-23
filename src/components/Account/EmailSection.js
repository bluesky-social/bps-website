/**
 * EmailSection — email address management.
 *
 * Shows the current email state (hasEmail true/false) and a form for setting
 * or updating the email address. Behavior:
 *
 * - No email (first-time): a gentle prompt banner + the form to add one.
 * - Email set:             a quiet "Email on file" indicator + a collapsed form
 *                          to update it (expand on "Change email").
 *
 * Validation:
 * - Client-side: mirrors the backend's simple check: must contain exactly one
 *   "@" with at least one character on each side — i.e. /^[^@]+@[^@]+$/.
 *   This is intentionally permissive (same as the backend) rather than RFC-5322
 *   pedantic, so legitimate addresses don't get blocked client-side.
 *
 * On submit:
 *   1. client.accountSetEmail(email)  — returns {ok} or throws {status,error,message}
 *   2. refresh()                      — refetches whoami+profile → hasEmail updates
 *
 * Error display:
 *   - 400 InvalidEmail  → inline: "That doesn't look like a valid email address."
 *   - other errors      → inline: the backend message or a generic fallback.
 *
 * Consumes useAuth(): { hasEmail, client, refresh }.
 */

import React, { useState, useCallback } from 'react'
import { useAuth } from '@site/src/auth/AuthContext'
import styles from './EmailSection.module.css'

// ── Shared helpers ───────────────────────────────────────────────────────────

/** Mirrors the backend's simple email check. */
function isValidEmail(email) {
  return /^[^@]+@[^@]+$/.test(email.trim())
}

function SectionHeading({ children }) {
  return <h2 className={styles.sectionHeading}>{children}</h2>
}

// ── Email form ───────────────────────────────────────────────────────────────

/**
 * Controlled email form. Used both for first-add and for update.
 *
 * Props:
 *   onSuccess   — called with no args after a successful save + refresh
 *   onCancel    — optional; shows a cancel link when provided
 *   submitLabel — text for the submit button (default: "Save email")
 */
function EmailForm({ onSuccess, onCancel, submitLabel = 'Save email' }) {
  const { client, refresh } = useAuth()
  const [email, setEmail] = useState('')
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
      className={styles.form}
      onSubmit={handleSubmit}
      aria-label="Email address form"
    >
      <div className={styles.formField}>
        <label className={styles.fieldLabel} htmlFor="acct-email">
          Email address
        </label>
        <div className={styles.inputRow}>
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
            className={styles.saveBtn}
            disabled={isSubmitting || !email.trim()}
          >
            {isSubmitting ? 'Saving…' : submitLabel}
          </button>
        </div>

        {status === 'error' && errorMsg && (
          <div id="email-error" className={styles.errorMsg} role="alert">
            {errorMsg}
          </div>
        )}
      </div>

      {onCancel && (
        <button
          type="button"
          className={styles.cancelLink}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
      )}
    </form>
  )
}

// ── No-email state ───────────────────────────────────────────────────────────

function NoEmailView() {
  return (
    <section aria-labelledby="email-section-heading">
      <SectionHeading id="email-section-heading">Email</SectionHeading>

      {/* Gentle first-time prompt — not a blocking modal */}
      <div className={styles.promptBanner} role="note">
        <svg
          className={styles.promptIcon}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="8" />
          <line x1="10" y1="7" x2="10" y2="10.5" />
          <circle cx="10" cy="13.5" r="0.75" fill="currentColor" stroke="none" />
        </svg>
        <p className={styles.promptText}>
          Add an email address so we can reach you about your account and API
          keys. We won't use it for marketing.
        </p>
      </div>

      <EmailForm submitLabel="Add email" />
    </section>
  )
}

// ── Has-email state ──────────────────────────────────────────────────────────

function HasEmailView() {
  const [expanded, setExpanded] = useState(false)

  function handleSuccess() {
    setExpanded(false)
  }

  return (
    <section aria-labelledby="email-section-heading">
      <SectionHeading id="email-section-heading">Email</SectionHeading>

      {!expanded ? (
        <div className={styles.emailOnFile}>
          <div className={styles.emailStatus}>
            <svg
              className={styles.checkIcon}
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="8" />
              <polyline points="6.5 10.5 9 13 13.5 8" />
            </svg>
            <span className={styles.emailStatusText}>Email on file</span>
          </div>

          <button
            type="button"
            className={styles.changeLink}
            onClick={() => setExpanded(true)}
          >
            Change email
          </button>
        </div>
      ) : (
        <EmailForm
          submitLabel="Update email"
          onSuccess={handleSuccess}
          onCancel={() => setExpanded(false)}
        />
      )}
    </section>
  )
}

// ── Exported component ───────────────────────────────────────────────────────

export default function EmailSection() {
  const { hasEmail } = useAuth()
  return hasEmail ? <HasEmailView /> : <NoEmailView />
}
