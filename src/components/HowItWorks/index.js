import React from 'react'
import Link from '@docusaurus/Link'
import useBaseUrl from '@docusaurus/useBaseUrl'
import { useColorMode } from '@docusaurus/theme-common'
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

// `href` makes the filename a link (beat 01 clicks through to the record on
// pdsls). `wrap` soft-wraps long lines instead of scrolling — for real record
// text that would otherwise force a horizontal scrollbar onto the window.
function CodeWindow({ lang, filename, href, wrap, children }) {
  return (
    <div className="hiw-window">
      <div className="hiw-head">
        <span className="lang">{lang}</span>
        {href ? (
          <a
            className="filename"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {filename}
          </a>
        ) : (
          <span className="filename">{filename}</span>
        )}
      </div>
      <pre className={wrap ? 'hiw-code wrap' : 'hiw-code'}>{children}</pre>
    </div>
  )
}

// ----- Beat 01: the record ---------------------------------------------------

// A real record, live on the network (fetched 2026-07-23; verbatim except for
// key order, ours reads better). Real beats mocked here: the same post can be
// clicked through to pdsls (raw repo view) and rendered by the Bluesky embed
// below — the same record, three ways.
const REAL_POST = {
  did: 'did:plc:ragtjsm2j2vknwkz3zp4oxrd', // @pfrazee.com
  handle: 'pfrazee.com',
  collection: 'app.bsky.feed.post',
  rkey: '3mqvnw25ous2z',
}
const REAL_POST_ATURI = `at://${REAL_POST.did}/${REAL_POST.collection}/${REAL_POST.rkey}`

function RecordSample() {
  return (
    <CodeWindow
      lang="JSON"
      filename={`at://${REAL_POST.handle}/${REAL_POST.collection}/${REAL_POST.rkey}`}
      href={`https://pdsls.dev/${REAL_POST_ATURI}`}
      wrap
    >
      <L>{'{'}</L>
      <L hl>
        {'  '}
        <Key>"$type"</Key>: <Str>"app.bsky.feed.post"</Str>,{'  '}
        <Note>← a Lexicon name</Note>
      </L>
      <L>
        {'  '}
        <Key>"text"</Key>:{' '}
        <Str>
          "Oh yeah I know Jimothy. Went to high school with him. Weird guy.
          Loved trash"
        </Str>
        ,
      </L>
      <L>
        {'  '}
        <Key>"langs"</Key>: [<Str>"en"</Str>],
      </L>
      <L>
        {'  '}
        <Key>"createdAt"</Key>: <Str>"2026-07-18T06:41:53.927Z"</Str>
      </L>
      <L>{'}'}</L>
    </CodeWindow>
  )
}

// The official embed widget (blockquote + embed.bsky.app/static/embed.js)
// swaps in an iframe on a document-level scan, which doesn't survive SPA
// navigation — so build the same iframe directly. Height arrives from the
// embed via postMessage (matched on the `id` query param), and `colorMode`
// keeps the card in step with the docs theme.
const EMBED_ORIGIN = 'https://embed.bsky.app'
const EMBED_ID = 'hiw-record'

function BlueskyEmbed({ atUri }) {
  const { colorMode } = useColorMode()
  const [height, setHeight] = React.useState(160)
  React.useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== EMBED_ORIGIN) return
      if (event.data?.id === EMBED_ID && event.data.height) {
        setHeight(event.data.height)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  return (
    <div className="hiw-embed">
      <iframe
        src={`${EMBED_ORIGIN}/embed/${atUri.slice('at://'.length)}?id=${EMBED_ID}&colorMode=${colorMode}`}
        width="100%"
        height={height}
        scrolling="no"
        title="The same post, rendered by Bluesky"
        loading="lazy"
      />
    </div>
  )
}

// ----- Beat 02: the Lexicon grid ---------------------------------------------

