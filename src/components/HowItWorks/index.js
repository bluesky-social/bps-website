import React from 'react'
import Link from '@docusaurus/Link'
import useBaseUrl from '@docusaurus/useBaseUrl'
import JetstreamLive from '../JetstreamLive'

import '../../css/how-it-works.css'

// ---------------------------------------------------------------------------
// "How it works" — the storytelling side-door into the funnel.
//
// Rendered by docs/how-it-works.mdx as a DOC (not a standalone page) so the
// route gets the real docs sidebar and mobile drawer for free; the doc chrome
// it doesn't want (breadcrumbs, container width/padding, light background) is
// suppressed in how-it-works.css via the `html.docs-doc-id-how-it-works`
// class hook.
//
// react.dev-style: one claim per beat, told through an artifact (a record, a
// grid of Lexicon names, the live stream, two code samples) with as little
// prose as possible. The arc: a post is a record → its $type is a Lexicon →
// one firehose carries every Lexicon → filter by Lexicon → do it at network
// scale. Lexicons are framed operationally ("the name you slice the firehose
// by") — the primitive-level story stays on atproto.com, which we link out to.
//
// Code samples use the same SDK surface as docs/jetstream-sdk.mdx
// (bsky-jetstream-preview, `.live()`, the kind/operation guard) so anything a
// reader copies from here behaves exactly like the docs.
// ---------------------------------------------------------------------------

// Tiny hand-tokenizer: same GitHub-Dark token vocabulary as the homepage proof
// window, but composed as JSX instead of dangerouslySetInnerHTML strings.
const Kw = ({ children }) => <span className="tk-kw">{children}</span>
const Cls = ({ children }) => <span className="tk-cls">{children}</span>
const Key = ({ children }) => <span className="tk-key">{children}</span>
const Str = ({ children }) => <span className="tk-str">{children}</span>
const Fn = ({ children }) => <span className="tk-fn">{children}</span>
const Note = ({ children }) => <span className="tk-note">{children}</span>
// One source line. `hl` paints the full-bleed highlight (the $type line).
const L = ({ hl, children }) => (
  <span className={hl ? 'cl hl' : 'cl'}>{children ?? ' '}</span>
)

function CodeWindow({ lang, filename, children }) {
  return (
    <div className="hiw-window">
      <div className="hiw-head">
        <span className="lang">{lang}</span>
        <span className="filename">{filename}</span>
      </div>
      <pre className="hiw-code">{children}</pre>
    </div>
  )
}

// ----- Beat 01: the record ---------------------------------------------------

function RecordSample() {
  return (
    <CodeWindow
      lang="JSON"
      filename="at://alice.bsky.social/app.bsky.feed.post/3kj2xq8wlmc24"
    >
      <L>{'{'}</L>
      <L hl>
        {'  '}
        <Key>"$type"</Key>: <Str>"app.bsky.feed.post"</Str>,{'  '}
        <Note>← a Lexicon name</Note>
      </L>
      <L>
        {'  '}
        <Key>"text"</Key>: <Str>"just setting up my atproto"</Str>,
      </L>
      <L>
        {'  '}
        <Key>"langs"</Key>: [<Str>"en"</Str>],
      </L>
      <L>
        {'  '}
        <Key>"createdAt"</Key>: <Str>"2026-07-15T17:03:24.522Z"</Str>
      </L>
      <L>{'}'}</L>
    </CodeWindow>
  )
}

// ----- Beat 02: the Lexicon grid ---------------------------------------------

// A sampler of collections that share the network today: three from the
// Bluesky app, three from other apps. Splitting authority/name lets the CSS
// dim the domain part so the record name reads first.
const LEXICONS = [
  {
    authority: 'app.bsky.feed.',
    name: 'post',
    what: 'a post',
    app: 'Bluesky',
    hue: 'blue',
  },
  {
    authority: 'app.bsky.feed.',
    name: 'like',
    what: 'a like',
    app: 'Bluesky',
    hue: 'blue',
  },
  {
    authority: 'app.bsky.graph.',
    name: 'follow',
    what: 'a follow',
    app: 'Bluesky',
    hue: 'blue',
  },
  {
    authority: 'site.standard.',
    name: 'document',
    what: 'a blog post',
    app: 'Standard',
    hue: 'ember',
  },
  {
    authority: 'sh.tangled.',
    name: 'repo',
    what: 'a git repository',
    app: 'Tangled',
    hue: 'ember',
  },
  {
    authority: 'events.smokesignal.calendar.',
    name: 'event',
    what: 'an event you can RSVP to',
    app: 'Smoke Signal',
    hue: 'amber',
  },
]

