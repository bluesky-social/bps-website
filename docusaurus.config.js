// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const fs = require("node:fs/promises");
const path = require("node:path");

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
      "data-color-scheme-selector": "[data-theme='dark']",
      "data-modal-ask-ai-input-placeholder":
        "Find solutions from the docs, Github, forums, and more...",
      async: true,
    },
  ],
  title: "Bluesky Protocol Services",
  tagline: "High scale open social, unlocked for every builder.",
  favicon: "img/favicon.png",

  // Set the production url of your site here. This site replaces docs.bsky.app,
  // which now serves a path-preserving 301 wildcard here (see
  // deploy/docs.bsky.app.conf) — so canonicals and the sitemap must advertise
  // bsky.network, not the retired host.
  url: "https://bsky.network/",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "bluesky-social", // Usually your GitHub org/user name.
  projectName: "bsky-docs", // Usually your repo name.

  onBrokenLinks: "throw",
  onBrokenAnchors: "ignore",
  // A legacy /blog redirect that collides with a route we now generate is
  // dropped by the redirects plugin with a log line at this level. Warnings
  // scroll past in CI, and the failure mode is a URL quietly changing meaning,
  // so it fails the build instead. See the /blog redirect block below.
  onDuplicateRoutes: "throw",

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

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
    {
      tagName: 'meta',
      attributes: {
        name: 'algolia-site-verification',
        content: 'BE3503F41D92DB4B',
      },
    },
  ],
  plugins: [
    "@docusaurus/plugin-ideal-image",
    // Silence webpack's "Can't resolve 'bufferutil' / 'utf-8-validate'"
    // warnings. Those come from `ws`, which reaches the SSR bundle through
    // @bsky/jetstream's Node websocket transport (the browser bundle resolves
    // the transport's `#transport` import to its native-WebSocket branch and
    // never pulls `ws` in at all). Both packages are optional native
    // accelerators that `ws` probes for inside a try/catch and does without;
    // unresolved, they are noise rather than a problem. Left unfiltered they
    // add four meaningless warnings per locale to every build, which is how
    // real warnings end up getting ignored.
    () => ({
      name: "ignore-ws-optional-native-deps",
      configureWebpack: () => ({
        ignoreWarnings: [
          (warning) =>
            /Can't resolve '(bufferutil|utf-8-validate)'/.test(
              warning.message ?? "",
            ),
        ],
      }),
    }),
    [
      // Two kinds of redirect live here:
      //
      //  1. The docs.bsky.app migration set. This site replaces docs.bsky.app,
      //     which now serves a path-preserving 301 wildcard to this host — so
      //     every legacy docs.bsky.app pathname arrives here verbatim and needs
      //     a landing spot. Sourced from the last docs.bsky.app sitemap; keep it
      //     in sync if that inventory changes.
      //  2. Internal renames within this site (get-started → bluesky-api,
      //     jetstream-backfill → jetstream-replay, /how-it-works → /docs/...),
      //     which never had docs.bsky.app URLs but do have live inbound links.
      //
      // These are client-side redirects (a meta-refresh HTML page per `from`),
      // so a legacy deep link costs one 301 plus one in-page hop. Anything that
      // needs a real server 301 — or a whole prefix, like the 200+ /docs/api/*
      // endpoint pages — belongs in the docs.bsky.app nginx config instead.
      "@docusaurus/plugin-client-redirects",
      {
        redirects: [
          // ---- 1. Legacy docs.bsky.app: /docs/tutorials/* ----
          // The tutorials became the Bluesky API section.
          ...[
            "creating-a-post",
            "viewing-feeds",
            "viewing-threads",
            "like-repost",
            "following",
            "user-lists",
            "custom-feeds",
          ].map((page) => ({
            from: `/docs/tutorials/${page}`,
            to: `/docs/bluesky-api/${page}`,
          })),
          // Viewing and editing profiles were merged into one Profiles page.
          ...["editing-profiles", "viewing-profiles"].map((page) => ({
            from: `/docs/tutorials/${page}`,
            to: "/docs/bluesky-api/profiles",
          })),
          // Separate muting/blocking tutorials were folded into "Following,
          // muting, and blocking".
          ...["/docs/tutorials/muting", "/docs/tutorials/blocking"].map((from) => ({
            from,
            to: "/docs/bluesky-api/following",
          })),
          { from: "/docs/tutorials/thread-gates", to: "/docs/about-bluesky-content/thread-gates" },
          { from: "/docs/tutorials/video", to: "/docs/about-bluesky-content/video" },

          // ---- 1. Legacy docs.bsky.app: /docs/advanced-guides/* ----
          // Guides that kept their content and moved to the site root.
          ...[
            "api-directory",
            "entryway",
            "intent-links",
            "oauth-client",
            "oembed",
            "rate-limits",
            "resolving-identities",
          ].map((page) => ({ from: `/docs/advanced-guides/${page}`, to: `/docs/${page}` })),
          // Guides that moved under About Bluesky Content.
          ...["post-richtext", "posts", "timestamps"].map((page) => ({
            from: `/docs/advanced-guides/${page}`,
            to: `/docs/about-bluesky-content/${page}`,
          })),
          { from: "/docs/advanced-guides/firehose", to: "/docs/consuming-the-firehose" },
          // "Backfilling the Network" (syncing the network from scratch) is now
          // covered by Jetstream replay.
          { from: "/docs/advanced-guides/backfill", to: "/docs/jetstream-replay" },
          // The AT Protocol / Federation Architecture explainers are now the
          // How It Works narrative.
          ...["atproto", "federation-architecture"].map((page) => ({
            from: `/docs/advanced-guides/${page}`,
            to: "/docs/how-it-works",
          })),
          // Read-After-Write and Service Auth were both about PDS-mediated
          // request routing, which Request proxying now covers.
          ...["read-after-write", "service-auth"].map((page) => ({
            from: `/docs/advanced-guides/${page}`,
            to: "/docs/bluesky-api/request-proxying",
          })),

          // ---- 1. Legacy docs.bsky.app: pages with no successor here ----
          // These topics are atproto.com's, not this site's.
          { from: "/docs/advanced-guides/custom-schemas", to: "https://atproto.com/guides/lexicon" },
          { from: "/docs/advanced-guides/moderation", to: "https://atproto.com/guides/moderation" },
          // The starter templates are superseded by atproto.com's tutorials —
          // the same destination the sidebar's "Tutorials" link points at.
          ...[
            "/docs/starter-templates/bots",
            "/docs/starter-templates/clients",
            "/docs/starter-templates/custom-feeds",
            "/docs/category/starter-templates",
          ].map((from) => ({ from, to: "https://atproto.com/guides/tutorials" })),
          // The developer mailing list is gone; no equivalent to land on.
          { from: "/docs/support/mailing-list", to: "https://atproto.com/" },
          // /showcase listed community apps; App integrations is its closest heir.
          { from: "/showcase", to: "/docs/about-bluesky-content/app-integrations" },

          // ---- 1. Legacy docs.bsky.app: /docs/support/*, category pages ----
          { from: "/docs/support/developer-guidelines", to: "/docs/developer-guidelines" },
          { from: "/docs/get-started", to: "/docs/bluesky-api" },
          { from: "/docs/category/tutorials", to: "/docs/bluesky-api" },
          { from: "/docs/category/advanced-guides", to: "/docs/protocol-services" },
          { from: "/docs/category/support", to: "/docs/developer-guidelines" },
          // The generated HTTP reference now lives on its own OpenAPI-driven
          // site. Only the category landing is handled here; the per-operation
          // /docs/api/* pages are a prefix rule in nginx.
          { from: "/docs/category/http-reference", to: "https://endpoints.bsky.app" },

          // ---- 1. Legacy docs.bsky.app: /blog/* ----
          // The blog moved to atproto.com. Slugs verified against
          // ../atproto-website/src/app/[locale]/blog (atproto.com serves posts
          // unprefixed at /blog/<slug>).
          ...[
            "2024-protocol-roadmap",
            "2025-protocol-roadmap-spring",
            "atproto-grants",
            "atproto-grants-recipients",
            "bgs-and-did-doc",
            "block-implementation",
            "building-on-atproto",
            "call-for-developers",
            "create-post",
            "federation-sandbox",
            "introducing-tap",
            "jetstream",
            "label-grants",
            "looking-back-2024",
            "oauth-atproto",
            "oauth-improvements",
            "pinned-posts",
            "plc-directory-org",
            "protocol-roadmap",
            "relay-ops",
            "relay-rollout",
            "repo-export",
            "repo-sync-update",
            "self-host-federation",
          ].map((slug) => ({ from: `/blog/${slug}`, to: `https://atproto.com/blog/${slug}` })),
          // Same posts, renamed slugs (titles confirmed identical).
          ...Object.entries({
            "account-management": "network-account-management",
            "protocol-checkin-fall-2025": "protocol-check-in-fall-2025",
            "relay-sync-updates": "relay-updates-sync-v1-1",
            "taking-at-to-ietf": "taking-at-to-the-ietf",
          }).map(([oldSlug, newSlug]) => ({
            from: `/blog/${oldSlug}`,
            to: `https://atproto.com/blog/${newSlug}`,
          })),
          // Posts that did not make the move, plus the leftover tag pages: land
          // on the blog index.
          //
          // The aggregate paths that used to be listed here — /blog,
          // /blog/page/N, /blog/archive and /blog/authors — are gone: this site
          // publishes a blog at /blog again and generates each of them itself.
          //
          // What remains is the namespace we do NOT generate today: the tag
          // pages. Posts carry no tags at present, so /blog/tags and all twelve
          // legacy per-tag paths still belong to the old blog.
          //
          // A redirect and a real route cannot both own a path, and the
          // redirects plugin resolves that by silently dropping its own entry —
          // so `onDuplicateRoutes: 'throw'` above turns the overlap into a
          // build failure instead. Tagging a post again will therefore fail the
          // build until the lines it collides with are deleted here, starting
          // with /blog/tags.
          ...[
            "/blog/tags",
            "/blog/api-v0-14-0-release-notes",
            "/blog/blueskys-moderation-architecture",
            "/blog/contact-import-rfc",
            "/blog/feature-bridgyfed",
            "/blog/feature-skyfeed",
            "/blog/incoming-migration",
            "/blog/rate-limits-pds-v3",
            "/blog/skygaze-hackathon",
            "/blog/ts-api-refactor",
            ...[
              "community",
              "feature",
              "federation",
              "firehose",
              "guide",
              "ietf",
              "interop",
              "lexicon",
              "oauth",
              "pds",
              "plc",
              "updates",
            ].map((tag) => `/blog/tags/${tag}`),
          ].map((from) => ({ from, to: "https://atproto.com/blog" })),

          // ---- 2. Internal renames within this site ----
          ...[
            "creating-a-post",
            "viewing-feeds",
            "viewing-threads",
            "like-repost",
            "profiles",
            "following",
            "user-lists",
            "custom-feeds",
          ].map((page) => ({
            from: `/docs/get-started/${page}`,
            to: `/docs/bluesky-api/${page}`,
          })),
          ...["/docs/get-started/muting-and-blocking", "/docs/bluesky-api/muting-and-blocking"].map(
            (from) => ({ from, to: "/docs/bluesky-api/following" }),
          ),
          { from: "/docs/jetstream-backfill", to: "/docs/jetstream-replay" },
          // How It Works started life as a standalone page at /how-it-works
          // before moving into the docs plugin (to get the sidebar).
          { from: "/how-it-works", to: "/docs/how-it-works" },
        ],
      },
    ],
    // Publishes the site's OAuth client metadata document. This site hosts the
    // document because an atproto `client_id` IS the URL the document is served
    // from — so hosting it here is what puts the account login's client_id on
    // this domain, which is the hostname users see on the consent screen. The
    // endpoints it advertises (redirect_uri, jwks_uri) belong to the account API
    // service and stay on its origin; the shape comes from the API's own
    // builder so the two copies cannot drift.
    //
    // A generated file rather than one in static/ because it needs the API
    // origin, which is per-environment. postBuild only runs on `docusaurus
    // build`, never `start` — fine, because local dev uses the atproto loopback
    // client, which has no hosted document at all.
    () => ({
      name: "oauth-client-metadata",
      async postBuild({ outDir, siteConfig, i18n }) {
        // Localized builds write into build/<locale>; one document, at the root.
        if (i18n.currentLocale !== i18n.defaultLocale) return;
        const { buildClientMetadataDoc } = await import(
          "./server/src/oauth/client-metadata-doc.mjs"
        );
        const doc = buildClientMetadataDoc({
          siteOrigin: siteConfig.url,
          apiOrigin: siteConfig.customFields.apiOrigin,
        });
        await fs.writeFile(
          path.join(outDir, "oauth-client-metadata.json"),
          `${JSON.stringify(doc, null, 2)}\n`,
        );
      },
    }),
  ],

  // The HTTP/XRPC endpoint reference is no longer generated into this site. It
  // now lives as a standalone, OpenAPI-driven static site (see ../endpoints).
  // `endpointsUrl` is that site's deployed base URL; set via the ENDPOINTS_URL
  // env var once a host/domain is chosen (intentionally not hardcoded). When
  // unset, the homepage "API Reference" card is hidden.
  customFields: {
    endpointsUrl: process.env.ENDPOINTS_URL || null,
    apiOrigin: process.env.BPS_PUBLIC_API_ORIGIN || 'http://127.0.0.1:8080',
    spacesPdsUrl:
      process.env.BPS_SPACES_PDS_URL?.replace(/\/+$/, '') || null,
  },
  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          // Remove this to remove the "edit this page" links.
          editUrl: "https://github.com/bluesky-social/bps-website/tree/main/",
        },
        // The blog covers this site's own services. Protocol-level writing —
        // lexicon design, specification work — stays on atproto.com, which is
        // also where every post published before this one lives; the /blog
        // redirect block above keeps those old permalinks pointing there.
        blog: {
          blogTitle: "Protocol Services blog",
          blogDescription:
            "Service changes, deprecations, and operational notes for Bluesky Protocol Services.",
          blogSidebarTitle: "Recent posts",
          blogSidebarCount: 10,
          postsPerPage: 10,
          showReadingTime: true,
          // No editUrl: the blog carries no "Edit this page" link. Combined
          // with posts having no tags, BlogPostItem/Footer then renders nothing
          // at all on a post page — which is why hiding those two needs no
          // swizzle of its own.
          //
          // Posts currently carry no tags, and the byline is hidden in
          // src/theme/BlogPostItem/Header — but authors are still declared in
          // blog/authors.yml, because the feeds and article:author metadata
          // come from there. Inline values remain an error: a typo is how a
          // nameless author or a one-post tag becomes a live page. Untruncated
          // posts get the same treatment — without a truncate marker a post
          // dumps its full body onto the index.
          onInlineAuthors: "throw",
          onInlineTags: "throw",
          onUntruncatedBlogPosts: "throw",
          feedOptions: {
            type: "all",
            xslt: true,
            title: "Bluesky Protocol Services",
            description:
              "Service changes, deprecations, and operational notes for Bluesky Protocol Services.",
            copyright: `Copyright © ${new Date().getFullYear()} Bluesky PBC`,
          },
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
        // prototype's "nav-mini": [search] · Learn · GitHub↗ · [theme
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
            // "AI" — opens the Kapa AI widget (whose own floating launcher is
            // suppressed via data-button-hide above). Immediately right of the
            // search box, so the two read as one search cluster; collapses to a
            // circular icon button beside the search magnifying glass on mobile.
            type: "custom-askAi",
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
            // "Get Started" → the Protocol Services docs landing page.
            type: "custom-navLink",
            position: "right",
            label: "Get Started",
            to: "/docs/protocol-services",
          },
          {
            // Middot separator between the masthead links.
            type: "custom-navSep",
            position: "right",
            variant: "sep",
          },
          {
            // "Blog" → this site's own blog. The only masthead link with an
            // `icon`: it keeps its place in the bar at mobile widths as a news
            // glyph rather than collapsing into the hamburger drawer with Get
            // Started and Atproto (see NavCustomLink).
            type: "custom-navLink",
            position: "right",
            label: "Blog",
            to: "/blog",
            icon: "news",
          },
          {
            type: "custom-navSep",
            position: "right",
            variant: "sep",
          },
          {
            // "Atproto" → the broader protocol site, outbound. Shortened from
            // "AT Protocol" to buy back the width the Blog link costs.
            type: "custom-navLink",
            position: "right",
            label: "Atproto",
            href: "https://atproto.com",
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
          {
            // Account item — resolving / anon / authed states from useAuth().
            // Sits at the very end of the nav, after the locale dropdown and
            // just before the auto-appended color-mode toggle.
            type: "custom-bpsAccount",
            position: "right",
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
                label: "Bluesky API",
                to: "/docs/bluesky-api",
              },
              {
                label: "Jetstream",
                to: "/docs/jetstream",
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
                label: "Community-run Discord",
                href: "https://discord.gg/3srmDsHSZJ",
              },
            ],
          },
          {
            title: "More",
            items: [
              {
                label: "GitHub Discussions",
                href: "https://github.com/bluesky-social/atproto/discussions",
              },
              {
                label: "GitHub",
                href: "https://github.com/bluesky-social",
              },
              {
                label: "Blog",
                to: "/blog",
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
        // `json` is not in prism-react-renderer v2's default bundle (unlike go,
        // python, ts, sql), so ```json blocks rendered as plain text until it
        // was added here.
        additionalLanguages: ["json"],
      },
      algolia: {
        appId: "12GKLSO42L",
        // Public API key: it is safe to commit it
        apiKey: "e70e22d5a7beebb61ef63f1a5ea0e425",
        indexName: "BPS Docs",
        contextualSearch: false,
      },
    }),
};

module.exports = config;