// A sampler of collections that share the network today: three from the
// Bluesky app, three from other apps. Splitting authority/name lets the CSS
// dim the domain part so the record name reads first.
//
// Each `sample` is a real record from the network (fetched 2026-07-23),
// trimmed to its telling fields and with long identifiers elided (…) so the
// hover card stays narrow. Shown on mouseover — the cells' hover state now
// answers the "these feel like they should do something" itch by peeking at
// what a record of that type actually looks like.
const LEXICONS = [
  {
    authority: 'app.bsky.feed.',
    name: 'post',
    what: 'a post',
    app: 'Bluesky',
    hue: 'blue',
    sample: (
      <>
        <L>{'{'}</L>
        <L>
          {'  '}
          <Key>"$type"</Key>: <Str>"app.bsky.feed.post"</Str>,
        </L>
        <L>
          {'  '}
          <Key>"text"</Key>: <Str>"Oh yeah I know Jimothy. Went to…"</Str>,
        </L>
        <L>
          {'  '}
          <Key>"langs"</Key>: [<Str>"en"</Str>],
        </L>
        <L>
          {'  '}
          <Key>"createdAt"</Key>: <Str>"2026-07-18T06:41:53.927Z"</Str>
        </L>
        <L>{'}'}</L>
      </>
    ),
  },
  {
    authority: 'app.bsky.feed.',
    name: 'like',
    what: 'a like',
    app: 'Bluesky',
    hue: 'blue',
    sample: (
      <>
        <L>{'{'}</L>
        <L>
          {'  '}
          <Key>"$type"</Key>: <Str>"app.bsky.feed.like"</Str>,
        </L>
        <L>
          {'  '}
          <Key>"subject"</Key>: {'{'}
        </L>
        <L>
          {'    '}
          <Key>"uri"</Key>: <Str>"at://did:plc:jbea…/app.bsky.feed.post/…"</Str>
          ,
        </L>
        <L>
          {'    '}
          <Key>"cid"</Key>: <Str>"bafyreigr37…"</Str>
        </L>
        <L>
          {'  '}
          {'}'},
        </L>
        <L>
          {'  '}
          <Key>"createdAt"</Key>: <Str>"2026-07-23T21:13:53.837Z"</Str>
        </L>
        <L>{'}'}</L>
      </>
    ),
  },
  {
    authority: 'app.bsky.graph.',
    name: 'follow',
    what: 'a follow',
    app: 'Bluesky',
    hue: 'blue',
    sample: (
      <>
        <L>{'{'}</L>
        <L>
          {'  '}
          <Key>"$type"</Key>: <Str>"app.bsky.graph.follow"</Str>,
        </L>
        <L>
          {'  '}
          <Key>"subject"</Key>: <Str>"did:plc:izttpdp3l6vss5crelt5kcux"</Str>,
        </L>
        <L>
          {'  '}
          <Key>"createdAt"</Key>: <Str>"2026-07-23T15:51:56.879Z"</Str>
        </L>
        <L>{'}'}</L>
      </>
    ),
  },
  {
    authority: 'site.standard.',
    name: 'document',
    what: 'a blog post',
    app: 'Standard Site',
    hue: 'ember',
    sample: (
      <>
        <L>{'{'}</L>
        <L>
          {'  '}
          <Key>"$type"</Key>: <Str>"site.standard.document"</Str>,
        </L>
        <L>
          {'  '}
          <Key>"title"</Key>: <Str>"Recommend Lexicon"</Str>,
        </L>
        <L>
          {'  '}
          <Key>"path"</Key>: <Str>"/docs/lexicons/recommend"</Str>,
        </L>
        <L>
          {'  '}
          <Key>"site"</Key>:{' '}
          <Str>"at://did:plc:re3e…/site.standard.publication/…"</Str>,
        </L>
        <L>
          {'  '}
          <Key>"publishedAt"</Key>: <Str>"2026-05-19T00:00:00.000Z"</Str>
        </L>
        <L>{'}'}</L>
      </>
    ),
  },
  {
    authority: 'sh.tangled.',
    name: 'repo',
    what: 'a git repository',
    app: 'Tangled',
    hue: 'ember',
    sample: (
      <>
        <L>{'{'}</L>
        <L>
          {'  '}
          <Key>"$type"</Key>: <Str>"sh.tangled.repo"</Str>,
        </L>
        <L>
          {'  '}
          <Key>"knot"</Key>: <Str>"knot1.tangled.sh"</Str>,
        </L>
        <L>
          {'  '}
          <Key>"description"</Key>: <Str>"my website at https://anirudh.fi"</Str>
          ,
        </L>
        <L>
          {'  '}
          <Key>"createdAt"</Key>: <Str>"2026-05-12T22:53:36+03:00"</Str>
        </L>
        <L>{'}'}</L>
      </>
    ),
  },
  {
    authority: 'events.smokesignal.calendar.',
    name: 'event',
    what: 'an event you can RSVP to',
    app: 'Smoke Signal',
    hue: 'amber',
    sample: (
      <>
        <L>{'{'}</L>
        <L>
          {'  '}
          <Key>"$type"</Key>: <Str>"events.smokesignal.calendar.event"</Str>,
        </L>
        <L>
          {'  '}
          <Key>"name"</Key>: <Str>"Pigeons Playing Ping Pong @ Neptune…"</Str>,
        </L>
        <L>
          {'  '}
          <Key>"startsAt"</Key>: <Str>"2025-03-22T03:00:00.000Z"</Str>,
        </L>
        <L>
          {'  '}
          <Key>"status"</Key>: <Str>"…calendar.event#scheduled"</Str>
        </L>
        <L>{'}'}</L>
      </>
    ),
  },
]

