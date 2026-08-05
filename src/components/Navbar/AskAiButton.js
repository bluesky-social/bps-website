/**
 * AskAiButton — Navbar "AI" button that opens the Kapa AI widget.
 *
 * The Kapa script is loaded site-wide from docusaurus.config.js with
 * `data-button-hide: "true"`, which suppresses Kapa's own floating pop-up
 * launcher. This button is the sole entry point: an "Ask AI" control sitting
 * immediately to the right of the search box.
 *
 * (docs.bsky.app took the other approach — an "Ask AI" button injected into the
 * Algolia DocSearch modal, so the widget was only reachable *through* search.
 * That client module is deliberately not ported here.)
 *
 * Desktop: "ASK AI" in plain mono text, matching the masthead links ("GET
 *   STARTED", "AT PROTOCOL") rather than the search box's bordered surface.
 *   Spelled out because a bare "AI" read as a label for something rather than an
 *   action you can take.
 * Mobile (≤996px): a 2rem circular hit area holding a monotone sparkle glyph —
 *   matching the search magnifying-glass icon button and the account icon button
 *   that flank it. A stroked currentColor icon rather than the ✨ emoji, which
 *   renders as a fixed multi-color bitmap and can't take the nav ink/hover
 *   tokens the neighboring glyphs use.
 *
 * Both faces are in the markup at all times, swapped by the CSS breakpoint, so
 * there's no width measurement and nothing to mismatch at hydration.
 *
 * Renders nothing into the hamburger drawer (`mobile` pass) — like BpsAccount,
 * this control stays in the top bar at every width.
 *
 * Driven from docusaurus.config.js via `type: 'custom-askAi'`.
 */

import React, { useCallback } from 'react'
import styles from './AskAiButton.module.css'

// The widget script is `async`, so a click landing in the first moments after
// page load can arrive before window.Kapa is defined. Rather than no-op on the
// user (atproto.com's behavior), wait briefly for the script to finish.
const POLL_INTERVAL_MS = 100
const POLL_TIMEOUT_MS = 5000

// Guards against stacking timers if the button is clicked repeatedly while the
// script is still in flight.
let pendingOpen = false

function openKapa() {
  if (typeof window === 'undefined') return
  if (window.Kapa) {
    window.Kapa.open()
    return
  }
  if (pendingOpen) return
  pendingOpen = true
  const deadline = Date.now() + POLL_TIMEOUT_MS
  const timer = setInterval(() => {
    if (window.Kapa) {
      clearInterval(timer)
      pendingOpen = false
      window.Kapa.open()
    } else if (Date.now() > deadline) {
      // Script blocked or failed to load — give up silently.
      clearInterval(timer)
      pendingOpen = false
    }
  }, POLL_INTERVAL_MS)
}

// Sparkle glyph (single path, currentColor) so it picks up the same nav ink and
// blue hover as the search and account icons.
function SparkleIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Four-point star, plus a smaller one trailing off the corner */}
      <path d="M12 3l1.9 5.6L19.5 10.5 13.9 12.4 12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" />
      <path d="M18.5 16.5v3.5" />
      <path d="M16.75 18.25h3.5" />
    </svg>
  )
}

export default function AskAiButton({ mobile }) {
  const onClick = useCallback(() => openKapa(), [])

  if (mobile) return null

  return (
    <button
      type="button"
      className={`${styles.button} bpsAskAi`}
      onClick={onClick}
      aria-label="Ask AI"
      title="Ask AI"
    >
      <span className={styles.label}>Ask AI</span>
      <SparkleIcon className={styles.icon} />
    </button>
  )
}
