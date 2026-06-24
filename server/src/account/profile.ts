import type { DidString } from '@atproto/syntax'

export type Profile = { did: DidString; handle: string; displayName?: string; avatar?: string }

// Profile (handle/displayName/avatar) is PUBLIC data: fetched unauthenticated
// from the public AppView. No OAuth session, no PDS proxy, no scope — works for
// any DID and never 403s the way the PDS-proxied path did.
export async function fetchProfile(appViewUrl: string, did: DidString): Promise<Profile> {
  const res = await fetch(
    `${appViewUrl}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
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
