// Register custom navbar item types so the masthead entries can be driven from
// docusaurus.config.js via `type: 'custom-bpsBrand'` / `type: 'custom-navLink'`.
import ComponentTypes from '@theme-original/NavbarItem/ComponentTypes'
import BpsBrand from '@site/src/components/Navbar/BpsBrand'
import NavCustomLink from '@site/src/components/Navbar/NavCustomLink'
import NavSep from '@site/src/components/Navbar/NavSep'
import DocsMenu from '@site/src/components/Navbar/DocsMenu'
import BpsAccount from '@site/src/components/Navbar/BpsAccount'
import AskAiButton from '@site/src/components/Navbar/AskAiButton'

export default {
  ...ComponentTypes,
  'custom-bpsBrand': BpsBrand,
  'custom-navLink': NavCustomLink,
  'custom-navSep': NavSep,
  'custom-docsMenu': DocsMenu,
  'custom-bpsAccount': BpsAccount,
  'custom-askAi': AskAiButton,
}
