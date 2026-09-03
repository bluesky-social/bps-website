import React from 'react'
import Link from '@docusaurus/Link'
import { useLocation } from '@docusaurus/router'
import { useNavbarMobileSidebar } from '@docusaurus/theme-common/internal'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { usePluginData } from '@docusaurus/useGlobalData'
import isInternalUrl from '@docusaurus/isInternalUrl'
import {
  findFirstSidebarItemLink,
  isVisibleSidebarItem,
} from '@docusaurus/plugin-content-docs/client'
import NavbarItem from '@theme/NavbarItem'

// Surfaces the docs sections inside the mobile hamburger on NON-docs routes
// (the homepage, blog, etc.), where Docusaurus wouldn't otherwise render a
// sidebar — so the menu isn't nearly empty there. On docs routes it returns
// null because the real sidebar already populates the drawer. Desktop: null
// (the masthead top bar carries navigation instead).
//
// The sections come from sidebars.js itself, via the docs-sidebar-nav plugin
// (plugins/docs-sidebar-nav.js), which publishes the sidebar's resolved items
// as global data. This list used to be a hardcoded array kept in sync with
// sidebars.js by hand, and it drifted out of sync on essentially every sidebar
// change — nothing here is maintained separately now, so it cannot drift.
// Only the top level is rendered, matching the collapsed top level of the real
// sidebar; children stay behind their section pages.
export default function DocsMenu({ mobile }) {
  const { pathname } = useLocation()
  const mobileSidebar = useNavbarMobileSidebar()
  const {
    i18n: { currentLocale, defaultLocale },
  } = useDocusaurusContext()
  const sidebarNav = usePluginData('docs-sidebar-nav')
  if (!mobile) return null
  if (!sidebarNav) {
    throw new Error(
      'DocsMenu: no global data from the docs-sidebar-nav plugin. Is ' +
        'plugins/docs-sidebar-nav.js still registered in docusaurus.config.js?',
    )
  }
  // Strip the locale prefix (`/ja`) before checking; on non-default locales
  // a docs route looks like `/ja/docs/...`, not `/docs/...`.
  const localePrefix =
    currentLocale === defaultLocale ? '' : `/${currentLocale}`
  if (pathname.startsWith(`${localePrefix}/docs`)) return null
  const close = () => mobileSidebar.toggle()

  // The same two helpers the real sidebar uses, so this list hides the same
  // items it hides (unlisted docs) and links categories to the same place it
  // links them (their own page, or their first child if they have none).
  // Anything unlinkable — an `html` item, an empty category — drops out.
  const links = sidebarNav.items
    .filter((item) => isVisibleSidebarItem(item, pathname))
    .map((item) => ({ label: item.label, href: findFirstSidebarItemLink(item) }))
    .filter((link) => link.label && link.href)

  return (
    <>
      <li className="menu__list-item bpsDocsMenuHeading" aria-hidden="true">
        Documentation
      </li>
      {links.map((l) => (
        <li className="menu__list-item" key={l.href}>
          {isInternalUrl(l.href) ? (
            <Link className="menu__link" to={l.href} onClick={close}>
              {l.label}
            </Link>
          ) : (
            <a
              className="menu__link"
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
            >
              {l.label}
            </a>
          )}
        </li>
      ))}
      {/* Standard locale switcher, in the Documentation group so it's one tap
          inside the hamburger (vs. the standalone main-menu item it replaces —
          hidden via CSS). The docs-sidebar pane gets its own copy. */}
      <NavbarItem
        mobile
        type="localeDropdown"
        dropdownItemsBefore={[]}
        dropdownItemsAfter={[]}
        onClick={close}
      />
    </>
  )
}
