import React from 'react'
import Link from '@docusaurus/Link'
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal'

// Mono masthead nav link, modeled on the landing-bsky prototype's "nav-mini"
// entries (uppercase JetBrains mono). Used for "Get Started" (internal `to`)
// and "GitHub" (external `href`). External links get a trailing outbound-arrow
// icon.
//
// Desktop: renders in the top bar (the mono masthead style). Mobile: renders as
// a standard menu link inside the hamburger drawer, so the drawer's main menu
// isn't empty (the bar collapses these away at mobile widths via CSS).
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
  // Close the mobile drawer when a drawer link is tapped (Docusaurus doesn't
  // auto-close for these custom items the way it does for its own menu links).
  const mobileSidebar = useNavbarMobileSidebar()
  // In the mobile drawer, render as a plain Docusaurus menu link so the main
  // menu is populated (Get Started, GitHub). Desktop uses the mono bar style.
  const cls = mobile ? 'menu__link' : 'bpsNav bpsNav--link'
  const onClick = mobile ? () => mobileSidebar.toggle() : undefined
  const content = (
    <>
      <span className="bpsNav__label">{label}</span>
      {external && <ExternalArrow />}
    </>
  )
  const anchor = href ? (
    <a className={cls} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
      {content}
    </a>
  ) : (
    <Link className={cls} to={to} onClick={onClick}>
      {content}
    </Link>
  )
  // Drawer menu items are <li> rows.
  return mobile ? <li className="menu__list-item">{anchor}</li> : anchor
}
