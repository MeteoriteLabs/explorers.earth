# Music Identity Product Decisions

Status: Accepted
Date: 2026-08-13
Scope: Explorers embedded Music identity, ownership, and entitlement

## Decision

Explorers is the only consumer identity and onboarding system. Music must not ask an embedded Explorer to register, choose a Music password, or connect a second account.

### Provisioning trigger

After the identity provider or local-email verification is authoritative and the user has completed Explorers onboarding with one unambiguous completed Account, Explorers starts a bodyless, idempotent Music ensure operation.

Provisioning runs automatically in the background. A Music outage does not undo onboarding, block unrelated Explorer routes, or create a second-account recovery flow. The Music page exposes a contextual retry state if automatic provisioning remains incomplete.

### Ownership unit

Music content is owned by the person for this release. Tunes retains its numeric user ID as the owner key for playlists, queue, history, settings, guest capability, and other current domain rows.

The projection also persists the immutable selected Strapi Account document ID. That Account ID is context and a future workspace-migration seam; it is not a mutable authorization input, is not selected by browser array order, and cannot silently switch.

If shared workspace or multi-venue ownership becomes a product requirement, it requires a new ADR and an explicit domain migration rather than reinterpreting existing person-owned rows.

### Entitlement

Every eligible Explorer receives core personal Music capability. Identity projection does not automatically grant venue, administrative, commercial, expanded-quota, or other premium capabilities.

Those capabilities are derived and enforced server-side from the authoritative entitlement policy. The UI represents entitled, trial-eligible, upgrade-required, read-only, stale/unknown, and denied states without exposing backend terminology.

## Consequences

- Google and confirmed-email users converge on the same post-onboarding ensure contract.
- Username, email, profile picture, and Account-name changes update mutable snapshots without changing Music ownership or content.
- No browser-supplied username, Account ID, Tunes user ID, or resource owner ID authorizes an operation.
- All fully onboarded eligible users may have a minimal Music identity even if they never open Music.
- Lifecycle, suspension, deletion tombstones, reconciliation, and retention apply to every automatically projected identity.
- Product activation metrics must distinguish identity creation from meaningful Music use such as first open, first playlist, first share/request, and return use.

### Deletion absence-proof authority

The lifecycle worker may finalize personal Music data only after an immutable-ID
read proves that both the Explorer user and selected Account are absent. Live
runtime startup therefore requires a dedicated
`STRAPI_LIFECYCLE_PROOF_TOKEN_FILE`, loaded through the secure secret-file
boundary. It must not alias the generic `STRAPI_ACCESS_TOKEN`, is never exposed
to routes or logs, and its Strapi role must allow the exact read-only absence
query while forbidding representative mutations. Production deployment remains
gated until operators mount and authorize that separate credential; missing,
inline, aliased, or unsafe authority fails startup before the worker starts.

The disposable five-service fixture is the sole exception to file-backed live
authority. It may use only the exact deterministic `fixture-read-only-token`,
whose fixture contract contains read operations only. No production credential
or generic live write authority is an accepted fallback.

### Disposable fixture authority compatibility

Raw pre-generation `.env.music.test` files are not product data and are not a
supported migration source. They are rejected without mutation or secret
reflection. Exact fixture project confirmation grants no exception. Recovery
is external to the application: preserve source changes according to operator
policy, discard the entire disposable worktree, and create a clean checkout.
No application command interprets, converts, or erases raw legacy fixture
authority.

This deliberately removes the legacy auto-upgrade path. On the supported
Windows host, a destination handle strict enough to prevent a concurrent entry
replacement also prevents the replacement commit itself; a replace-compatible
handle permits the entry race. POSIX pathname replacement has the same
validate-close-to-commit class unless a separately verified exchange protocol
is introduced. Disposable fixture compatibility does not justify that
cross-platform transaction surface.

An in-worktree cleanup manifest cannot authenticate itself across a hard exit:
the manifest and any colocated key share the same mutable authority boundary.
An ephemeral key is lost, and a public or self-derived key is forgeable. The
application therefore does not offer guarded in-place raw cleanup rather than
claiming an unsigned advisory record is an authority. Normal versioned fixture
rotation and normal supported-authority teardown remain unchanged. The
unsupported-authority check precedes full CLI argument parsing and is repeated
at both aggregate-teardown entry and the post-action cleanup boundary, so
argument errors or an action-time pointer replacement cannot reopen cleanup.
Aggregate teardown treats pointer absence or its zero tombstone as an empty
authority only after proving the complete recognized target inventory is also
zero/empty. Otherwise it requires the supported pointer, generation, and exact
three-credential graph. Exact identities and bytes remain bound and are
revalidated through credential, auxiliary, current-generation, and pointer-last
retirement. The resulting all-zero inventory is the sole idempotent retired
state. **Pre-retirement failure.** Only when the failure occurred before any
retirement or mutation and the supported authority still authenticates exactly,
the same confirmed command may be retried. **Partial or uncertain retirement.**
After any possible mutation—including a truncate/fsync/close failure after
mutation, a digest or generation mismatch, or any mixed authority state—no
in-application retry or cleanup is authorized. Preserve source work according
to operator policy, then externally discard and recreate the disposable
worktree from a clean checkout; never copy ignored fixture authority into the
replacement checkout.

## Revisit when

- Music should be created only on first use instead of after onboarding.
- Teams, venues, or workspaces must own Music content independently of a person.
- Core personal Music becomes subscription-gated.
- Data volume or lifecycle cost makes automatic projection materially harmful.
