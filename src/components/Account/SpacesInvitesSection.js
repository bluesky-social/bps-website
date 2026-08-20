import React, { useCallback, useEffect, useState } from 'react'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { useAuth } from '@site/src/auth/AuthContext'
import { CheckIcon, CopyIcon, TicketIcon } from './icons'
import CopyableReveal from './CopyableReveal'
import ExternalLinkIcon from '../ExternalLinkIcon'
import styles from './SpacesInvitesSection.module.css'
import Link from '@docusaurus/Link'

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function inviteStatus(invite) {
  if (invite.disabled) return 'Disabled'
  if (invite.uses >= invite.available) return 'Used'
  return 'Available'
}

function CopyButton({ code }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setError(false)
    } catch {
      setError(true)
    }
  }

  return (
    <span className={styles.copyWrap}>
      <button
        type="button"
        className={`${styles.copyButton}${copied ? ` ${styles.copyButtonDone}` : ''}`}
        onClick={copy}
        aria-label={copied ? 'Invite code copied' : 'Copy invite code'}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      {error && (
        <span className={styles.copyError} role="alert">
          Select and copy the code manually.
        </span>
      )}
    </span>
  )
}

function NewInviteReveal({ code, signupUrl }) {
  return (
    <CopyableReveal
      icon={<TicketIcon />}
      title="Your new invite code"
      value={code}
      valueLabel="Your new invite code"
      copyLabel="Copy invite code"
      copiedLabel="Invite code copied"
      copyErrorMessage="Clipboard write failed — select and copy the code manually."
      actionLabel="Sign up"
      actionHref={signupUrl}
      actionIcon={<ExternalLinkIcon />}
    >
      <strong>Invite created.</strong> Copy this code to sign up for an atproto
      spaces alpha account.
    </CopyableReveal>
  )
}

function InviteRow({ invite }) {
  const status = inviteStatus(invite)
  const isAvailable = status === 'Available'

  return (
    <li className={styles.inviteRow}>
      <div className={styles.inviteMain}>
        <div className={styles.codeRow}>
          <code className={styles.code}>{invite.code}</code>
          <span
            className={`${styles.status} ${isAvailable ? styles.statusAvailable : styles.statusInactive}`}
          >
            {status}
          </span>
        </div>
        <span className={styles.created}>
          <span className={styles.createdLabel}>Created</span>
          <span className={styles.createdValue}>
            {formatDate(invite.createdAt)}
          </span>
        </span>
      </div>
      <CopyButton code={invite.code} />
    </li>
  )
}

export default function SpacesInvitesSection() {
  const { client } = useAuth()
  const { siteConfig } = useDocusaurusContext()
  const spacesPdsUrl = siteConfig.customFields?.spacesPdsUrl
  const signupUrl = spacesPdsUrl ? `${spacesPdsUrl}/account/sign-up` : null
  const signupLabel = signupUrl?.replace(/^https?:\/\//, '')
  const [codes, setCodes] = useState([])
  const [loadStatus, setLoadStatus] = useState('loading')
  const [loadError, setLoadError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [newInvite, setNewInvite] = useState(null)

  const loadCodes = useCallback(async () => {
    setLoadStatus('loading')
    setLoadError(null)
    try {
      const result = await client.spacesAlphaListInvites()
      setCodes(result.codes ?? [])
      setLoadStatus('loaded')
    } catch (err) {
      setLoadStatus('error')
      setLoadError(err?.message || 'Could not load invite codes.')
    }
  }, [client])

  useEffect(() => {
    loadCodes()
  }, [loadCodes])

  async function createInvite() {
    setCreating(true)
    setCreateError(null)
    try {
      const result = await client.spacesAlphaCreateInvite()
      setNewInvite({ code: result.code })
      await loadCodes()
    } catch (err) {
      setCreateError(err?.message || 'Could not create an invite code.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <section aria-labelledby="spaces-invites-heading">
      <h2 id="spaces-invites-heading" className={styles.heading}>
        Atproto Spaces Alpha
      </h2>
      <p className={styles.intro}>
        Create an invite code to sign up for an atproto spaces alpha account
        {signupUrl ? (
          <>
            {' at '}
            <Link
              className={styles.accountLink}
              to={signupUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {signupLabel}
            </Link>
          </>
        ) : null}
        .
      </p>

      {newInvite && (
        <NewInviteReveal code={newInvite.code} signupUrl={signupUrl} />
      )}

      <button
        type="button"
        className={styles.createButton}
        onClick={createInvite}
        disabled={creating}
      >
        {creating ? 'Creating…' : 'Create invite code'}
      </button>

      {createError && (
        <div className={styles.error} role="alert">
          {createError}
        </div>
      )}

      <div className={styles.listArea}>
        {loadStatus === 'loading' && (
          <div className={styles.loading} aria-live="polite">
            Loading invite codes…
          </div>
        )}
        {loadStatus === 'error' && (
          <div className={styles.error} role="alert">
            <span>{loadError}</span>
            <button type="button" className={styles.retry} onClick={loadCodes}>
              Retry
            </button>
          </div>
        )}
        {loadStatus === 'loaded' && codes.length === 0 && (
          <p className={styles.empty}>
            You don’t have any Spaces invite codes yet.
          </p>
        )}
        {loadStatus === 'loaded' && codes.length > 0 && (
          <ul
            className={styles.inviteList}
            aria-label="ATProto Spaces invite codes"
          >
            {codes.map((invite) => (
              <InviteRow key={invite.code} invite={invite} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
