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

### Disposable fixture authority compatibility

Raw pre-generation `.env.music.test` files are not product data and are not a
supported migration source. They are rejected without mutation or secret
reflection. Recovery requires the exact fixture project confirmation and a
guarded cleanup/re-bootstrap that validates workspace ownership, zeroes only
verified fixture artifacts, never follows credential paths found in the raw
file, and creates a fresh versioned authority bundle.

This deliberately removes the legacy auto-upgrade path. On the supported
Windows host, a destination handle strict enough to prevent a concurrent entry
replacement also prevents the replacement commit itself; a replace-compatible
handle permits the entry race. POSIX pathname replacement has the same
validate-close-to-commit class unless a separately verified exchange protocol
is introduced. Disposable fixture compatibility does not justify that
cross-platform transaction surface.

## Revisit when

- Music should be created only on first use instead of after onboarding.
- Teams, venues, or workspaces must own Music content independently of a person.
- Core personal Music becomes subscription-gated.
- Data volume or lifecycle cost makes automatic projection materially harmful.
