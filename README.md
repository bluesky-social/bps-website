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
- `src/` — theme customizations, React components, and the landing page
- `lexicons/` — Lexicon schemas for the account server's API, compiled into `src/lexicons/` by `npm run lex:build`
- `server/` — the backend for the authenticated account section of the site (Node + Express + Postgres). It has its own [README](server/README.md) and is deployed separately from the static site.
- `prototypes/` — standalone landing-page mockups, not part of the build. Serve them with `python3 -m http.server 8000 --directory prototypes`.
- `deploy/` — deployment configuration that is not applied by anything in this repo; currently the draft nginx config for the docs.bsky.app redirect

## Building the docs

This website is built using [Docusaurus](https://docusaurus.io/), a static website generator in JavaScript.

To build the site, first you'll need node.js and `npm` installed locally — Node 22 or newer, per `.node-version` (the lexicon codegen used by the build requires it). Run `npm install` to fetch dependencies.

To run a local development server (which you can browse at <http://localhost:3000>):

    npm start

To run a static build (output in `./build/`):

    npm run build

The output can be served using any static contents hosting service.

## Container images

Two images are built for production deployment, both from the **repo root** as
build context (each needs the top-level `lexicons/`):

| Image | Dockerfile | Contents |
| --- | --- | --- |
| `bps-website-ui` | `Dockerfile` | the static site, served by nginx (`deploy/nginx.conf`) on port 80 |
| `bps-website-api` | `server/Dockerfile` | the account server on port 8080 — see [server/README.md](server/README.md) |

`.github/workflows/containers.yml` builds both on every branch push, and pushes
them to ECR from `main` or from a manual `workflow_dispatch` run on any branch,
tagged with the full commit SHA. It runs on the `arc` self-hosted runners and
delegates the build to the org's shared
[`build-push-ecr`](https://github.com/bluesky-social/.github/blob/main/actions/build-push-ecr/README.md)
action, which supplies ECR credentials, the Docker Hub pull-through cache, and
the shared layer cache.

The dispatch trigger is how a staging image gets built from an unmerged branch:
run the workflow on that branch and deploy the SHA it publishes. Publishing is
manual on purpose — pushing to a branch should not produce a deployable image on
its own.

The UI image is **environment-specific**: two origins are read by
`docusaurus.config.js` and baked into the static output, so they are build
arguments with no runtime override, and the build fails if either is missing
rather than falling back.

| Build argument | Value | Fallback we refuse to inherit |
| --- | --- | --- |
| `BPS_PUBLIC_API_ORIGIN` | public origin of `bps-website-api` | localhost, which sends account requests to `127.0.0.1` |
| `BPS_SITE_URL` | the host this build is served from | `https://bsky.network/`, production's own identity |

In CI `BPS_PUBLIC_API_ORIGIN` comes from the repository variable of the same
name, while `BPS_SITE_URL` is chosen by the ref: `main` builds production,
any other ref builds the `bps-preview.bsky.network` staging flavor. Two flavors
share the `bps-website-ui` ECR repo and are distinguished only by commit, so a
preview image is not interchangeable with a production one — the run log echoes
both origins to keep that recoverable. (`ENDPOINTS_URL` is also passed as a build
argument, but is inert today — nothing reads `customFields.endpointsUrl` and the
homepage hardcodes the endpoints link.)

Both origins have a second consumer with a stricter contract than "advertise the
right host": the site publishes the account login's OAuth client metadata
document at `/oauth-client-metadata.json`. Its `client_id` is built from
`BPS_SITE_URL` and must match the URL the document is served from, and its
`redirect_uris`/`jwks_uri` are built from `BPS_PUBLIC_API_ORIGIN` and must name
the origin the account server itself runs on (`BPS_API_ORIGIN`). Either mismatch
fails login while leaving the rest of the site working — see
[server/README.md](server/README.md#the-client_id-document-lives-on-the-website-not-here).

    docker build -t bps-website-ui \
      --build-arg BPS_PUBLIC_API_ORIGIN=https://api.example.com \
      --build-arg BPS_SITE_URL=https://www.example.com .
    docker run --rm -p 8080:80 bps-website-ui

Both images answer `GET /_health` for container probes.

## Redirects

Inbound links are preserved in two layers, and both are needed:

1. **`deploy/docs.bsky.app.conf`** — a draft nginx config for docs.bsky.app that 301s every path to this host, plus a rule sending the retired `/docs/api/*` endpoint reference to endpoints.bsky.app. The wildcard **must preserve the request path**: the redirects in layer 2 are served by *this* site, so they can only fire if the legacy pathname actually arrives here.
2. **The `redirects` block in `docusaurus.config.js`** — per-page moves, covering both the legacy docs.bsky.app URL set (sourced from that site's last sitemap) and renames internal to this site. These are client-side redirects, so each one is a small generated HTML page; anything that needs a real server 301, or a whole URL prefix, belongs in layer 1 instead.

When you rename or remove a page, add an entry to layer 2. Note that `url` in `docusaurus.config.js` feeds the sitemap and social-card URLs, so it must name the host the site is actually served from — override it with `BPS_SITE_URL` for any build served somewhere other than bsky.network.

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
