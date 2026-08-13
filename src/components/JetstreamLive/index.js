import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from '@docusaurus/Link'
import {
  JETSTREAM_SERVICE,
  refTarget,
  shortDid,
  streamCreates,
  subjectOf,
} from '../../lib/jetstream-live'
import styles from './styles.module.css'

// Live Jetstream demo, driven by the real `@bsky/jetstream` client — the same
// package and the same `live()` call the Jetstream docs teach. Earlier versions
// of this widget hand-rolled a browser WebSocket against the legacy
// `/subscribe` wire; running the actual client means the widget can't drift
// from the docs, and it inherits the library's reconnect-and-resume behavior
// instead of dying on the first blip. The connection itself lives in
// src/lib/jetstream-live.js, shared with the homepage proof window.

// The four record types people recognize. Also keeps the byte/event rate sane
// next to the unfiltered firehose. A bare NSID string is the simplest filter
// form — pass a lexicon instead when you want records validated and typed.
const COLLECTIONS = [
  'app.bsky.feed.post',
  'app.bsky.feed.like',
  'app.bsky.feed.repost',
  'app.bsky.graph.follow',
]

// Max rendered rows. Jetstream is firehose-fast; we keep a short tail and let
// older lines fall off the top.
const MAX_LINES = 40
// Flush the incoming buffer to React state on a timer rather than per-event —
// at peak the network emits thousands of events/sec, far more than we can (or
// want to) re-render. The buffer also lets us show a realistic events/sec rate.
const FLUSH_MS = 120

// Map a create to a presentational line: an emoji, a CSS variant class, and the
// actor / verb / subject pieces. Returns null for collections we don't surface.
function lineFor({ did, collection, record }) {
  const actor = shortDid(did)
  const r = record || {}
  switch (collection) {
    case 'app.bsky.graph.follow':
      return { variant: 'follow', glyph: '🌱', actor, verb: 'follows', subject: subjectOf(r) }
    case 'app.bsky.feed.repost':
      return { variant: 'repost', glyph: '♻️', actor, verb: 'reposts', subject: subjectOf(r) }
    case 'app.bsky.feed.like':
      return { variant: 'like', glyph: '❤️', actor, verb: 'likes', subject: subjectOf(r) }
    case 'app.bsky.feed.post':
      return r.reply
        ? { variant: 'reply', glyph: '💬', actor, verb: 'replies', subject: refTarget(r.reply.parent) }
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
  const [status, setStatus] = useState('idle') // idle | live | reconnecting
  const [error, setError] = useState(null)

  const abortRef = useRef(null) // AbortController for the running stream
  const bufferRef = useRef([]) // formatted lines awaiting the next flush
  const idRef = useRef(0) // monotonic key source
  const windowCountRef = useRef(0) // events seen since the last rate sample
  const flushRef = useRef(null)
  const outRef = useRef(null)

  // Tear down timers and signal the stream to end. Aborting the signal is what
  // ends the `for await` loop and closes the socket — the client owns the
  // connection, so there is no socket to close by hand.
  const teardown = useCallback(() => {
    if (flushRef.current) {
      clearInterval(flushRef.current)
      flushRef.current = null
    }
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    bufferRef.current = []
  }, [])

  // Safety net: end the stream if the component unmounts mid-run.
  useEffect(() => teardown, [teardown])

  const stop = useCallback(() => {
    teardown()
    setActive(false)
    setStatus('idle')
    setRate(0)
  }, [teardown])

  const start = useCallback(async () => {
    if (typeof window === 'undefined') return
    const controller = new AbortController()
    abortRef.current = controller

    setActive(true)
    setHasRun(true)
    setStatus('live')
    setError(null)
    setLines([])
    bufferRef.current = []
    windowCountRef.current = 0

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

    try {
      await streamCreates({
        collections: COLLECTIONS,
        signal: controller.signal,
        onStatus: setStatus,
        onCreate: (create) => {
          const line = lineFor(create)
          if (!line) return
          windowCountRef.current += 1
          bufferRef.current.push({ ...line, id: idRef.current++ })
          // Keep the buffer bounded even if a flush is delayed.
          if (bufferRef.current.length > MAX_LINES) {
            bufferRef.current = bufferRef.current.slice(-MAX_LINES)
          }
        },
      })
    } catch (err) {
      // Aborting rejects the loop with an AbortError — that is our own Stop (or
      // an unmount), not a failure. Anything else is real and worth showing:
      // the client already retried, so reaching here means it gave up.
      if (!controller.signal.aborted) {
        setError(err && err.message ? err.message : String(err))
      }
    } finally {
      // Only tear down if this run is still the current one; a Stop-then-Start
      // has already installed a newer controller we must not clobber.
      if (abortRef.current === controller) stop()
    }
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
          <span className={styles.dot} data-state={status} />
          <span className={styles.endpoint}>
            <span className={styles.prompt}>›</span> jetstream.live()
            <span className={styles.host}> · jetstream.us-east.bsky.network</span>
          </span>
        </span>
        <span className={styles.right}>
          {active && (
            <span
              className={`${styles.rate} ${status === 'reconnecting' ? styles.rateWarn : ''}`}
              aria-live="off"
            >
              {status === 'reconnecting'
                ? 'reconnecting…'
                : `${rate.toLocaleString()} evt/s`}
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
        collections: {COLLECTIONS.join('  ·  ')}
      </div>

      <div className={styles.out} ref={outRef} aria-live="polite">
        {!hasRun && (
          <div className={styles.placeholder}>
            Real events from the live network, streamed by{' '}
            <b>@bsky/jetstream</b>. Press <b>Start stream</b> to open a
            connection and watch posts, likes, reposts, and follows arrive in
            real time.
          </div>
        )}
        {hasRun && lines.length === 0 && active && !error && (
          <div className={styles.placeholder}>
            Connecting to {JETSTREAM_SERVICE}…
          </div>
        )}
        {error && (
          <div className={styles.placeholder}>
            <b>Stream ended:</b> {error}
          </div>
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
