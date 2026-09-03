# Bluesky Protocol Services

This repository contains source code for the Bluesky Protocol Services website: <https://bsky.network>

The site documents the public infrastructure Bluesky operates for the AT Protocol — Jetstream, the Relay, and the Bluesky API — as open services anyone can build on, along with guides for the Bluesky app's content types.

Three things that used to live on this site now live elsewhere:

- The **AT Protocol documentation and specifications** are a separate website ([atproto.com](https://atproto.com)) maintained at <https://github.com/bluesky-social/atproto-website>. The developer blog moved there as well, and the tutorials are now [atproto.com/guides/tutorials](https://atproto.com/guides/tutorials).
- The **HTTP/XRPC endpoint reference** is a standalone, OpenAPI-driven site at [endpoints.bsky.app](https://endpoints.bsky.app). It is no longer generated into this build.
- This site replaces **docs.bsky.app**, which now serves a path-preserving redirect here. See [Redirects](#redirects).

## Repository layout

- `docs/` — the documentation content (MDX), routed by `sidebars.js`
- `docs/_snippets/` — shared code samples imported by pages; see [Keep code samples out of the translated MDX](#keep-code-samples-out-of-the-translated-mdx)
- `i18n/<locale>/` — translations, mirroring `docs/`
- `blog/` — the Protocol Services blog, published at `/blog`; see [The blog](#the-blog)
- `src/` — theme customizations, React components, and the landing page
- `lexicons/` — Lexicon schemas for the account server's API, compiled into `src/lexicons/` by `npm run lex:build`
- `server/` — the backend for the authenticated account section of the site (Node + Express + Postgres). It has its own [README](server/README.md) and is deployed separately from the static site.
- `deploy/` — deployment configuration that is not applied by anything in this repo; currently the draft nginx config for the docs.bsky.app redirect
- `scripts/` — build-adjacent tooling: `check-build.mjs` (assertions `make test` runs against `./build`) and `inject-standard-site.mjs` (Standard.site tags, run by the UI image build)

## Building the docs

This website is built using [Docusaurus](https://docusaurus.io/), a static website generator in JavaScript.

To build the site, first you'll need node.js and `npm` installed locally — Node 22 or newer, per `.node-version` (the lexicon codegen used by the build requires it). Install the dependencies and generate the lexicon client code:

    npm install
    npm run lex:build

To run a local development server (which you can browse at <http://localhost:3000>):

    npm start

To include the Spaces alpha account link in the account UI, provide the same
public PDS URL used by the account server when starting or building the UI:

    BPS_SPACES_PDS_URL=https://spaces.example.com npm start

To run a static build (output in `./build/`):

    npm run build

The output can be served using any static contents hosting service.

## The blog

The site publishes a blog at `/blog`, configured in the `blog` block of the
classic preset in `docusaurus.config.js`. Its subject is this site's own
services: capacity and endpoint changes, deprecations and their timelines, new
features in Jetstream and the relay, and postmortems. Protocol-level writing —
lexicon design, specification work — belongs on [the atproto.com
blog](https://atproto.com/blog), which is also where every post published
before this one lives.

That history is why the `/blog` redirect block in `docusaurus.config.js` is
delicate. This site once redirected the whole of `/blog/*` to atproto.com; it
now generates `/blog`, `/blog/page/N`, `/blog/archive` and `/blog/authors`
itself, while the per-post legacy slugs and all of `/blog/tags*` still redirect
away. A legacy redirect that collides with a route we generate would otherwise
be dropped with a warning, so `onDuplicateRoutes` is set to `throw` — the
collision fails the build instead. **When you give a post a slug, make sure it
is not one of the legacy slugs listed in that block.**

The blog publishes [RSS](https://bsky.network/blog/rss.xml),
[Atom](https://bsky.network/blog/atom.xml) and
[JSON](https://bsky.network/blog/feed.json) feeds. Links to them from inside
MDX need a `pathname://` prefix — the feeds are build artifacts rather than
routes, so a plain link trips `onBrokenLinks`.

### Adding a post

Posts are Markdown files in `blog/`, named `YYYY-MM-DD-name.md`. Front matter:

    ---
    slug: welcome
    title: A blog for Bluesky Protocol Services
    date: 2026-09-01
    authors: [bluesky]
    description: Where service changes, deprecations, and operational notes get written down.
    head_meta:
      robots: max-image-preview:large
    ---

| Field | Required | Notes |
| --- | --- | --- |
| `slug` | yes | The URL is `/blog/<slug>`. Must not collide with a legacy slug in the redirect block. |
| `title` | yes | |
| `date` | for Sequoia | Docusaurus reads the date from the filename prefix, but Sequoia does not — see [Publishing to the AT Protocol](#publishing-to-the-at-protocol). Write it out. |
| `authors` | yes | Keys from `blog/authors.yml`. |
| `description` | yes | The blog index entry, the feeds, `og:description`, and the Bluesky post Sequoia can make. Docusaurus falls back to the excerpt when it is missing, so the index is never blank — but write one. |
| `head_meta` | no | Extra `<head>` tags; see below. |
| `atUri` | no | Written by `sequoia publish` — do not edit by hand. See [Publishing to the AT Protocol](#publishing-to-the-at-protocol). |

Three front-matter mistakes fail the build rather than degrading quietly, all
set in `docusaurus.config.js`:

- **An author not in `blog/authors.yml`** (`onInlineAuthors: 'throw'`). A typo
  is how a nameless author with no page becomes live. Add people to
  `authors.yml` first.
- **A tag declared inline** (`onInlineTags: 'throw'`). Posts carry no tags at
  present; a one-post tag page is almost always a typo.
- **A post with no truncate marker** (`onUntruncatedBlogPosts: 'throw'`). The
  index shows the `description` rather than the excerpt, so a missing marker no
  longer dumps the body onto it — but the marker still bounds the excerpt that
  `description` falls back to when a post declares none.

A post page shows the title, the date, and a byline: the author's name linked
to their profile, with their `title` from `authors.yml` beneath it. All three
come from `src/theme/BlogPostItem/Header`, which is ejected rather than wrapped
because it drops the theme's own avatar byline and renames the parts it keeps.
The byline itself is `src/components/BlogByline` — not a theme component, since
it shadows nothing.

There is no reading time, no tags and no "Edit this page" link. Reading time is
off at the source (`showReadingTime: false`), so the date stands alone rather
than being hidden in CSS; the other two are absent because the blog sets no
`editUrl` and posts carry no tags, which leaves `BlogPostItem/Footer` rendering
nothing at all.

**The blog index shows each post's `description`, not the excerpt.** The theme
renders the same truncated MDX in both places, which makes an index entry a
fragment that starts mid-argument and stops mid-sentence; the description is
written to be read on its own, and already feeds the RSS/Atom/JSON feeds and
`og:description`. `src/theme/BlogPostItem/Content` wraps the theme component to
make the swap — the post page delegates to the original untouched, so the
`blogPostContainerID` the feed generator looks for is preserved. The byline is
post-pages-only, so index entries stay title, date and description.

Descriptions run at whatever length the front matter gives them; nothing clamps
them to a fixed number of lines.

#### `head_meta`

Docusaurus already emits title, description, keywords, `og:image`, `og:type`,
`article:published_time`, `article:author` and `article:tag` from front matter.
The `head_meta` map adds tags it has no opinion about, rendered by the
`src/theme/BlogPostPage/Metadata` wrapper. Keys beginning `og:`, `article:`,
`fb:` or `profile:` are emitted as `property=`; everything else as `name=`.
Values must be strings — quote anything YAML would read as a number or boolean
— and a malformed map throws during SSR, naming the post, rather than
rendering a partial head.

#### Checking your work

    make build
    make test

`scripts/check-build.mjs` reads `./build` and asserts what the MDX checker
cannot see: that the index and archive render as real pages rather than
redirect stubs, that all three feeds exist and the index advertises the RSS
one, that every `head_meta` key in every post reaches that post's document
head, and that the post chrome is still title-and-date-only. It also checks
that `/ja/blog` falls back to the English posts — the `ja` locale has no
translated posts, and the blog plugin globs the default-locale content when a
locale has none.

### Publishing to the AT Protocol

The blog is also published to the ATmosphere as
[Standard.site](https://standard.site) records, using
[Sequoia](https://sequoia.pub). Sequoia turns each Markdown post into a
`site.standard.document` record on a PDS, grouped under one
`site.standard.publication` record, so that AT Protocol aggregators can index
the blog as first-class content rather than by scraping HTML.

| | |
| --- | --- |
| Publishing account | `bsky-network.bsky.social` (`did:plc:vjmzeyaqcg4aav2txasemfgj`) |
| PDS | `https://brittlegill.us-west.host.bsky.network` |
| Publication record | `at://did:plc:vjmzeyaqcg4aav2txasemfgj/site.standard.publication/3muhzfi5rsp2p` |

Sequoia is a `devDependency` (`sequoia-cli`), so run it through `npx` rather
than installing it globally as its own docs suggest:

    npx sequoia --help

The one-time setup below is **already done** — the publication record exists,
`sequoia.json` and `.sequoia-state.json` are committed, and the `.well-known`
files are in `static/`. It is written down because the settings are not
obvious, and because a future migration to another account would repeat it.

#### Configuration

`sequoia init` writes `sequoia.json` from an interactive questionnaire. Four of
its settings carry real consequences, and the defaults are wrong for a
Docusaurus blog:

    {
      "siteUrl": "https://bsky.network/blog",
      "pathPrefix": "",
      "publicDir": "./static",
      "stripDatePrefix": true,
      "frontmatter": {
        "publishDate": "date",
        "slugField": "slug",
        "coverImage": "image"
      }
    }

**`siteUrl` is the blog, not the site.** It becomes the publication record's
`url`, and the publication here is the blog rather than all of bsky.network.
With `siteUrl` carrying the `/blog` path, `pathPrefix` must be empty or the
prefix appears twice in every document URL.

**`frontmatter.slugField` must be `slug`.** Without it, Sequoia derives the
slug from the filename, so `2026-08-30-welcome.md` yields the path
`/2026-08-30-welcome` while Docusaurus serves the post at `/blog/welcome` from
its `slug:` front matter. The record then points at a URL that does not exist,
and document verification cannot succeed. (This is not hypothetical — the
first publish did exactly that, and the record had to be corrected.)
`stripDatePrefix` is the backstop for a post that omits `slug:`.

**`frontmatter.coverImage` must be `image`.** Sequoia looks for `ogImage` by
default; Docusaurus names the field `image`.

**`publicDir` must be `./static`, not `./build`.** This is where the
publication verification file is written, and `/build` is gitignored — a copy
placed there is absent from every fresh clone and every CI build. Under
`static/` it is version-controlled, and Docusaurus copies it into the build
because copy-webpack-plugin globs static directories with `dot: true`.

`publishContent` is `false`, so records carry title, description, dates and a
canonical URL, but not the post body. Readers follow the link to the site.

#### Publication verification

A `site.standard.publication` record is verified by serving its AT URI from a
`.well-known` endpoint on the domain it claims. This blog is a **non-root**
publication (`https://bsky.network/blog`), and the
[spec](https://standard.site/docs/verification) says a non-root publication
appends its path to the endpoint. Sequoia instead writes the file under the
publication's own path. The two disagree, so the repo serves both:

| Path | Origin |
| --- | --- |
| `/.well-known/site.standard.publication/blog` | what the Standard.site spec prescribes for a non-root publication |
| `/blog/.well-known/site.standard.publication` | where Sequoia writes it |

Both hold the same AT URI, both live under `static/`, and nginx serves them
because `deploy/nginx.conf` has no rule denying dotfiles. Serving the pair
costs two small files and avoids betting on which one an indexer reads.
**Confirm against [site-validator.fly.dev](https://site-validator.fly.dev/)
after the next deploy, and delete whichever is dead weight.**

#### Per-release workflow

The two halves run in different places. **You publish; CI injects.**

Publishing writes to a PDS and needs credentials, so it stays a deliberate
local step:

    npx sequoia login                # once per machine; OAuth in the browser
    npx sequoia publish --dry-run    # what would be created or updated
    npx sequoia publish              # write the records
    # commit the changes publish made, then push

`publish` hashes each post's content, creates records for new posts, updates
records for changed ones, writes `.sequoia-state.json`, and adds an `atUri`
field to each post's front matter. Posts with `draft: true` are skipped.

Change detection is by content hash, so a change that leaves the body alone —
editing `sequoia.json`, renaming a file — will not trigger an update on its
own. Use `npx sequoia publish --force` to rewrite every record.

Commit `sequoia.json`, `.sequoia-state.json`, the `.well-known` files under
`static/`, and the `atUri` front matter that `publish` writes.

**`.sequoia-state.json` must stay tracked.** It is the slug → AT-URI ledger,
and it is the *only* place `inject` reads that map from — it does not look at
the `atUri` front matter. It is also how a later publish updates a record
instead of creating a second one.

Injection then happens inside the image build, because that is where the
deployed HTML is actually produced — see [Container
images](#container-images). A local `npx sequoia inject` writes into a `./build`
that never reaches production, which is a confusing way to spend an afternoon.

`inject` adds `<link rel="site.standard.document" href="at://...">` to the
`<head>` of each built post page. That link is what verifies a document: an
aggregator follows the record's canonical URL, finds the tag pointing back at
the record, and trusts the pair.

To see locally what will ship:

    make build
    make inject

`make build` overwrites `./build` and drops the tags, so that order matters and
the tags do not survive the next build. It is for inspection, not for deploying.

#### Automating it

For CI, authenticate with an app password through the environment rather than
OAuth:

| Variable | Value |
| --- | --- |
| `ATP_IDENTIFIER` | `bsky-network.bsky.social` |
| `ATP_APP_PASSWORD` | app password for that account — a secret |

Sequoia's `autoSync` (on by default) makes this safe from a fresh clone: with
no `.sequoia-state.json`, it pulls the existing documents from the PDS and
matches them to local files by URL path before publishing, instead of creating
duplicate records.

#### Known rough edges

- **Docusaurus is not on Sequoia's [supported frameworks
  list](https://sequoia.pub/supported-frameworks).** The pairing works, but it
  is untested upstream, which is why the slug and `publicDir` settings above
  had to be worked out by hand.
- **`date` in front matter is not optional.** Sequoia looks for `publishDate`,
  `pubDate`, `date`, `createdAt` or `created_at`, and has no fallback to the
  filename's date prefix — which is where Docusaurus gets it from. A post
  without an explicit `date:` publishes with the wrong date or none at all.
- **The `ja` locale duplicates every post** at `/ja/blog/<slug>`, and `inject`
  tags them: it matches `<dir>/index.html` by the name of the parent directory,
  so the Japanese copy resolves to the same slug and gets the same `atUri`.
  Two URLs would then assert they are the same document while the record's
  `canonicalUrl` names only one. `scripts/inject-standard-site.mjs` strips the
  tags back out of every non-default locale.
- **An alternative to `inject`** would be to extend the
  `src/theme/BlogPostPage/Metadata` wrapper, which today emits `<meta>` tags
  from `head_meta` only, to also emit a `<link rel="site.standard.document">`
  from the `atUri` front matter that `publish` writes. That keeps verification
  inside the build rather than in a post-build step, at the cost of a slightly
  larger swizzle.

## Container images

Two images are built for production deployment, both from the **repo root** as
build context (each needs the top-level `lexicons/`):

| Image | Dockerfile | Contents |
| --- | --- | --- |
| `bps-website-ui` | `Dockerfile` | the static site, served by nginx (`deploy/nginx.conf`) on port 80 |
| `bps-website-api` | `server/Dockerfile` | the account server on port 8080 — see [server/README.md](server/README.md) |

The UI image runs `npm run inject` after the site build. This is the deployed
HTML, so it is the only place the Standard.site verification tags can usefully
be added — see [Publishing to the AT
Protocol](#publishing-to-the-at-protocol). The step is offline: it reads the
committed `.sequoia-state.json` and rewrites files. It does not talk to a PDS,
and it needs no credentials.

`scripts/inject-standard-site.mjs` wraps the Sequoia CLI rather than calling it
directly, for two reasons. It scopes the tags to the default locale, reading the
locale list from `docusaurus.config.js` so a new locale cannot be missed. And it
turns two silent successes into build failures: `sequoia inject` exits 0 when
`.sequoia-state.json` is absent, and again when every post is skipped, either of
which would ship an unverifiable site behind a green build.

`.github/workflows/containers.yml` builds both on GitHub-hosted runners for
every branch push. Only `main` receives `packages: write` and publishes the
public images to GHCR, tagged with the full commit SHA:

- `ghcr.io/bluesky-social/bps-website-ui:<commit-sha>`
- `ghcr.io/bluesky-social/bps-website-api:<commit-sha>`

BuildKit layers use the GitHub Actions cache. The workflow verifies after each
publish that the exact SHA-tagged image can be resolved without registry
credentials.

The UI image is **environment-specific**: `BPS_PUBLIC_API_ORIGIN` and
`BPS_SPACES_PDS_URL` are read by `docusaurus.config.js` and baked into
the JavaScript bundle, so they are build arguments with no runtime override.
The container build fails if either is missing. In CI they come from repository
variables with the same names. (`ENDPOINTS_URL` is also passed as a build
argument, but is inert today — nothing reads `customFields.endpointsUrl` and the
homepage hardcodes the endpoints link.)

That build argument now has a second consumer with a stricter contract: the site
publishes the account login's OAuth client metadata document at
`/oauth-client-metadata.json`, and its `redirect_uris`/`jwks_uri` are built from
`BPS_PUBLIC_API_ORIGIN`. It must name the same origin the account server itself
runs on (`BPS_API_ORIGIN`), or login fails — see
[server/README.md](server/README.md#the-client_id-document-lives-on-the-website-not-here).

    docker build -t bps-website-ui \
      --build-arg BPS_PUBLIC_API_ORIGIN=https://api.example.com \
      --build-arg BPS_SPACES_PDS_URL=https://spaces.example.com .
    docker run --rm -p 8080:80 bps-website-ui

Both images answer `GET /_health` for container probes.

## Redirects

Inbound links are preserved in two layers, and both are needed:

1. **`deploy/docs.bsky.app.conf`** — a draft nginx config for docs.bsky.app that 301s every path to this host, plus a rule sending the retired `/docs/api/*` endpoint reference to endpoints.bsky.app. The wildcard **must preserve the request path**: the redirects in layer 2 are served by *this* site, so they can only fire if the legacy pathname actually arrives here.
2. **The `redirects` block in `docusaurus.config.js`** — per-page moves, covering both the legacy docs.bsky.app URL set (sourced from that site's last sitemap) and renames internal to this site. These are client-side redirects, so each one is a small generated HTML page; anything that needs a real server 301, or a whole URL prefix, belongs in layer 1 instead.

When you rename or remove a page, add an entry to layer 2. Note that `url` in `docusaurus.config.js` feeds the sitemap and social-card URLs, so it must name the host the site is actually served from.

## Translations

The site is published in English with translation contributions accepted for additional locales (currently: Japanese, `ja`). Translations live under `i18n/<locale>/`, mirroring the structure of `docs/`. To translate a page, copy it from `docs/foo.mdx` to `i18n/<locale>/docusaurus-plugin-content-docs/current/foo.mdx` and translate the prose. Sidebar category labels and other theme strings live in `i18n/<locale>/*.json` — regenerate the scaffold with `npm run write-translations -- --locale <locale>` and translate the `message` fields.

To preview a locale during development:

    npm run start:ja

The Docusaurus dev server **only runs one locale at a time** — `npm start` builds the default locale (English) and treats `/ja/...` URLs as missing, so switching locales from the dropdown in dev will land on a 404 (and the dropdown on that 404 page can construct a doubled-prefix URL like `/ja/ja/docs/...`). This is a dev-only artifact; the production build (`npm run build`) generates routes for every locale with fallback content, so the locale dropdown works correctly on the deployed site. To exercise the full multi-locale experience locally, use `npm run build && npm run serve`.

### Keep code samples out of the translated MDX

Docusaurus translates an MDX page by duplicating the whole file, *including code blocks*. That makes code samples drift the moment one locale gets a fix the others don't. To avoid this, extract every code sample into a partial under `docs/_snippets/` (the leading underscore tells Docusaurus not to route it as a page) and import it from the locale MDX files. The partial is the single source of truth; both English and translated pages render the same code.

For example, in `docs/foo.mdx`:

    import RequestSnippet from './_snippets/foo-request.mdx';

    Here's the request shape:

    <RequestSnippet />

And in `docs/_snippets/foo-request.mdx`:

    ```typescript
    await client.post(...)
    ```

The translated `i18n/<locale>/docusaurus-plugin-content-docs/current/foo.mdx` uses the *same* import (`./_snippets/foo-request.mdx` resolves to the canonical file under `docs/`), so updating the snippet updates every locale at once.

See `docs/jetstream-coop.mdx` and `docs/_snippets/jetstream-coop-document-record.mdx` for a worked example.

## Docs License

Documentation text is under Creative Commons Attribution (CC-BY).

Inline code examples, example data, and regular expressions are under Creative Commons Zero (CC-0, aka Public Domain) and copy/pasted without attribution.

Please see [LICENSE.txt](LICENSE.txt) with reminders about derivative works, and [LICENSE-CC-BY.txt](LICENSE-CC-BY.txt) for a copy of license legal text.
