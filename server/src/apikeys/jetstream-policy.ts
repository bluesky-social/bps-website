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
// Intent: a key can download the full network (~2 TiB) over 30 days. Refill
// is continuous (bytes/period_seconds ≈ 880 KB/s); only the ratio matters,
// the period is notation. The small burst makes pacing govern: it bounds
// line-rate spend and a new key's starting credit. It is hinged on the
// archive's unit of work — segment files are ~250 MB and clients keep only a
// few downloads in flight — so 1 GiB covers a full in-flight set (~4
// segments) with margin, letting each drain-refill cycle (~20 min to refill
// in full) complete whole objects without mid-stream truncation.
// Product-level numbers — adjust freely; the shape is pinned by
// jetstream-policy.test.ts.
export const JETSTREAM_DEFAULT_POLICY = {
  version: 1,
  limits: {
    egress_bytes: {
      default: {
        bytes: 2 * 1024 ** 4, // 2 TiB per period
        period_seconds: 30 * 86_400, // 30 days
        burst_bytes: 1024 ** 3, // 1 GiB (~4 segment files)
      },
    },
  },
} satisfies JetstreamPolicy
