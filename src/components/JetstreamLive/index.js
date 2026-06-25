import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from '@docusaurus/Link'
import styles from './styles.module.css'

// Live Jetstream demo, ported from atproto.com's homepage firehose widget
// (../atproto-website/src/components/home/Firehose.tsx) and restyled for these
// docs. Where the atproto version pulls in the @skyware/jetstream client (which
// imports the Node `ws` package at module scope and won't bundle cleanly under
// Docusaurus's webpack), this connects to the public Jetstream endpoint with
// the browser's native WebSocket — exactly the connection the Quickstart on
// this page documents. Nothing touches `window` until the user hits Run, so the
// component is safe to render during SSR.

// One public instance; the page documents both regions. We attach a
// wantedCollections filter so the demo shows the four record types people
// recognize (and to keep the byte/event rate sane vs. the unfiltered firehose).
const ENDPOINT = 'wss://jetstream2.us-east.bsky.network/subscribe'
const WANTED = [
  'app.bsky.feed.post',
  'app.bsky.feed.like',
  'app.bsky.feed.repost',
  'app.bsky.graph.follow',
]
const SUBSCRIBE_URL =
  ENDPOINT + '?' + WANTED.map((c) => 'wantedCollections=' + c).join('&')

// Max rendered rows. Jetstream is firehose-fast; we keep a short tail and let
// older lines fall off the top.
const MAX_LINES = 40
// Flush the incoming buffer to React state on a timer rather than per-message —
// at peak the network emits thousands of events/sec, far more than we can (or
// want to) re-render. The buffer also lets us show a realistic events/sec rate.
const FLUSH_MS = 120

const DID_RE = /^did:[a-z]+:/

// Shorten a DID for the stream view: keep the method + a head/tail of the
// identifier so rows stay scannable without horizontal scrolling.
function shortDid(did) {
  if (typeof did !== 'string' || !DID_RE.test(did)) return did || '—'
  const id = did.slice(did.lastIndexOf(':') + 1)
  return id.length > 16 ? did.slice(0, did.lastIndexOf(':') + 1) + id.slice(0, 6) + '…' + id.slice(-4) : did
}

// Pull the subject identifier (a DID for follows, an at:// uri for likes /
// reposts) out of a record, for the right-hand side of a line.
function subjectOf(record) {
  const s = record && record.subject
  if (!s) return ''
  if (typeof s === 'string') return s.startsWith('did:') ? shortDid(s) : s
  if (s.uri) return s.uri
  return ''
}

// Map a decoded commit event to a presentational line: an emoji, a CSS variant
// class, and the actor / verb / subject pieces. Returns null for events we
// don't surface (deletes, updates, identity/account events).
function lineFor(event) {
  if (event.kind !== 'commit') return null
  const c = event.commit
  if (!c || c.operation !== 'create') return null
  const actor = shortDid(event.did)
  const r = c.record || {}
  switch (c.collection) {
    case 'app.bsky.graph.follow':
      return { variant: 'follow', glyph: '🌱', actor, verb: 'follows', subject: subjectOf(r) }
    case 'app.bsky.feed.repost':
      return { variant: 'repost', glyph: '♻️', actor, verb: 'reposts', subject: subjectOf(r) }
    case 'app.bsky.feed.like':
      return { variant: 'like', glyph: '❤️', actor, verb: 'likes', subject: subjectOf(r) }
    case 'app.bsky.feed.post':
      return r.reply
        ? { variant: 'reply', glyph: '💬', actor, verb: 'replies', subject: subjectOf(r.reply.parent) }
        : { variant: 'post', glyph: '✍️', actor, verb: 'posts', subject: '' }
    default:
      return null
  }
}

