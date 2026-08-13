// Headwind policy v1 contract (bluesky-social/headwind policy.schema.json),
// the shape Gatekeeper validates key `data` against for the jetstream
// service. Structural rules live in these types; the numeric bounds
// (positive safe integers, bytes ≤ 2^60, period ≤ 366 days) are beyond the
// type system and are pinned by jetstream-policy.test.ts.

// A continuously refilling byte token bucket.
export type EgressLimit = {
  // Tokens added over one complete period.
  bytes: number
  // Complete refill period in seconds.
  period_seconds: number
  // Bucket capacity and the credit available to a new key.
  burst_bytes: number
}

export type JetstreamPolicy = {
  version: 1
  limits: {
    egress_bytes: {
      default: EgressLimit
      // Complete replacement limits matched by exact trusted origin id.
      overrides?: Array<{ origin: string; limit: EgressLimit }>
    }
  }
}

// Default rate-limit policy for newly created Jetstream API keys, validated
// by Gatekeeper against the jetstream service's schema (Headwind policy v1).
//
// Intent: deliberately high enough that no legitimate consumer meets it, while
// still being a real ceiling. A full copy of the network is ~2 TiB, so 100 TiB
// per 30 days is ~50 of them — nobody replaying history runs out, and a key
// that has clearly gone wrong still stops. Refill is continuous
// (bytes/period_seconds ≈ 42 MB/s); only the ratio matters, the period is
// notation.
//
// The burst is what decides whether pacing is ever felt. Segment files are
// ~250 MB, so 64 GiB is ~250 of them: a client can open as many parallel
// downloads as it likes without a drain-refill cycle ever truncating one
// mid-stream. Draining a full burst takes ~27 minutes to refill.
//
// Product-level numbers — adjust freely, or override per deployment with
// BPS_JETSTREAM_KEY_POLICY. The shape is pinned by jetstream-policy.test.ts.
export const JETSTREAM_DEFAULT_POLICY = {
  version: 1,
  limits: {
    egress_bytes: {
      default: {
        bytes: 100 * 1024 ** 4, // 100 TiB per period (~50 full-network copies)
        period_seconds: 30 * 86_400, // 30 days
        burst_bytes: 64 * 1024 ** 3, // 64 GiB (~250 segment files)
      },
    },
  },
} satisfies JetstreamPolicy

// Which policy new keys get, and where it came from. A configured policy
// REPLACES the built-in default outright — nothing is merged, so the document
// an operator sets is exactly what Gatekeeper receives. `source` exists to be
// logged at boot: it makes "which policy is this deployment actually using"
// answerable without printing the policy itself.
export function resolveJetstreamPolicy(
  configured: Record<string, unknown> | null,
): { policy: unknown; source: 'config' | 'built-in' } {
  return configured
    ? { policy: configured, source: 'config' }
    : { policy: JETSTREAM_DEFAULT_POLICY, source: 'built-in' }
}
