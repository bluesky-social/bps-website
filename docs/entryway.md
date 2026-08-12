---
sidebar_position: 5
---

# PDS Entryway

[PDS](https://atproto.com/guides/the-at-stack) instances host accounts for users, which require account management and lifecycle controls similar to any network server. Bluesky runs many PDS hosts. Each PDS runs as a completely separate service in the network with its own identity. They federate with the rest of the network in the exact same manner that a non-Bluesky PDS does. These PDS hosts have hostnames such as `morel.us-east.host.bsky.network`.

However, the user-facing concept for Bluesky's "PDS Service" is simply `bsky.social`. This is reflected in the provided subdomain that users on a Bluesky PDS have access to (i.e. their default handle suffix), as well as the hostname that they may provide at login in order to route their login request to the correct service. A user should not be expected to understand or remember the specific host that their account is on.

To enable this, we introduced a PDS Entryway service.  This service is used to orchestrate account management across Bluesky  and to provide an interface for interacting with `bsky.social` accounts.

### Account Management

When a user creates an account on a Bluesky PDS, the call to `com.atproto.server.createAccount` is sent to the Entryway at `bsky.social`. The newly created account is then sorted on to one of the Bluesky PDS hosts. The end user does not have to be aware of this process at all.

Similarly, session management is handled by the Entryway. However, if a user attempts to refresh/delete their session by sending a request to their PDS host, their PDS will take care of forwarding that request on to the Entryway to provide a seamless experience.

The Entryway signs the access tokens used by accounts on Bluesky PDS hosts. In other words, the Entryway is the OAuth authorization server (the identity provider) for everyone Bluesky hosts.

### A single interface for Bluesky accounts

The Entryway also acts as a single interface to the accounts Bluesky hosts. Most requests that can be sent to a PDS on behalf of a user can be sent to the Entryway instead, and it forwards them to the account's actual PDS. An application can therefore talk to `bsky.social` without first working out which underlying host an account lives on.

A developer can always short-circuit this and go directly to a user's PDS. To make that possible, the Entryway returns the user's DID document (which contains the user's actual PDS hostname) in all session management routes (including `createAccount`).

The TypeScript SDK's `Client` auth handles this dynamic routing automatically: log in through `bsky.social`, and the resulting session sends requests to the user's actual PDS, using the DID document returned at login.

### Engaging with Entryway as a developer

Ideally, developers should not have to engage much with the concepts surrounding the Entryway. The important things to note are:

- the user's PDS is the hostname listed in the DID doc
- when offering signup/login to a user, Bluesky PDS hosts should be communicated as `bsky.social`
- most application requests can be sent to _either_ the Entryway _or_ the PDS
- for non-session related routes, we encourage going directly to the PDS in order to avoid the extra hop
- if authenticating with the TypeScript SDK's `Client`, you may log in via `bsky.social` and the session will handle the dynamic routing for you
