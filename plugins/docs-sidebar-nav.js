/**
 * Publishes the docs sidebar's resolved item tree as plugin global data, so
 * components rendered OUTSIDE the docs routes can show the real sidebar
 * instead of a hand-maintained copy of it.
 *
 * Why this exists: Docusaurus only provides the sidebar through React context
 * on docs routes (`useDocsSidebar()` needs DocsSidebarProvider, which only
 * wraps the docs layout). The docs plugin's own global data carries just the
 * sidebar's *first* link, not its items. So anything else that wants to list
 * the docs sections — here, the mobile hamburger drawer on the homepage and
 * the blog (see src/components/Navbar/DocsMenu.js) — used to keep a duplicate
 * array of labels and URLs, which silently drifted from sidebars.js every time
 * the sidebar changed. Global data has no such route restriction: this makes
 * sidebars.js the single source of truth for both.
 *
 * The published items are the exact props the real sidebar is rendered from
 * (`toSidebarsProp`), so labels (including `sidebar_label` frontmatter and
 * per-locale translations, which are applied to plugin content before this
 * hook runs), permalinks, classNames and `unlisted` flags all match it by
 * construction rather than by review.
 *
 * Options:
 *   sidebarId    (required) key in sidebars.js, e.g. 'tutorialSidebar'
 *   docsPluginId (default 'default') docs plugin instance id
 *
 * Every failure mode below throws at build time. That is the point: the whole
 * class of bug this replaces was a mismatch nobody noticed until it shipped.
 */

const DOCS_PLUGIN_NAME = 'docusaurus-plugin-content-docs'

// `toSidebarsProp` is the docs plugin's own sidebar-items-to-props conversion.
// It isn't part of the plugin's documented public API, but the package exposes
// "./lib/*" in its exports map, and this is the only way to get the same
// resolution the real sidebar uses (labels from frontmatter, permalinks from
// doc ids) without reimplementing it. If a Docusaurus upgrade moves it, the
// build stops here with instructions instead of quietly rendering nothing.
function loadToSidebarsProp() {
  try {
    // The exports map is a literal "./lib/*" → "./lib/*", so the extension is
    // required (3.10 resolves "…/lib/props" to nothing); the extensionless
    // spelling worked on older versions, hence the fallback.
    let props
    try {
      // eslint-disable-next-line global-require, import/no-unresolved
      props = require('@docusaurus/plugin-content-docs/lib/props.js')
    } catch {
      // eslint-disable-next-line global-require, import/no-unresolved
      props = require('@docusaurus/plugin-content-docs/lib/props')
    }
    if (typeof props.toSidebarsProp !== 'function') {
      throw new Error('module loaded, but it has no toSidebarsProp export')
    }
    return props.toSidebarsProp
  } catch (err) {
    throw new Error(
      'docs-sidebar-nav: could not load toSidebarsProp() from ' +
        '"@docusaurus/plugin-content-docs/lib/props". A Docusaurus upgrade ' +
        'probably moved or renamed it. Find the function that converts loaded ' +
        'sidebar items into sidebar props (it resolves doc ids to labels and ' +
        'permalinks) and point this require at it.',
      { cause: err },
    )
  }
}

module.exports = function docsSidebarNavPlugin(_context, options) {
  const { sidebarId, docsPluginId = 'default' } = options ?? {}
  if (!sidebarId) {
    throw new Error(
      'docs-sidebar-nav: the `sidebarId` option is required (the key in ' +
        'sidebars.js whose items should be published, e.g. "tutorialSidebar").',
    )
  }

  return {
    name: 'docs-sidebar-nav',

    // allContentLoaded (not contentLoaded) because the content we need belongs
    // to another plugin: this hook runs after every plugin has loaded its own.
    async allContentLoaded({ allContent, actions }) {
      const docsContent = allContent[DOCS_PLUGIN_NAME]?.[docsPluginId]
      if (!docsContent) {
        throw new Error(
          `docs-sidebar-nav: no loaded content for ${DOCS_PLUGIN_NAME} ` +
            `(pluginId "${docsPluginId}"). Is the docs plugin enabled, and is ` +
            'the `docsPluginId` option right?',
        )
      }

      // This site is unversioned, so there is exactly one loaded version
      // ("current"). Preferring it by name keeps the lookup correct if docs
      // versioning is ever turned on — the drawer should list the version a
      // visitor lands on by default.
      const { loadedVersions } = docsContent
      const version =
        loadedVersions.find((v) => v.versionName === 'current') ??
        loadedVersions[0]
      if (!version) {
        throw new Error('docs-sidebar-nav: the docs plugin loaded no versions.')
      }

      const sidebars = loadToSidebarsProp()(version)
      const items = sidebars[sidebarId]
      if (!items) {
        throw new Error(
          `docs-sidebar-nav: sidebars.js has no sidebar "${sidebarId}". ` +
            `Available: ${Object.keys(sidebars).join(', ') || '(none)'}.`,
        )
      }

      // The full tree, not just the top level: consumers decide how deep to
      // render, and the official client helpers (findFirstSidebarItemLink,
      // isVisibleSidebarItem) expect whole items.
      actions.setGlobalData({ sidebarId, items })
    },
  }
}
