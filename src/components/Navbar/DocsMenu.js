import React from 'react'
import Link from '@docusaurus/Link'
import { useLocation } from '@docusaurus/router'
import { useNavbarMobileSidebar } from '@docusaurus/theme-common/internal'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import NavbarItem from '@theme/NavbarItem'

// Top-level docs sections, mirroring the sidebar (kept in sync by hand).
const DOCS_LINKS = [
  { label: 'Get Started', to: '/docs/get-started' },
  { label: 'About Bluesky Content', to: '/docs/about-bluesky-content' },
  { label: 'Relay', to: '/docs/relay' },
  { label: 'Jetstream', to: '/docs/jetstream' },
  { label: 'API Hosts and Auth', to: '/docs/api-directory' },
  { label: 'OAuth', to: '/docs/oauth-client' },
  { label: 'Developer Guidelines', to: '/docs/developer-guidelines' },
  { label: 'Tutorials', href: 'https://atproto.com/guides/tutorials' },
]

// Surfaces the docs sections inside the mobile hamburger on NON-docs routes
// (the homepage, blog, etc.), where Docusaurus wouldn't otherwise render a
// sidebar — so the menu isn't nearly empty there. On docs routes it returns
// null because the real sidebar already populates the drawer. Desktop: null
// (the masthead top bar carries navigation instead).
export default function DocsMenu({ mobile }) {
  const { pathname } = useLocation()
  const mobileSidebar = useNavbarMobileSidebar()
  const {
    i18n: { currentLocale, defaultLocale },
  } = useDocusaurusContext()
  if (!mobile) return null
  // Strip the locale prefix (`/ja`) before checking; on non-default locales
  // a docs route looks like `/ja/docs/...`, not `/docs/...`.
  const localePrefix =
    currentLocale === defaultLocale ? '' : `/${currentLocale}`
  if (pathname.startsWith(`${localePrefix}/docs`)) return null
  const close = () => mobileSidebar.toggle()

  return (
    <>
      <li className="menu__list-item bpsDocsMenuHeading" aria-hidden="true">
        Documentation
      </li>
      {DOCS_LINKS.map((l) => (
        <li className="menu__list-item" key={l.to || l.href}>
          {l.href ? (
            <a
              className="menu__link"
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
            >
              {l.label}
            </a>
          ) : (
            <Link className="menu__link" to={l.to} onClick={close}>
              {l.label}
            </Link>
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
