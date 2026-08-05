// Default rate-limit policy for newly created Jetstream API keys, validated
// by Gatekeeper against the jetstream service's schema (Headwind policy v1).
//
// Deliberately code, not config: a policy is service-specific (it must match
// that service's schema), so it travels with the hardcoded service name at
// the wiring site. Changing these defaults is a code change + deploy.
// Individual keys are tuned afterward via Gatekeeper's UI/PATCH.
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
}
