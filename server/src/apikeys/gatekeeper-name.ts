// TODO(stopgap): the user-facing label IS Gatekeeper's immutable key `name`
// (keys have no mutable metadata home), so labels are immutable and
// length-limited. Revisit when Gatekeeper keys grow mutable metadata.
//
// Name uniqueness is scoped to (service, subject), and revoked keys keep
// their names forever. So a user re-using a deleted key's label gets a 409
// (surfaced as LabelInUse and a "choose a different name" message). If that
// proves annoying, the fix belongs in Gatekeeper: exclude revoked keys from
// name uniqueness (partial unique index).

export const NAME_MAX_LENGTH = 128

export function encodeKeyName(label: string): string {
  const trimmed = label.trim()
  if (trimmed === '') {
    throw new Error('api key label must not be blank')
  }
  return trimmed.slice(0, NAME_MAX_LENGTH).trimEnd()
}

export function parseKeyLabel(name: string): string {
  return name
}
