// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer").themes.github;

// Dark code theme aligned with the homepage proof window (GitHub-dark token
// palette on the BPS paper surface). Defined inline so Prism writes these as
// the token inline styles directly (avoids fighting inline styles with
// !important from custom.css). See src/css/landing.css `.proof .tk-*`.
const darkCodeTheme = {
  plain: {
    color: "#E6EDF3",
    // paper-2, lifted above the #0d1117 page background so the code block reads
    // as a raised panel rather than blending into the page.
    backgroundColor: "#161c26",
  },
  styles: [
    {
      types: ["comment", "prolog", "doctype", "cdata"],
      style: { color: "#8B949E", fontStyle: "italic" },
    },
    { types: ["punctuation", "operator"], style: { color: "#E6EDF3" } },
    { types: ["keyword", "tag", "selector"], style: { color: "#FF7B72" } },
    { types: ["function"], style: { color: "#D2A8FF" } },
    {
      types: [
        "class-name",
        "maybe-class-name",
        "number",
        "constant",
        "boolean",
        "builtin",
        "property",
      ],
      style: { color: "#79C0FF" },
    },
    {
      types: ["string", "char", "attr-value", "template-string"],
      style: { color: "#A5D6FF" },
    },
    { types: ["attr-name", "variable"], style: { color: "#79C0FF" } },
    { types: ["deleted"], style: { color: "#FF7B72" } },
    { types: ["inserted"], style: { color: "#A5D6FF" } },
  ],
};

