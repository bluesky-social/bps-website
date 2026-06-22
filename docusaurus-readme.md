# docs.bsky.app

This repository contains source code for the Bluesky developer documentation website: <https://docs.bsky.app>

This site includes tutorials, a blog, guides, and HTTP API reference docs for the Bluesky app.

The AT Protocol documentation and specifications are a separate website ([atproto.com](https://atproto.com)) maintained at <https://github.com/bluesky-social/atproto-website>.


## Building The Docs

This website is built using [Docusaurus](https://docusaurus.io/), a static website generator in JavaScript.

To build the site, first you'll need node.js and `npm` installed locally. Run `npm install` to fetch dependencies.

To run a local development server (which you can browse at <http://localhost:3000>):

    npm start

To run a static build (output in `./build/`):

    npm run build

The output can be served using any static contents hosting service.

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

Please see [LICENSE.txt]() with reminders about derivative works, and [LICENSE-CC-BY.txt]() for a copy of license legal text.
