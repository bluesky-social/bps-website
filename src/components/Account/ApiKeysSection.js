/**
 * ApiKeysSection — API key management.
 *
 * Features:
 *  - List all keys on mount (label, masked preview, created date, expiry / status).
 *  - Create form: label (required) + expiry preset (30 / 90 / 365 days or Never).
 *  - Copy-once secret reveal: on creation the full `key` is shown ONCE in a
 *    copyable field with a prominent copy button + "you won't see this again"
 *    warning. A "Done / I've copied it" action clears it from React state.
 *    The secret is NEVER stored in localStorage and NEVER re-rendered.
 *  - Delete: inline confirm → apiKeyDelete(id) → refresh list.
 *  - Backend errors surface inline; in-flight states disable buttons.
 *
 * Consumes useAuth().client:
 *   apiKeyList()                    → { keys: [{id, label, preview, createdAt, expiresAt?}] }
 *   apiKeyCreate({label, expiresAt})→ { id, label, preview, createdAt, expiresAt?, key }
 *   apiKeyDelete(id)                → { ok }
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@site/src/auth/AuthContext'
import styles from './ApiKeysSection.module.css'

// ── Helpers ──────────────────────────────────────────────────────────────────

const EXPIRY_OPTIONS = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
  { label: 'Never', days: null },
]

function computeExpiresAt(days) {
  if (days === null) return undefined
  return new Date(Date.now() + days * 86400000).toISOString()
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function isExpired(expiresAt) {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

// ── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ id, children }) {
  return <h2 id={id} className={styles.sectionHeading}>{children}</h2>
}

// ── Copy-once secret reveal ──────────────────────────────────────────────────

function SecretReveal({ secret, onDone }) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopyError(true)
    }
  }

  return (
    <div className={styles.secretReveal} role="alert" aria-live="assertive">
      <div className={styles.secretHeader}>
        <span className={styles.secretBadge} aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="7" width="10" height="8" rx="1.5" />
            <path d="M5 7V5a3 3 0 0 1 6 0v2" />
          </svg>
        </span>
        <span className={styles.secretTitle}>Your new API key</span>
      </div>

      <p className={styles.secretWarning}>
        <strong>Copy this key now.</strong> For security, it won't be shown again
        after you dismiss this.
      </p>

      <div className={styles.secretRow}>
        <input
          type="text"
          readOnly
          value={secret}
          onFocus={(e) => e.target.select()}
          className={styles.secretValue}
          aria-label="Your new API key"
        />
        <button
          type="button"
          className={`${styles.copyBtn}${copied ? ` ${styles.copyBtnDone}` : ''}`}
          onClick={handleCopy}
          aria-label={copied ? 'Copied!' : 'Copy API key to clipboard'}
        >
          {copied ? (
            <>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="2.5 8.5 6.5 12 13.5 4.5" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="4" width="9" height="10" rx="1.5" />
                <path d="M4 12H3a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 3 1h8a1.5 1.5 0 0 1 1.5 1.5v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {copyError && (
        <p className={styles.copyErrNote}>
          Clipboard write failed — please select and copy the key manually.
        </p>
      )}

      <button
        type="button"
        className={styles.secretDoneBtn}
        onClick={onDone}
      >
        Done — I've copied it
      </button>
    </div>
  )
}

// ── Create form ──────────────────────────────────────────────────────────────

function CreateForm({ onCreated }) {
  const { client } = useAuth()
  const [label, setLabel] = useState('')
  const [expiryIdx, setExpiryIdx] = useState(0) // default: 30 days
  const [status, setStatus] = useState('idle') // idle | submitting | error
  const [errorMsg, setErrorMsg] = useState(null)

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      const trimmedLabel = label.trim()
      if (!trimmedLabel) {
        setStatus('error')
        setErrorMsg('Key name is required.')
        return
      }

      const option = EXPIRY_OPTIONS[expiryIdx]
      const expiresAt = computeExpiresAt(option.days)

      setStatus('submitting')
      setErrorMsg(null)

      try {
        const result = await client.apiKeyCreate({
          label: trimmedLabel,
          ...(expiresAt !== undefined ? { expiresAt } : {}),
        })
        // Reset form
        setLabel('')
        setExpiryIdx(0)
        setStatus('idle')
        onCreated(result)
      } catch (err) {
        setStatus('error')
        setErrorMsg(err?.message || 'Could not create the key. Please try again.')
      }
    },
    [label, expiryIdx, client, onCreated],
  )

  const isSubmitting = status === 'submitting'

  return (
    <form
      className={styles.createForm}
      onSubmit={handleSubmit}
      aria-label="Create API key"
    >
      <div className={styles.createFields}>
        <div className={styles.formField}>
          <label className={styles.fieldLabel} htmlFor="key-label">
            Key name
          </label>
          <input
            id="key-label"
            className={`${styles.textInput}${status === 'error' && !label.trim() ? ` ${styles.textInputError}` : ''}`}
            type="text"
            placeholder="e.g. Production bot, CI runner…"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value)
              if (status === 'error') setStatus('idle')
            }}
            maxLength={128}
            disabled={isSubmitting}
            aria-describedby={status === 'error' ? 'key-create-error' : undefined}
            aria-invalid={status === 'error' ? 'true' : undefined}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel} htmlFor="key-expiry">
            Expiry
          </label>
          <select
            id="key-expiry"
            className={styles.select}
            value={expiryIdx}
            onChange={(e) => setExpiryIdx(Number(e.target.value))}
            disabled={isSubmitting}
          >
            {EXPIRY_OPTIONS.map((opt, i) => (
              <option key={opt.label} value={i}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {status === 'error' && errorMsg && (
        <div id="key-create-error" className={styles.errorMsg} role="alert">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        className={styles.createBtn}
        disabled={isSubmitting || !label.trim()}
      >
        {isSubmitting ? 'Creating…' : 'Create key'}
      </button>
    </form>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="11" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <p className={styles.emptyText}>No API keys yet.</p>
      <p className={styles.emptySubtext}>Create a key above to authenticate your applications.</p>
    </div>
  )
}

// ── Key row ──────────────────────────────────────────────────────────────────

function KeyRow({ apiKey, onDelete }) {
  const [confirmPending, setConfirmPending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const { client } = useAuth()

  const expired = isExpired(apiKey.expiresAt)

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await client.apiKeyDelete(apiKey.id)
      onDelete(apiKey.id)
    } catch (err) {
      setDeleting(false)
      setConfirmPending(false)
      setDeleteError(err?.message || 'Could not delete key.')
    }
  }

  return (
    <li className={styles.keyRow}>
      <div className={styles.keyMain}>
        <div className={styles.keyIdentity}>
          <span className={styles.keyLabel}>{apiKey.label}</span>
          <code className={styles.keyPreview}>{apiKey.preview}</code>
        </div>

        <div className={styles.keyMeta}>
          <span className={styles.keyMetaItem}>
            <span className={styles.keyMetaLabel}>Created</span>
            <span className={styles.keyMetaValue}>{formatDate(apiKey.createdAt)}</span>
          </span>
          <span className={styles.keyMetaSep} aria-hidden="true" />
          <span className={styles.keyMetaItem}>
            <span className={styles.keyMetaLabel}>Expires</span>
            <span className={styles.keyMetaValue}>
              {apiKey.expiresAt ? formatDate(apiKey.expiresAt) : 'Never'}
            </span>
          </span>
          <span className={styles.keyMetaSep} aria-hidden="true" />
          <span
            className={`${styles.keyStatus} ${expired ? styles.keyStatusExpired : styles.keyStatusActive}`}
          >
            {expired ? 'Expired' : 'Active'}
          </span>
        </div>
      </div>

      <div className={styles.keyActions}>
        {deleteError && (
          <span className={styles.keyDeleteError} role="alert">{deleteError}</span>
        )}

        {!confirmPending ? (
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={() => setConfirmPending(true)}
            disabled={deleting}
            aria-label={`Delete API key "${apiKey.label}"`}
          >
            Delete
          </button>
        ) : (
          <span className={styles.confirmGroup}>
            <span className={styles.confirmLabel} id={`confirm-label-${apiKey.id}`}>
              Delete this key?
            </span>
            <button
              type="button"
              className={styles.confirmYesBtn}
              onClick={handleDelete}
              disabled={deleting}
              aria-describedby={`confirm-label-${apiKey.id}`}
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              type="button"
              className={styles.confirmNoBtn}
              onClick={() => { setConfirmPending(false); setDeleteError(null) }}
              disabled={deleting}
            >
              Cancel
            </button>
          </span>
        )}
      </div>
    </li>
  )
}

// ── Key list ─────────────────────────────────────────────────────────────────

function KeyList({ keys, onDelete }) {
  if (keys.length === 0) return <EmptyState />

  return (
    <ul className={styles.keyList} aria-label="API keys">
      {keys.map((k) => (
        <KeyRow key={k.id} apiKey={k} onDelete={onDelete} />
      ))}
    </ul>
  )
}

// ── Exported component ───────────────────────────────────────────────────────

export default function ApiKeysSection() {
  const { client } = useAuth()
  const [keys, setKeys] = useState([])
  const [loadStatus, setLoadStatus] = useState('loading') // loading | loaded | error
  const [loadError, setLoadError] = useState(null)
  // newSecret holds the full key string returned by create — exactly once.
  // It is cleared on dismiss and never written to localStorage.
  const [newSecret, setNewSecret] = useState(null)

  const loadKeys = useCallback(async () => {
    setLoadStatus('loading')
    setLoadError(null)
    try {
      const res = await client.apiKeyList()
      setKeys(res.keys ?? [])
      setLoadStatus('loaded')
    } catch (err) {
      setLoadStatus('error')
      setLoadError(err?.message || 'Could not load API keys.')
    }
  }, [client])

  useEffect(() => { loadKeys() }, [loadKeys])

  function handleCreated(result) {
    // Prepend the new key (without its secret) to the list
    setKeys((prev) => [
      { id: result.id, label: result.label, preview: result.preview, createdAt: result.createdAt, expiresAt: result.expiresAt },
      ...prev,
    ])
    // Show the secret exactly once — held only in React state
    setNewSecret(result.key)
  }

  function handleSecretDone() {
    // Clear the secret from memory — after this it is gone
    setNewSecret(null)
  }

  function handleDelete(id) {
    setKeys((prev) => prev.filter((k) => k.id !== id))
  }

  return (
    <section aria-labelledby="api-keys-section-heading">
      <SectionHeading id="api-keys-section-heading">API Keys</SectionHeading>

      {/* Copy-once secret reveal — rendered only when a new key was just created */}
      {newSecret !== null && (
        <SecretReveal key={newSecret} secret={newSecret} onDone={handleSecretDone} />
      )}

      {/* Create form — always visible */}
      <CreateForm onCreated={handleCreated} />

      {/* Key list / loading / error */}
      <div className={styles.listArea}>
        {loadStatus === 'loading' && (
          <div className={styles.listLoading} aria-live="polite">
            <span className={styles.listLoadingSpinner} aria-hidden="true" />
            <span className={styles.listLoadingText}>Loading keys…</span>
          </div>
        )}

        {loadStatus === 'error' && loadError && (
          <div className={styles.listError} role="alert">
            <span>{loadError}</span>
            <button type="button" className={styles.retryBtn} onClick={loadKeys}>
              Retry
            </button>
          </div>
        )}

        {loadStatus === 'loaded' && (
          <KeyList keys={keys} onDelete={handleDelete} />
        )}
      </div>
    </section>
  )
}
