import React from 'react'
import clsx from 'clsx'
import {
  NavbarSecondaryMenuFiller,
  ThemeClassNames,
} from '@docusaurus/theme-common'
import { useNavbarMobileSidebar } from '@docusaurus/theme-common/internal'
import DocSidebarItems from '@theme/DocSidebarItems'
import NavbarItem from '@theme/NavbarItem'

// Swizzled (ejected) mobile docs-sidebar pane. Identical to the original, but
// appends the standard locale switcher beneath the sidebar items so the
// language picker is one tap away inside the hamburger on docs routes (the
// non-docs routes get their copy via DocsMenu's Documentation group instead).
// eslint-disable-next-line react/function-component-definition
const DocSidebarMobileSecondaryMenu = ({ sidebar, path }) => {
  const mobileSidebar = useNavbarMobileSidebar()
  return (
    <ul className={clsx(ThemeClassNames.docs.docSidebarMenu, 'menu__list')}>
      <DocSidebarItems
        items={sidebar}
        activePath={path}
        onItemClick={(item) => {
          // Mobile sidebar should only be closed if the category has a link
          if (item.type === 'category' && item.href) {
            mobileSidebar.toggle()
          }
          if (item.type === 'link') {
            mobileSidebar.toggle()
          }
        }}
        level={1}
      />
      <NavbarItem
        mobile
        type="localeDropdown"
        dropdownItemsBefore={[]}
        dropdownItemsAfter={[]}
        onClick={() => mobileSidebar.toggle()}
      />
    </ul>
  )
}
function DocSidebarMobile(props) {
  return (
    <NavbarSecondaryMenuFiller
      component={DocSidebarMobileSecondaryMenu}
      props={props}
    />
  )
}
export default React.memo(DocSidebarMobile)
