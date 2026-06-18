import React from 'react'
import Link from '@docusaurus/Link'

// Mono masthead nav link, modeled on the landing-bsky prototype's "nav-mini"
// entries (uppercase JetBrains mono). Used for "Get Started" (internal `to`)
// and "GitHub" (external `href`). External links get a trailing outbound-arrow
// icon. Returns null in the mobile hamburger — these stay in the top bar at all
// widths, so the drawer keeps the standard Docusaurus menu.
function ExternalArrow() {
  return (
    <svg
      className="bpsNav__extIcon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  )
}

export default function NavCustomLink({ mobile, label, to, href, external }) {
  if (mobile) return null
  const cls = 'bpsNav bpsNav--link'
  const content = (
    <>
      <span className="bpsNav__label">{label}</span>
      {external && <ExternalArrow />}
    </>
  )
  if (href) {
    return (
      <a className={cls} href={href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    )
  }
  return (
    <Link className={cls} to={to}>
      {content}
    </Link>
  )
}
