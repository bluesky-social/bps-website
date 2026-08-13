// Shared driver for the site's two live Jetstream widgets: the terminal panel
// in src/components/JetstreamLive (docs) and the "proof" window on the homepage
// (src/pages/index.js). Both stream real events from a public Jetstream
// instance with the real `@bsky/jetstream` client; only their rendering differs,
// so the connection, filtering, and event→line mapping live here once.
//
// The library is behind a dynamic import so that nothing loads it during SSR,
// and so the client bundle code-splits it out of first paint — a visitor who
// never presses Run never downloads it.

// A public v2 instance. `live()` speaks the v2 XRPC wire
// (network.bsky.jetstream.subscribeEvents); the host is given as https:// and
// the client derives the wss:// URL itself.
export const JETSTREAM_SERVICE = 'https://jetstream.us-east.bsky.network'

const DID_RE = /^did:[a-z]+:/

// Shorten a DID for a narrow view: keep the method + a head/tail of the
// identifier so rows stay scannable without horizontal scrolling.
export function shortDid(did) {
  if (typeof did !== 'string' || !DID_RE.test(did)) return did || '—'
  const id = did.slice(did.lastIndexOf(':') + 1)
  return id.length > 16
    ? did.slice(0, did.lastIndexOf(':') + 1) + id.slice(0, 6) + '…' + id.slice(-4)
    : did
}

// Render a record's pointer-to-something as a display string. Two shapes turn
// up: a bare DID (what `app.bsky.graph.follow` puts in `subject`) and a strong
// ref — `{ uri, cid }` — which is what likes, reposts, and a post's
// `reply.parent` carry. `shorten` applies to bare DIDs only; an at:// URI is
// left whole so it stays copy-pasteable.
export function refTarget(ref, shorten = shortDid) {
  if (!ref) return ''
  if (typeof ref === 'string') return ref.startsWith('did:') ? shorten(ref) : ref
  if (ref.uri) return ref.uri
  return ''
}

// The `subject` of a follow, like, or repost record. Note this is NOT the right
// helper for a reply: `reply.parent` is already a strong ref, so it goes through
// refTarget() directly (passing it here would look for `parent.subject` and
// silently come back empty).
export function subjectOf(record, shorten = shortDid) {
  return refTarget(record && record.subject, shorten)
}

/**
 * Open a live Jetstream commit stream and hand each *create* to `onCreate` as
 * `{ did, collection, record, seq }`.
 *
 * Resolves when the stream ends normally (i.e. `signal` was aborted). Rejects
 * only on a genuinely fatal error: the client reconnects and resumes from its
 * cursor on its own, so reaching the rejection path means it gave up. Callers
 * should surface that rather than swallow it — a dead widget that looks idle is
 * worse than one that says why it stopped.
 *
 * @param {object} opts
 * @param {string[]} opts.collections NSIDs to filter server-side.
 * @param {AbortSignal} opts.signal Ends the stream when aborted.
 * @param {(create: {did: string, collection: string, record: object, seq: number}) => void} opts.onCreate
 * @param {(status: 'live' | 'reconnecting') => void} [opts.onStatus]
 */
export async function streamCreates({
  collections,
  signal,
  onCreate,
  onStatus,
}) {
  const { Jetstream, websocketTransport } = await import('@bsky/jetstream')
  // The caller may have aborted while the chunk was in flight.
  if (signal.aborted) return

  // Report only actual transitions. The "we're live" signal below sits on the
  // per-event path, and at firehose rates that would otherwise mean hundreds of
  // identical callbacks a second.
  let reported = null
  const report = (status) => {
    if (status === reported) return
    reported = status
    onStatus?.(status)
  }

  const jetstream = new Jetstream(JETSTREAM_SERVICE)

  for await (const evt of jetstream.live({
    collections,
    // `collections` constrains commits only, so a commits-only stream must also
    // ask for kinds: ['commit'] — otherwise identity, account, and sync events
    // arrive regardless of the collection filter.
    kinds: ['commit'],
    signal,
    // Reconnects are silent by default; surfacing them keeps a status light
    // honest when the connection is troubled rather than dead.
    liveTransport: websocketTransport({
      onReconnect: () => report('reconnecting'),
    }),
    // A record that fails lex conversion is skipped and reported here instead
    // of being delivered. For a display widget that just means one fewer line.
    onError: () => {},
  })) {
    // `kinds` already restricts this to commits; the guard keeps the property
    // access honest for a non-commit that somehow arrives.
    if (evt.kind !== 'commit' || evt.commit.operation !== 'create') continue
    // An event arriving is the proof that the connection recovered.
    report('live')
    onCreate({
      did: evt.did,
      collection: evt.commit.collection,
      record: evt.commit.record,
      seq: evt.seq,
    })
  }
}
