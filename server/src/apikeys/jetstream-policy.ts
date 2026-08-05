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
// Initial values: 10 GiB refill per day, 1 GiB burst. Product-level numbers —
// adjust freely; the shape is pinned by jetstream-policy.test.ts.
export const JETSTREAM_DEFAULT_POLICY = {
  version: 1,
  limits: {
    egress_bytes: {
      default: {
        bytes: 10 * 1024 ** 3, // 10 GiB per period
        period_seconds: 86_400, // 1 day
        burst_bytes: 1024 ** 3, // 1 GiB
      },
    },
  },
} satisfies JetstreamPolicy
