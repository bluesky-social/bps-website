/**
 * AskAiButton — Navbar "AI" button that opens the Kapa AI widget.
 *
 * The Kapa script is loaded site-wide from docusaurus.config.js with
 * `data-button-hide: "true"`, which suppresses Kapa's own floating pop-up
 * launcher. This button is the sole entry point, mirroring atproto.com: a plain
 * "AI" control sitting immediately to the right of the search box.
 *
 * (docs.bsky.app took the other approach — an "Ask AI" button injected into the
 * Algolia DocSearch modal, so the widget was only reachable *through* search.
 * That client module is deliberately not ported here.)
 *
 * Desktop: plain mono text, matching the masthead links ("GET STARTED", "AT
 *   PROTOCOL") rather than the search box's bordered surface.
 * Mobile (≤996px): a 2rem circular hit area, matching the search
 *   magnifying-glass icon button and the account icon button that flank it.
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
      AI
    </button>
  )
}
