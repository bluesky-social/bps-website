import { xrpc, type l } from '@atproto/lex'
import type { DidString } from '@atproto/syntax'
import * as app from '../lexicons/app.ts'

export type Profile = {
  did: DidString
  handle: l.HandleString
  displayName?: string
  avatar?: l.UriString
}

// Profile (handle/displayName/avatar) is PUBLIC data: fetched unauthenticated
// from the public AppView. No OAuth session, no PDS proxy, no scope — works for
// any DID and never 403s the way the PDS-proxied path did.
//
// Uses the lex client (`xrpc(app.bsky.actor.getProfile)`) with the AppView as
// the agent service, so the response is drained + schema-validated for us
// (no hand-rolled fetch / res.json()). xrpc throws on a non-ok response.
export async function fetchProfile(
  appViewUrl: string,
  did: DidString,
): Promise<Profile> {
  const { body } = await xrpc(
    { service: appViewUrl },
    app.bsky.actor.getProfile,
    {
      params: { actor: did },
    },
  )
  const profile: Profile = { did, handle: body.handle }
  if (body.displayName) profile.displayName = body.displayName
  if (body.avatar) profile.avatar = body.avatar
  return profile
}
