import React from 'react'
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal'
import {translate} from '@docusaurus/Translate'
import NavbarColorModeToggle from '@theme/Navbar/ColorModeToggle'
import IconClose from '@theme/Icon/Close'
import BpsBrand from '@site/src/components/Navbar/BpsBrand'

// Swizzled (ejected) mobile-sidebar header: render the BPS lockup (same size as
// the top bar) with the light/dark toggle just to its right, then the close
// button. Replaces the default empty NavbarLogo slot.
function CloseButton() {
  const mobileSidebar = useNavbarMobileSidebar()
  return (
    <button
      type="button"
      aria-label={translate({
        id: 'theme.docs.sidebar.closeSidebarButtonAriaLabel',
        message: 'Close navigation bar',
        description: 'The ARIA label for close button of mobile sidebar',
      })}
      className="clean-btn navbar-sidebar__close"
      onClick={() => mobileSidebar.toggle()}
    >
      <IconClose color="var(--bps-nav-ink-soft)" />
    </button>
  )
}

export default function NavbarMobileSidebarHeader() {
  return (
    <div className="navbar-sidebar__brand">
      <BpsBrand to="/" />
      <NavbarColorModeToggle className="bpsDrawerToggle" />
      <CloseButton />
    </div>
  )
}