function LexiconGrid() {
  // One floating sample card, anchored above the hovered cell. It's a sibling
  // of the grid (positioned off cell offsets, which resolve against the
  // relative `.lex-wrap`) because the grid's rounded-corner overflow:hidden
  // would clip anything popping out of a cell. POP_W mirrors the CSS
  // max-width and clamps the card inside the wrapper near the edge columns.
  const POP_W = 440
  const wrapRef = React.useRef(null)
  const [pop, setPop] = React.useState(null)
  const showSample = (i) => (event) => {
    const cell = event.currentTarget
    const mid = cell.offsetLeft + cell.offsetWidth / 2
    const max = wrapRef.current.offsetWidth - POP_W / 2
    setPop({ i, left: Math.min(Math.max(mid, POP_W / 2), max), top: cell.offsetTop })
  }
  return (
    <div
      className="lex-wrap"
      ref={wrapRef}
      onMouseLeave={() => setPop(null)}
    >
      <div className="lex-grid">
        {LEXICONS.map((lex, i) => (
          <div
            className="lex-cell"
            data-hue={lex.hue}
            key={lex.authority + lex.name}
            onMouseEnter={showSample(i)}
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
      </div>
      {pop && (
        <div
          className="lex-pop"
          key={pop.i}
          style={{ left: pop.left, top: pop.top }}
          aria-hidden="true"
        >
          <pre className="lex-pop-code">{LEXICONS[pop.i].sample}</pre>
        </div>
      )}
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
        // The image is deliberately outside the link: this page renders inside
        // `.markdown`, so medium-zoom (src/theme/Root.js) attaches to these
        // screenshots. Wrapping the whole card in an <a> meant one click both
        // opened the lightbox and navigated away in a new tab. Clicking the
        // screenshot zooms; only the caption leaves the page.
        <div className="app-card" key={app.name}>
          <img
            src={base + app.img.slice(1)}
            alt={`${app.name} screenshot`}
            loading="lazy"
          />
          <a
            className="app-caption"
            href={app.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="app-name">
              {app.name}
              <span aria-hidden="true"> ↗</span>
            </span>
            <span className="app-lens">
              {app.lens} · {app.what}
            </span>
          </a>
        </div>
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
          data. Here's how individually addressable records combine to form
          the network you can build on.
        </p>
        {/* Lexicon precedes record (a record is an instance of a Lexicon),
            but the record stays lit: it's where the story below starts. */}
        <div className="hiw-path" aria-hidden="true">
          <span className="seg">a Lexicon</span>
          <span className="arrow">→</span>
          <span className="seg lit">a record</span>
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
            It's addressable through that <code>at://</code> URI, and anyone
            can fetch it.
          </p>
        </div>
        <div className="beat-stage">
          <RecordSample />
          <BlueskyEmbed atUri={REAL_POST_ATURI} />
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
            .
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
            Lexicon types — namespaces — act as filters. Ask for one collection,
            and the server sends only those records, decoded, typed, and ready to
            use.
          </p>
          <p>
            This is <b>every blog post published anywhere on the network</b>, as
            it happens, in fewer than 10 lines.
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