/** @type {import('@docusaurus/types').Config} */
const config = {
  scripts: [
    {
      src: "https://widget.kapa.ai/kapa-widget.bundle.js",
      "data-website-id": "58c0dcc5-974f-4718-aeac-6edfafbf3c68",
      "data-project-name": "Bluesky",
      "data-project-color": "#41ADFF",
      "data-project-logo":
        "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Bluesky_Logo.svg/330px-Bluesky_Logo.svg.png",
      "data-modal-title": "Bluesky Docs AI",
      "data-button-hide": "true",
      "data-modal-ask-ai-input-placeholder":
        "Find solutions from the docs, Github, forums, and more...",
      async: true,
    },
  ],
  title: "Bluesky",
  tagline: "Get started with the Bluesky API.",
  favicon: "img/favicon.png",

  // Set the production url of your site here
  url: "https://docs.bsky.app/",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "bluesky-social", // Usually your GitHub org/user name.
  projectName: "bsky-docs", // Usually your repo name.

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  onBrokenAnchors: "ignore",

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en", "ja"],
    localeConfigs: {
      en: { label: "English" },
      ja: { label: "日本語" },
    },
  },
  // Load the design-system fonts site-wide via real <link> tags. (A CSS @import
  // placed after other rules in custom.css is invalid and was being ignored, so
  // Atkinson didn't load on some pages.) Inter + JetBrains Mono + Atkinson
  // Hyperlegible Mono.
  stylesheets: [
    {
      href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&family=Atkinson+Hyperlegible+Mono:wght@400;700&display=swap",
      rel: "stylesheet",
    },
  ],
  headTags: [
    {
      tagName: "link",
      attributes: { rel: "preconnect", href: "https://fonts.googleapis.com" },
    },
    {
      tagName: "link",
      attributes: {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossorigin: "true",
      },
    },
  ],
  plugins: ["@docusaurus/plugin-ideal-image"],

  // The HTTP/XRPC endpoint reference is no longer generated into this site. It
  // now lives as a standalone, OpenAPI-driven static site (see ../endpoints).
  // `endpointsUrl` is that site's deployed base URL; set via the ENDPOINTS_URL
  // env var once a host/domain is chosen (intentionally not hardcoded). When
  // unset, the homepage "API Reference" card is hidden.
  customFields: {
    endpointsUrl: process.env.ENDPOINTS_URL || null,
  },
  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          // Remove this to remove the "edit this page" links.
          editUrl: "https://github.com/bluesky-social/bsky-docs/tree/main/",
        },
        blog: {
          showReadingTime: true,
          // Remove this to remove the "edit this page" links.
          editUrl: "https://github.com/bluesky-social/bsky-docs/tree/main/",
          blogSidebarCount: "ALL",
          onInlineAuthors: "ignore",
          onUntruncatedBlogPosts: "ignore",
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],
  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: "img/social-card-default.png",
      navbar: {
        // Masthead modeled on the landing-bsky prototype's nav. The brand
        // lockup is the custom `custom-bpsBrand` item; the right group is the
        // prototype's "nav-mini": [search] · Get Started · GitHub↗ · [theme
        // toggle]. The color-mode toggle auto-renders last on the right.
        items: [
          {
            // "Bluesky Protocol Services" lockup → homepage.
            type: "custom-bpsBrand",
            position: "left",
            to: "/",
          },
          {
            // Mobile-only: renders the docs sections into the hamburger on
            // non-docs routes (the homepage). Null on desktop and on docs
            // routes (where the real sidebar already fills the drawer).
            type: "custom-docsMenu",
            position: "left",
          },
          {
            // Search box (Algolia DocSearch) — placed first on the right so it
            // sits at the left of the nav-mini cluster, where "evt/s" was.
            type: "search",
            position: "right",
          },
          {
            // Vertical divider bracketing the link cluster (prototype's
            // live-pill border-right).
            type: "custom-navSep",
            position: "right",
            variant: "divider",
          },
          {
            // "Get Started" — the prototype's "Docs" link, renamed. Mono
            // masthead style.
            type: "custom-navLink",
            position: "right",
            label: "Get Started",
            to: "/docs/get-started",
          },
          {
            // Middot separator between the two mono links (prototype ".sep").
            type: "custom-navSep",
            position: "right",
            variant: "sep",
          },
          {
            // "GitHub" with an outbound-arrow icon.
            type: "custom-navLink",
            position: "right",
            label: "GitHub",
            href: "https://github.com/bluesky-social",
            external: true,
          },
          {
            // Trailing vertical divider before the auto-appended theme toggle
            // (prototype's version-stamp border-left).
            type: "custom-navSep",
            position: "right",
            variant: "divider",
          },
          {
            // Sits last so it lands beside the auto-appended color-mode toggle.
            // On mobile this same item would also render into the drawer's main
            // menu list; `bpsMainMenuLocale` lets CSS hide that copy there, since
            // the picker is surfaced inside the Documentation group / docs
            // sidebar instead (see DocsMenu + DocSidebar/Mobile swizzles).
            type: "localeDropdown",
            position: "right",
            className: "bpsMainMenuLocale",
          },
        ],
      },
      footer: {
        // Light/dark handled via custom.css footer tokens (was forced "dark").
        style: "light",
        links: [
          {
            title: "Docs",
            items: [
              {
                label: "Get Started",
                to: "/docs/get-started",
              },
              {
                label: "Tutorials",
                href: "https://atproto.com/guides/tutorials",
              },
              {
                label: "AT Protocol",
                href: "https://atproto.com",
              },
            ],
          },
          {
            title: "Community",
            items: [
              {
                label: "Bluesky",
                href: "https://bsky.app/profile/bsky.app",
              },
              {
                label: "Twitter",
                href: "https://twitter.com/bluesky",
              },
              {
                label: "Community-run Discord",
                href: "https://discord.gg/3srmDsHSZJ",
              },
              {
                label: "Mailing List",
                href: "/docs/support/mailing-list",
              },
            ],
          },
          {
            title: "More",
            items: [
              {
                label: "Blog",
                to: "/blog",
              },
              {
                label: "GitHub Discussions",
                href: "https://github.com/bluesky-social/atproto/discussions",
              },
              {
                label: "GitHub",
                href: "https://github.com/bluesky-social",
              },
            ],
          },
        ],
        // Wrapped in a span so custom.css can render it in Atkinson mono.
        copyright: `<span class="bpsFooterCopy">Bluesky Protocol Services · ${new Date().getFullYear()} · operated by Bluesky PBC</span>`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
      algolia: {
        appId: "T5MN80JFZF",
        // Public API key: it is safe to commit it
        apiKey: "fd8d166a53279da4c51abddb2f4a1269",
        indexName: "wwwbsky",
        contextualSearch: false,
      },
    }),
};

module.exports = config;
