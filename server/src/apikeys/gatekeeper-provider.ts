import { ulid } from 'ulid'
import type { DidString } from '@atproto/syntax'
import type { DB } from '../db/index.ts'
import type { ApiKeyProvider, ApiKeyMeta, CreatedKey, Consumer } from './provider.ts'
import { LabelInUseError } from './provider.ts'
import { encodeKeyName, parseKeyLabel } from './gatekeeper-name.ts'
import { GatekeeperError, type GatekeeperClient, type GatekeeperKey } from './gatekeeper-client.ts'

// Preview mirrors key.ts's `jsk_…xxxx` convention: scheme prefix + last 4.
function previewSecret(full: string): string {
  return `${full.slice(0, 3)}…${full.slice(-4)}`
}

function toMeta(key: GatekeeperKey): ApiKeyMeta {
  return {
    id: key.id,
    label: parseKeyLabel(key.name),
    preview: previewSecret(key.key),
    createdAt: new Date(key.created_at),
    expiresAt: key.valid_until ? new Date(key.valid_until) : null,
  }
}

// ApiKeyProvider backed by Gatekeeper (bluesky-social/gatekeeper). Ownership
// lives in Gatekeeper's first-class key `subject` (the DID); key `data` is a
// pure Headwind policy document validated against the service's schema.
//
// NOTE: listKeys uses GET /v1/subjects/{did}/keys, which returns only
// currently-usable keys — expired (and revoked) keys silently disappear from
// the list. Accepted for v1; the lexicon/UI contract still treats expired
// entries as possible so this can change later.
export function createGatekeeperApiKeyProvider(
  _db: DB,
  client: GatekeeperClient,
  opts: { service: string; defaultPolicy: unknown },
): ApiKeyProvider {
  const { service, defaultPolicy } = opts

  const listServiceKeys = async (did: DidString): Promise<GatekeeperKey[]> => {
    const groups = await client.listSubjectKeys(did)
    return groups[service] ?? []
  }

  return {
    async ensureConsumer(_did: DidString): Promise<Consumer> {
      throw new Error('not implemented') // Task 5
    },

    async deleteConsumer(_did: DidString): Promise<void> {
      throw new Error('not implemented') // Task 5
    },

    async createKey(did, keyOpts): Promise<CreatedKey> {
      const name = encodeKeyName(keyOpts.label)
      let created: GatekeeperKey
      try {
        created = await client.createKey(service, {
          subject: did,
          name,
          data: defaultPolicy,
          validUntil: keyOpts.expiresAt,
          // Fresh per call, never derived from label/did: a replay after
          // delete-and-recreate must not resurrect the revoked key.
          idempotencyKey: ulid(),
        })
      } catch (err) {
        if (err instanceof GatekeeperError && err.status === 409) {
          // Name conflict. Includes collisions with revoked keys' names,
          // which Gatekeeper never frees.
          throw new LabelInUseError(keyOpts.label)
        }
        if (err instanceof GatekeeperError && err.status === 422) {
          // Our configured default policy failed the service's schema:
          // a deployment misconfiguration, not a user error.
          throw new Error(`gatekeeper rejected the default policy for service "${service}": ${err.message}`, { cause: err })
        }
        throw err
      }
      return { ...toMeta(created), full: created.key }
    },

    async listKeys(did): Promise<ApiKeyMeta[]> {
      return (await listServiceKeys(did)).map(toMeta)
    },

    async deleteKey(_did, _keyId): Promise<void> {
      throw new Error('not implemented') // Task 5
    },
  }
}
