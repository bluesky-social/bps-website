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
    title: A blog for Protocol Services
    date: 2026-08-30
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
| `description` | yes | Feeds, `og:description`, and the Bluesky post Sequoia can make. |
| `head_meta` | no | Extra `<head>` tags; see below. |

Three front-matter mistakes fail the build rather than degrading quietly, all
set in `docusaurus.config.js`:

- **An author not in `blog/authors.yml`** (`onInlineAuthors: 'throw'`). A typo
  is how a nameless author with no page becomes live. Add people to
  `authors.yml` first.
- **A tag declared inline** (`onInlineTags: 'throw'`). Posts carry no tags at
  present; a one-post tag page is almost always a typo.
- **A post with no truncate marker** (`onUntruncatedBlogPosts: 'throw'`).
  Without `{/* truncate */}` a post dumps its whole body onto the index.

Post pages show the title and the date/reading-time only. There is no byline,
no tags and no "Edit this page" link — the byline is hidden in
`src/theme/BlogPostItem/Header`, and the other two are absent because the blog
sets no `editUrl` and posts carry no tags, which leaves `BlogPostItem/Footer`
rendering nothing at all.

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

The publishing account is **`bsky-network.bsky.social`**
(`did:plc:vjmzeyaqcg4aav2txasemfgj`).

Sequoia is a `devDependency` (`sequoia-cli`), so run it through `npx` rather
than installing it globally as its own docs suggest:

    npx sequoia --help

> **Not set up yet.** As of this writing the account holds no
> `site.standard.publication` record and the repo has no `sequoia.json`, so the
> one-time setup below has not been run. Everything after it describes the
> intended workflow, not a workflow this repo has exercised.

#### One-time setup

Authenticate, then initialize. OAuth is preferred; `npx sequoia auth` takes an
app password instead, which is what CI needs.

    npx sequoia login
    npx sequoia init

`init` asks a series of questions. The answers for this repo:

| Prompt | Answer |
| --- | --- |
| Site URL | `https://bsky.network` |
| Content directory | `./blog` |
| Cover images directory | `./static/img` |
| Public/static directory | `./static` |
| Build output directory | `./build` |
| URL path prefix for posts | `/blog` |

It then asks for front-matter field mappings, and finally whether to create a
publication. Creating one writes a `site.standard.publication` record to the
account's PDS, a `sequoia.json` in the repo root, and the publication's AT URI
to `static/.well-known/site.standard.publication`.

Two settings need to be right in `sequoia.json` afterwards, because the
defaults do not match Docusaurus's file layout:

    {
      "stripDatePrefix": true,
      "frontmatter": {
        "slugField": "slug",
        "coverImage": "image"
      }
    }

`slugField` makes Sequoia take the slug from front matter, matching the URL
Docusaurus actually serves. `stripDatePrefix` is the fallback for a post with
no `slug` in its front matter: without it, `2026-08-30-welcome.md` becomes the
slug `2026-08-30-welcome` and the record points at a URL that does not exist.
`coverImage` maps to Docusaurus's `image` front-matter field, which Sequoia
otherwise looks for under the name `ogImage`.

Commit `sequoia.json`, `static/.well-known/site.standard.publication` and
`.sequoia-state.json`. The state file holds the AT URI and a content hash for
each post, which is how a later `publish` knows to update a record rather than
create a second one.

#### Per-release workflow

Order matters. Publishing first is what gives the build something to inject.

    npx sequoia publish --dry-run    # what would be created or updated
    npx sequoia publish              # write the records
    npm run build                    # build the site
    npx sequoia inject               # add <link> tags to ./build
    # deploy ./build as usual

`publish` hashes each post's content, creates records for new posts, updates
records for changed ones, writes `.sequoia-state.json`, and adds an `atUri`
field to each post's front matter. Posts with `draft: true` are skipped.

`inject` adds `<link rel="site.standard.document" href="at://...">` to the
`<head>` of each built post page. This is what makes a document *verified*:
an aggregator follows the record's URL, finds the link tag pointing back at
the record, and trusts the pair. The publication half of verification is the
`.well-known` file, which reaches `build/.well-known/` because Docusaurus
copies static directories with dotfiles included, and which nginx serves
because `deploy/nginx.conf` has no rule denying dotfiles.

Verify a deployed post at
[site-validator.fly.dev](https://site-validator.fly.dev/), which checks both
the record schema and the Standard.site verification requirements.

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
  list](https://sequoia.pub/supported-frameworks).** Nothing here is known to
  break, but this pairing is untested upstream.
- **`date` in front matter is not optional.** Sequoia looks for `publishDate`,
  `pubDate`, `date`, `createdAt` or `created_at` and has no fallback to the
  filename's date prefix, which is where Docusaurus gets it from.
  `blog/2026-08-30-welcome.md` currently has no `date` field.
- **The `ja` locale duplicates every post** at `/ja/blog/<slug>`. Those pages
  are not the record's canonical URL, so whether `inject` leaves them alone has
  not been checked.
- **An alternative to `inject`** would be to extend the
  `src/theme/BlogPostPage/Metadata` wrapper, which today emits `<meta>` tags
  from `head_meta` only, to also emit a `<link rel="site.standard.document">`
  from the `atUri` front-matter field that `publish` writes. That keeps
  verification inside the build rather than in a post-build step, at the cost
  of a slightly larger swizzle.

## Container images

Two images are built for production deployment, both from the **repo root** as
build context (each needs the top-level `lexicons/`):

| Image | Dockerfile | Contents |
| --- | --- | --- |
| `bps-website-ui` | `Dockerfile` | the static site, served by nginx (`deploy/nginx.conf`) on port 80 |
| `bps-website-api` | `server/Dockerfile` | the account server on port 8080 — see [server/README.md](server/README.md) |

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
