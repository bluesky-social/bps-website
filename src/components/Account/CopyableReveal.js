import React, { useState } from 'react'
import { CheckIcon, CopyIcon } from './icons'
import styles from './CopyableReveal.module.css'

export default function CopyableReveal({
  icon,
  title,
  value,
  valueLabel,
  copyLabel,
  copiedLabel,
  copyErrorMessage,
  doneLabel,
  onDone,
  children,
}) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopyError(true)
    }
  }

  return (
    <div className={styles.reveal} role="alert" aria-live="assertive">
      <div className={styles.header}>
        <span className={styles.badge} aria-hidden="true">
          {icon}
        </span>
        <span className={styles.title}>{title}</span>
      </div>

      <p className={styles.message}>{children}</p>

      <div className={styles.valueRow}>
        <input
          type="text"
          readOnly
          value={value}
          onFocus={(event) => event.target.select()}
          className={styles.value}
          aria-label={valueLabel}
        />
        <button
          type="button"
          className={`${styles.copyButton}${copied ? ` ${styles.copyButtonDone}` : ''}`}
          onClick={copy}
          aria-label={copied ? copiedLabel : copyLabel}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {copyError && (
        <p className={styles.copyError} role="alert">
          {copyErrorMessage}
        </p>
      )}

      <button type="button" className={styles.doneButton} onClick={onDone}>
        {doneLabel}
      </button>
    </div>
  )
}
