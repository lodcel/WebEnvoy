# FR-0059 Contract: CloakBrowser Fingerprint Seed Evidence Policy v1

Canonical Issue: #1156

## Ownership

This contract defines WebEnvoy-local CloakBrowser fingerprint seed evidence policy semantics for reproducibility claims, seed-origin classification, hash recording, and disclosure boundaries.

It does not define runtime launch behavior, health results, capability matrix rows, fingerprint generation, browser patching, private patch schema, driver internal state, fingerprint internals structure, or live evidence records.

## FingerprintSeedOrigin

```ts
type FingerprintSeedOrigin =
  | "caller_supplied"
  | "provider_generated"
  | "mixed"
  | "unknown";
```

Rules:

- Only `caller_supplied` may support a reproducibility claim.
- `provider_generated`, `mixed`, and `unknown` must not be promoted to reproducible.
- Origin classification must not expose raw seed, patch payload, or fingerprint internals.

## FingerprintSeedReproducibilityStatus

```ts
type FingerprintSeedReproducibilityStatus =
  | "reproducible"
  | "not_reproducible"
  | "blocked"
  | "unknown";
```

Rules:

- `reproducible` requires `seed_origin="caller_supplied"` plus a valid seed reference and current policy reference.
- `blocked` is required when seed proof is mixed, missing, invalid, or policy-violating.
- A reproducibility claim does not prove seed application, runtime readiness, anti-detection success, or live evidence acceptance.

## FingerprintSeedReference

```ts
interface FingerprintSeedReference {
  locator_kind: "secret_handle"
  value: "<redacted:fingerprint_seed>" | string
  sensitivity: "secret"
  redaction_state: "redacted"
}
```

Rules:

- A fingerprint seed reference must be an opaque or redacted secret handle.
- It must not contain raw seed, truncated raw seed, reversible masked seed, base64 seed, or any provider-private derived internal.

## FingerprintSeedHashScope

```ts
type FingerprintSeedHashScope =
  | "internal_diagnostic"
  | "cross_run_repro_check"
  | "capability_gate_input"
  | "health_gate_input";
```

Rules:

- `public_summary` is not a valid hash scope.
- A hash record may exist only when the seed origin is `caller_supplied`.
- A hash must be derived only from the caller-supplied seed, not from private patch payload, driver internal state, browser cache, or account-affine secret.

## FingerprintSeedHashRecord

```ts
interface FingerprintSeedHashRecord {
  seed_hash_ref: string
  seed_hash_scope: FingerprintSeedHashScope
  seed_hash_status: "recorded" | "not_recorded" | "blocked" | "unknown"
  artifact_identity: string
  policy_ref: "FR-0059.cloakbrowser_fingerprint_seed_evidence_policy.v1"
}
```

Rules:

- `seed_hash_ref` may be public only as an opaque or run-scoped ref.
- `seed_hash_value` is not a public contract field and must not appear in PR body, stdout summary, fixture, or spec sample.
- A hash record supports equality or provenance checks only; it does not substitute for raw seed proof or runtime attestation.

## ForbiddenSeedDisclosure

The following must never enter WebEnvoy core reusable contracts or public surfaces:

- raw fingerprint seed
- truncated or preview seed that is reversible
- encoded seed that preserves the original secret
- private patch payload
- private patch manifest body
- stealth parameter raw value
- driver internal state
- fingerprint internals snapshot
- reverse-derivable fingerprint derived internal

## Required fail-closed outcomes

A downstream consumer must fail closed when any of the following occurs:

- reproducibility is claimed without `seed_origin="caller_supplied"`
- `seed_origin` is `provider_generated`, `mixed`, or `unknown` but the consumer treats it as reproducible
- raw seed or reversible seed preview appears on any surface
- `seed_hash_value` appears in PR body, stdout summary, fixture, spec sample, or capability summary
- the consumer cannot prove the hash is derived only from the caller-supplied seed
- hash scope is unknown but is still used as required evidence
- a provider-private patch or fingerprint internal is copied into a reusable contract field

## Minimal valid examples

```yaml
seed_origin: caller_supplied
reproducibility_status: reproducible
seed_ref:
  locator_kind: secret_handle
  value: "<redacted:fingerprint_seed>"
  sensitivity: secret
  redaction_state: redacted
seed_hash:
  seed_hash_ref: "artifact:seed-hash:run-123"
  seed_hash_scope: cross_run_repro_check
  seed_hash_status: recorded
  artifact_identity: "artifact-123"
  policy_ref: "FR-0059.cloakbrowser_fingerprint_seed_evidence_policy.v1"
```

```yaml
seed_origin: provider_generated
reproducibility_status: blocked
seed_hash:
  seed_hash_status: blocked
```

## Invalid examples

```yaml
seed_origin: provider_generated
reproducibility_status: reproducible
```

```yaml
seed_hash_value: "abc123..."
surface: pr_body
```

```yaml
private_patch_payload:
  stealth_flag: true
```
