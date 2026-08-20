import React from 'react'
import Link from '@docusaurus/Link'
import { useLocation } from '@docusaurus/router'
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal'
import ExternalLinkIcon from '../ExternalLinkIcon'

// Mono masthead nav link, modeled on the landing-bsky prototype's "nav-mini"
// entries (uppercase JetBrains mono). Used for "Learn" (internal `to`)
// and "GitHub" (external `href`). External links get a trailing outbound-arrow
// icon.
//
// Desktop: renders in the top bar (the mono masthead style). Mobile: renders as
// a standard menu link inside the hamburger drawer, so the drawer's main menu
// isn't empty (the bar collapses these away at mobile widths via CSS).
export default function NavCustomLink({ mobile, label, to, href, external }) {
  // Close the mobile drawer when a drawer link is tapped (Docusaurus doesn't
  // auto-close for these custom items the way it does for its own menu links).
  const mobileSidebar = useNavbarMobileSidebar()
  const { pathname } = useLocation()
  // Active when the current route is, or is nested under, this link's target.
  // External (`href`) links never get an active state. A plain Docusaurus
  // <Link> doesn't track this on its own (unlike the built-in NavLink items),
  // so we mark it ourselves to match the rest of the masthead.
  const active = !external && !!to && (pathname === to || pathname.startsWith(to + '/'))
  // In the mobile drawer, render as a plain Docusaurus menu link so the main
  // menu is populated (Learn, GitHub). Desktop uses the mono bar style.
  const base = mobile ? 'menu__link' : 'bpsNav bpsNav--link'
  const activeCls = active ? (mobile ? ' menu__link--active' : ' bpsNav--link--active') : ''
  const cls = base + activeCls
  const onClick = mobile ? () => mobileSidebar.toggle() : undefined
  const content = (
    <>
      <span className="bpsNav__label">{label}</span>
      {external && <ExternalLinkIcon className="bpsNav__extIcon" />}
    </>
  )
  const anchor = href ? (
    <a className={cls} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
      {content}
    </a>
  ) : (
    <Link className={cls} to={to} aria-current={active ? 'page' : undefined} onClick={onClick}>
      {content}
    </Link>
  )
  // Drawer menu items are <li> rows.
  return mobile ? <li className="menu__list-item">{anchor}</li> : anchor
}
