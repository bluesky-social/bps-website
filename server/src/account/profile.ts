import type { NodeOAuthClient } from '@atproto/oauth-client-node'
import type { DidString } from '@atproto/syntax'

export type Profile = { did: DidString; handle: string; displayName?: string; avatar?: string }

// Fetches the caller's bsky profile live via their restored OAuth session.
// fetchHandler() makes a DPoP-authed call to the user's PDS, which proxies
// app.bsky.* reads to the AppView. No caching (v1).
export async function fetchProfile(client: NodeOAuthClient, did: DidString): Promise<Profile> {
  const session = await client.restore(did)
  const res = await session.fetchHandler(
    `/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
  )
  if (!res.ok) {
    throw new Error(`getProfile failed: ${res.status}`)
  }
  const data = (await res.json()) as { handle: string; displayName?: string; avatar?: string }
  const profile: Profile = { did, handle: data.handle }
  if (data.displayName) profile.displayName = data.displayName
  if (data.avatar) profile.avatar = data.avatar
  return profile
}
