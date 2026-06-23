import React from 'react'

// Masthead nav glyphs, modeled on the landing-bsky prototype's nav-mini:
//   - "sep": the middot "·" between the mono links (prototype ".sep")
//   - "divider": the vertical rule that brackets the link cluster (prototype's
//     live-pill border-right / version-stamp border-left)
// Both are real flex children so they pick up the right group's even gaps.
// Null in the mobile drawer.
//
// Driven from docusaurus.config.js via `type: 'custom-navSep'` with a
// `variant: 'sep' | 'divider'` prop.
export default function NavSep({ mobile, variant = 'sep' }) {
  if (mobile) return null
  if (variant === 'divider') {
    return <span className="bpsNav__divider" aria-hidden="true" />
  }
  return <span className="bpsNav__sep" aria-hidden="true">·</span>
}
