/**
 * icons — shared SVG icon components for the Account section.
 *
 * Each icon is a small presentational component that bakes in its intrinsic
 * attributes (viewBox, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin,
 * and aria-hidden where the original markup had it) and forwards `className`
 * plus any remaining `...props` onto the root <svg>. This lets callers pass
 * `className={styles.xxx}` (or override an attr like strokeWidth) without
 * losing the icon's shape.
 */

import React from 'react'

// ── API keys and Spaces invites ────────────────────────────────────────────────

export function LockIcon({ className, ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="7" width="10" height="8" rx="1.5" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  )
}

export function TicketIcon({ className, ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M2 3h12v3a2 2 0 0 0 0 4v3H2v-3a2 2 0 0 0 0-4V3Z" />
      <path d="M9.5 4.5v1M9.5 7.5v1M9.5 10.5v1" />
    </svg>
  )
}

export function CheckIcon({ className, ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <polyline points="2.5 8.5 6.5 12 13.5 4.5" />
    </svg>
  )
}

export function CopyIcon({ className, ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="5" y="4" width="9" height="10" rx="1.5" />
      <path d="M4 12H3a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 3 1h8a1.5 1.5 0 0 1 1.5 1.5v1" />
    </svg>
  )
}

export function EmptyKeysIcon({ className, ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="4" y="11" width="16" height="11" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

// ── DangerZone ─────────────────────────────────────────────────────────────────

export function TrashIcon({ className, strokeWidth = '1.6', ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 4h12M5 4V2.5A1.5 1.5 0 0 1 6.5 1h3A1.5 1.5 0 0 1 11 2.5V4M6 7v5M10 7v5M3 4l.75 9A1.5 1.5 0 0 0 5.25 14.5h5.5A1.5 1.5 0 0 0 12.25 13L13 4" />
    </svg>
  )
}

export function LockKeyholeIcon({ className, ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="2" y="6" width="12" height="9" rx="1.5" />
      <path d="M4 6V4.5a4 4 0 0 1 8 0V6" />
      <circle cx="8" cy="10.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function CircleCheckIcon({ className, ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M5.5 8l2 2 3.5-3.5" />
    </svg>
  )
}

export function DropIcon({ className, ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8 1v8M3 6.5C1.5 7.5 1 9 1 10a5 5 0 0 0 10 0c0-1-.5-2.5-2-3.5" />
    </svg>
  )
}

export function WarningTriangleIcon({ className, ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M10 2L2 17h16L10 2z" />
      <line x1="10" y1="9" x2="10" y2="12.5" />
      <circle cx="10" cy="15" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function AlertCircleIcon({ className, ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="8" cy="8" r="6.5" />
      <line x1="8" y1="5" x2="8" y2="8.5" />
      <circle cx="8" cy="11" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  )
}

// ── ProfileCard ────────────────────────────────────────────────────────────────

export function EnvelopeIcon({ className, ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="2" y="5" width="16" height="11" rx="2" />
      <polyline points="2 7 10 12 18 7" />
    </svg>
  )
}
