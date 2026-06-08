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

## Docs License

Documentation text is under Creative Commons Attribution (CC-BY).

Inline code examples, example data, and regular expressions are under Creative Commons Zero (CC-0, aka Public Domain) and copy/pasted without attribution.

Please see [LICENSE.txt]() with reminders about derivative works, and [LICENSE-CC-BY.txt]() for a copy of license legal text.