export default function JetstreamLive({ ctaHref, ctaLabel }) {
  const [active, setActive] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const [lines, setLines] = useState([])
  const [rate, setRate] = useState(0)

  const wsRef = useRef(null)
  const bufferRef = useRef([]) // formatted lines awaiting the next flush
  const idRef = useRef(0) // monotonic key source
  const windowCountRef = useRef(0) // events seen since the last rate sample
  const flushRef = useRef(null)
  const outRef = useRef(null)

  const teardown = useCallback(() => {
    if (flushRef.current) {
      clearInterval(flushRef.current)
      flushRef.current = null
    }
    if (wsRef.current) {
      // Drop our handlers before closing so a late onclose can't flip state back.
      wsRef.current.onmessage = null
      wsRef.current.onopen = null
      wsRef.current.onclose = null
      wsRef.current.onerror = null
      try {
        wsRef.current.close()
      } catch (e) {
        /* already closing */
      }
      wsRef.current = null
    }
    bufferRef.current = []
  }, [])

  // Safety net: close the socket if the component unmounts mid-stream.
  useEffect(() => teardown, [teardown])

  const stop = useCallback(() => {
    teardown()
    setActive(false)
    setRate(0)
  }, [teardown])

  const start = useCallback(() => {
    if (typeof window === 'undefined' || !('WebSocket' in window)) return
    setActive(true)
    setHasRun(true)
    setLines([])
    bufferRef.current = []
    windowCountRef.current = 0

    const ws = new WebSocket(SUBSCRIBE_URL)
    wsRef.current = ws

    ws.onmessage = (msg) => {
      let event
      try {
        event = JSON.parse(msg.data)
      } catch (e) {
        return
      }
      const line = lineFor(event)
      if (!line) return
      windowCountRef.current += 1
      bufferRef.current.push({ ...line, id: idRef.current++ })
      // Keep the buffer bounded even if a flush is delayed.
      if (bufferRef.current.length > MAX_LINES) {
        bufferRef.current = bufferRef.current.slice(-MAX_LINES)
      }
    }
    ws.onclose = () => {
      // Server-side / network close (not our own stop()): reflect it in the UI.
      if (wsRef.current === ws) stop()
    }
    ws.onerror = () => {
      if (wsRef.current === ws) stop()
    }

    // Drain the buffer into state at a fixed cadence and sample the event rate.
    flushRef.current = setInterval(() => {
      const incoming = bufferRef.current
      bufferRef.current = []
      if (incoming.length) {
        setLines((prev) => prev.concat(incoming).slice(-MAX_LINES))
      }
      setRate(Math.round(windowCountRef.current / (FLUSH_MS / 1000)))
      windowCountRef.current = 0
    }, FLUSH_MS)
  }, [stop])

  const toggle = useCallback(() => {
    if (active) stop()
    else start()
  }, [active, start, stop])

  // Pin the view to the newest line as it streams.
  useEffect(() => {
    if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight
  }, [lines])

  return (
    <div className={`${styles.widget} ${active ? styles.isRunning : ''}`}>
      <div className={styles.head}>
        <span className={styles.left}>
          <span className={styles.dot} data-state={active ? 'live' : 'idle'} />
          <span className={styles.endpoint}>
            <span className={styles.prompt}>$</span> websocat {ENDPOINT}
          </span>
        </span>
        <span className={styles.right}>
          {active && (
            <span className={styles.rate} aria-live="off">
              {rate.toLocaleString()} evt/s
            </span>
          )}
          <button
            className={`${styles.run} ${active ? styles.runActive : ''}`}
            type="button"
            onClick={toggle}
          >
            <span className={active ? styles.stopGlyph : styles.playGlyph} aria-hidden="true" />
            <span className={styles.runLabel}>{active ? 'Stop' : 'Start stream'}</span>
          </button>
        </span>
      </div>

      <div className={styles.filter} aria-hidden="true">
        wantedCollections: {WANTED.join('  ·  ')}
      </div>

      <div className={styles.out} ref={outRef} aria-live="polite">
        {!hasRun && (
          <div className={styles.placeholder}>
            Real events from the live network. Press <b>Start stream</b> to open a
            WebSocket to Jetstream and watch posts, likes, reposts, and follows
            arrive in real time.
          </div>
        )}
        {hasRun && lines.length === 0 && active && (
          <div className={styles.placeholder}>Connecting to {ENDPOINT}…</div>
        )}
        {lines.map((l) => (
          <div key={l.id} className={`${styles.line} ${styles['v_' + l.variant]}`}>
            <b className={styles.glyph}>{l.glyph}</b>
            <span className={styles.actor}>{l.actor}</span>
            <span className={styles.verb}>{l.verb}</span>
            {l.subject && <span className={styles.subject}>{l.subject}</span>}
          </div>
        ))}
      </div>

      {ctaHref && (
        <Link className={styles.cta} to={ctaHref}>
          <span>{ctaLabel || 'Learn more'}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      )}
    </div>
  )
}
