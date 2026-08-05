import type { DidString } from '@atproto/syntax'

export type Consumer = { did: DidString }

export type ApiKeyMeta = {
  id: string
  label: string
  preview: string
  createdAt: Date
  expiresAt: Date | null
}

export type CreatedKey = ApiKeyMeta & { full: string } // full secret, returned ONCE

export interface ApiKeyProvider {
  ensureConsumer(did: DidString): Promise<Consumer>
  deleteConsumer(did: DidString): Promise<void>
  createKey(
    did: DidString,
    opts: { label: string; expiresAt: Date | null },
  ): Promise<CreatedKey>
  listKeys(did: DidString): Promise<ApiKeyMeta[]>
  deleteKey(did: DidString, keyId: string): Promise<void>
}

// Thrown by providers whose backing store enforces label/name uniqueness
// (Gatekeeper: names are unique per service and never freed, even after
// revocation). The router maps this to a client error.
export class LabelInUseError extends Error {
  readonly label: string

  constructor(label: string) {
    super(`an api key with label "${label}" already exists`)
    this.name = 'LabelInUseError'
    this.label = label
  }
}
