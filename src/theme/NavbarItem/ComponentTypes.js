// Register custom navbar item types so the masthead entries can be driven from
// docusaurus.config.js via `type: 'custom-bpsBrand'` / `type: 'custom-navLink'`.
import React from 'react'
import ComponentTypes from '@theme-original/NavbarItem/ComponentTypes'
import BpsBrand from '@site/src/components/Navbar/BpsBrand'
import NavCustomLink from '@site/src/components/Navbar/NavCustomLink'
import NavSep from '@site/src/components/Navbar/NavSep'
import DocsMenu from '@site/src/components/Navbar/DocsMenu'
import BpsAccount from '@site/src/components/Navbar/BpsAccount'
import AskAiButton from '@site/src/components/Navbar/AskAiButton'

// The masthead's locale picker has to exist as a navbar item to appear in the
// top bar, but the hamburger drawer surfaces the language picker itself — once
// inside DocsMenu's Documentation group off docs routes, once beneath the
// sidebar items on them (see DocSidebar/Mobile). Left alone, the navbar item
// renders a third copy into the drawer's main menu.
//
// So the masthead item (the one marked `bpsMainMenuLocale` in the config)
// renders in the bar only. The marker className doubles as the flag because
// Docusaurus validates built-in item types against a closed schema and drops
// unknown keys — a `drawer: false` prop like NavCustomLink's never reaches the
// component (custom-* items keep their extra props; built-in ones don't).
//
// This replaces a CSS rule that hid the drawer copy with
// `.menu__list-item:has(> .bpsMainMenuLocale)` — a selector that depended on
// the picker being a direct child of its <li>, and silently stopped matching
// (leaving a visible duplicate "Languages" row) as soon as Docusaurus wrapped
// mobile dropdowns in `.menu__list-item-collapsible`. Not rendering the item
// can't be undone by upstream markup changes.
const OriginalLocaleDropdown = ComponentTypes.localeDropdown

function LocaleDropdown(props) {
  if (props.mobile && props.className?.includes('bpsMainMenuLocale')) {
    return null
  }
  return <OriginalLocaleDropdown {...props} />
}

export default {
  ...ComponentTypes,
  localeDropdown: LocaleDropdown,
  'custom-bpsBrand': BpsBrand,
  'custom-navLink': NavCustomLink,
  'custom-navSep': NavSep,
  'custom-docsMenu': DocsMenu,
  'custom-bpsAccount': BpsAccount,
  'custom-askAi': AskAiButton,
}