function LexiconGrid() {
  return (
    <div className="lex-grid">
      {LEXICONS.map((lex) => (
        <div
          className="lex-cell"
          data-hue={lex.hue}
          key={lex.authority + lex.name}
        >
          <span className="lex-nsid">
            <span className="authority">{lex.authority}</span>
            {lex.name}
          </span>
          <span className="lex-what">{lex.what}</span>
          <span className="lex-app">
            <span className="dot" aria-hidden="true" />
            {lex.app}
          </span>
        </div>
      ))}
      <div className="lex-cell yours">
        <span className="lex-nsid">
          <span className="authority">com.your-domain.</span>whatever
        </span>
        <span className="lex-what">
          Own a domain? You can publish a Lexicon. The network already knows how
          to carry it.
        </span>
      </div>
    </div>
  )
}

// ----- Beat 04: filter by Lexicon ---------------------------------------------

function SliceSample() {
  return (
    <CodeWindow lang="TS" filename="blogs.ts">
      <L>
        <Kw>import</Kw> {'{ '}
        <Cls>Jetstream</Cls>
        {' }'} <Kw>from</Kw> <Str>'bsky-jetstream-preview'</Str>
      </L>
      <L />
      <L>
        <Kw>const</Kw> jetstream = <Kw>new</Kw> <Cls>Jetstream</Cls>(
        <Str>'https://jetstream2.us-east.bsky.network'</Str>)
      </L>
      <L />
      <L>
        <Kw>for await</Kw> (<Kw>const</Kw> evt <Kw>of</Kw> jetstream.
        <Fn>live</Fn>({'{ '}collections: [<Str>'site.standard.document'</Str>]
        {' }'})) {'{'}
      </L>
      <L>
        {'  '}
        <Kw>if</Kw> (evt.kind === <Str>'commit'</Str> && evt.commit.operation
        === <Str>'create'</Str>) {'{'}
      </L>
      <L>
        {'    '}console.<Fn>log</Fn>(
        <Str>{'`📝 ${evt.did} published "${evt.commit.record.title}"`'}</Str>)
      </L>
      <L>{'  }'}</L>
      <L>{'}'}</L>
    </CodeWindow>
  )
}

// ----- Beat 05: apps as lenses --------------------------------------------------

// Each app is a different lens over the same repos. The `lens` line ties the
// card back to the Lexicon grid in beat 02 — the slice each app indexes.
// Screenshots live in static/ and are referenced by served URL (resolved
// through useBaseUrl at render), not require()d — see the homepage globe note.
const APPS = [
  {
    name: 'Bluesky',
    lens: 'app.bsky.*',
    what: 'the social lens',
    href: 'https://bsky.app',
    img: '/img/hiw/bluesky.png',
  },
  {
    name: 'Tangled',
    lens: 'sh.tangled.*',
    what: 'the code lens',
    href: 'https://tangled.org',
    img: '/img/hiw/tangled.png',
  },
  {
    name: 'Standard Reader',
    lens: 'site.standard.*',
    what: 'the publishing lens',
    href: 'https://standard-reader.app',
    img: '/img/hiw/standard.png',
  },
  {
    name: 'Smoke Signal',
    lens: 'events.smokesignal.*',
    what: 'the events lens',
    href: 'https://smokesignal.events',
    img: '/img/hiw/smokesignal.png',
  },
]

function AppGrid() {
  // One hook call for the site base; per-image useBaseUrl inside .map would
  // break the rules of hooks.
  const base = useBaseUrl('/')
  return (
    <div className="app-grid">
      {APPS.map((app) => (
        <a
          className="app-card"
          key={app.name}
          href={app.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={base + app.img.slice(1)}
            alt={`${app.name} screenshot`}
            loading="lazy"
          />
          <span className="app-caption">
            <span className="app-name">{app.name}</span>
            <span className="app-lens">
              {app.lens} · {app.what}
            </span>
          </span>
        </a>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------

export default function HowItWorks() {
  return (
    // <div>, not <main>: this renders inside the doc article, which already
    // sits in the layout's <main>.
    <div className="bps-hiw">
      <header className="hiw-hero">
        <p className="eyebrow">How it works</p>
        <h1>
          From one post
          <br />
          <span className="quiet">to the whole network.</span>
        </h1>
        <p className="lede">
          Bluesky runs on the{' '}
          <a
            className="out"
            href="https://atproto.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            AT Protocol
          </a>
          : an open network where every app reads and writes the same public
          data. Here's how one small record becomes a network you can build on.
        </p>
        <div className="hiw-path" aria-hidden="true">
          <span className="seg lit">a record</span>
          <span className="arrow">→</span>
          <span className="seg">a Lexicon</span>
          <span className="arrow">→</span>
          <span className="seg">the firehose</span>
          <span className="arrow">→</span>
          <span className="seg">your app</span>
        </div>
      </header>

      {/* ===== 01 · RECORD ===== */}
      <section className="beat" id="records">
        <div className="beat-copy">
          <span className="beat-num">01</span>
          <h2>A post is just a record</h2>
          <p>
            Every account on the network has its own public data repository.
            When someone posts on Bluesky, the app writes a small JSON record
            into their repo.
          </p>
          <p>
            It has an address, that <code>at://</code> URI, and anyone can
            fetch it.
          </p>
        </div>
        <div className="beat-stage">
          <RecordSample />
        </div>
      </section>

      {/* ===== 02 · LEXICON ===== */}
      <section className="beat stacked" id="lexicons">
        <div className="beat-copy">
          <span className="beat-num">02</span>
          <h2>
            That <code>$type</code> is a Lexicon
          </h2>
          <p>
            <code>app.bsky.feed.post</code> is an <b>NSID</b>; a domain name,
            reversed. Whoever owns the domain gets to publish a <b>Lexicon</b>;
            a schema that says what records of that type look like. Bluesky
            defines the <code>app.bsky.*</code> types, and other apps define
            their own. All of them live in the same repos, on the same network.
          </p>
        </div>
        <div className="beat-stage">
          <LexiconGrid />
          <p className="stage-caption">
            Lexicons are the protocol's schema language — the full story lives
            at{' '}
            <a
              href="https://atproto.com/guides/lexicon"
              target="_blank"
              rel="noopener noreferrer"
            >
              atproto.com
            </a>
            . Here, what matters is the name.
          </p>
        </div>
      </section>

      {/* ===== 03 · FIREHOSE ===== */}
      <section className="beat stacked" id="firehose">
        <div className="beat-copy">
          <span className="beat-num">03</span>
          <h2>Every record flows through one stream</h2>
          <p>
            Repositories sync to relays, which merge everything happening on the
            network into a single firehose. <b>Jetstream</b> — one of the{' '}
            <Link to="/docs/protocol-services">services Bluesky operates</Link>{' '}
            — serves it as plain JSON over a WebSocket. This is the live
            network, right now:
          </p>
        </div>
        <div className="beat-stage">
          <div className="hiw-live">
            <JetstreamLive />
          </div>
        </div>
      </section>

      {/* ===== 04 · SLICE ===== */}
      <section className="beat" id="slice">
        <div className="beat-copy">
          <span className="beat-num">04</span>
          <h2>Filter by Lexicon, get your slice</h2>
          <p>
            The name from step two is also the filter. Ask for one collection,
            and the server sends only those records, decoded, typed, and ready to
            use.
          </p>
          <p>
            This is <b>every blog post published anywhere on the network</b>, as
            it happens, in eight lines.
          </p>
        </div>
        <div className="beat-stage">
          <SliceSample />
        </div>
      </section>

      {/* ===== 05 · APPS AS LENSES ===== */}
      <section className="beat stacked payoff" id="apps">
        <div className="beat-copy">
          <span className="beat-num">05</span>
          <h2>An app is a lens on the network</h2>
          <p>
            That loop is how apps get built here: pick the Lexicons you care
            about, index the records into a view, serve it. A new app doesn't
            launch empty. It seeds its view straight from the network.
          </p>
          <p>
            Each of these is a different lens over the{' '}
            <b>same repositories, the same accounts, the same stream</b>,
            focused on its own slice of Lexicons. And everything they index
            stays open to the next lens, including yours.
          </p>
        </div>
        <div className="beat-stage">
          <AppGrid />
          <p className="stage-caption">
            "apps should be lenses rather than boxes" —{' '}
            <a
              href="https://bsky.app/profile/danabra.mov"
              target="_blank"
              rel="noopener noreferrer"
            >
              @danabra.mov
            </a>
          </p>
          <div className="payoff-ctas">
            <Link className="btn primary" to="/docs/protocol-services">
              <span>Get Started</span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="btn quiet" to="/docs/jetstream">
              <span>Jetstream docs</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
