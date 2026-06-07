# Persistent Extension Identity Health Contract v1

## Contract Name

- `persistent_extension_identity_health_check.v1`
- Canonical suite: `FR-0045-persistent-extension-identity-health`
- Canonical issue: `#1140`

## Carrier

This contract does not define a new health result schema.

The only valid carrier is:

```yaml
provider_doctor_report:
  checks:
    - category: extension_load
      status: pass | warn | fail | not_applicable | unknown
      severity: info | warning | error | fatal
      blocking: none | capability_blocking | provider_blocking
      diagnostics: FR-0038.provider_doctor_diagnostics
      evidence_refs: FR-0038.provider_doctor_evidence_ref[]
```

All status, severity, blocking, diagnostics, evidence ref, aggregate outcome and fail-closed semantics are owned by `FR-0038`.

## Required Check Scope

The check is required when the selected provider is `official-chrome.persistent` and the consumed descriptor declares:

- `extension_binding_support=required`
- `profile_binding_support=required`
- `extension_binding_kind=persistent_profile_extension`
- `profile_persistence=required`

The check is not applicable to `official-chrome.direct`.

## Required Match Facts

The check must prove:

- expected provider id is `official-chrome.persistent`
- observed browser channel is `Google Chrome stable`
- expected extension identity ref is resolvable
- observed extension id matches the expected stable extension id
- observed manifest identity/version is traceable to the expected extension identity ref
- observed installation/source ref matches the expected profile-scoped installation ref
- observed profile binding matches the selected persistent profile ref
- observed binding does not come from an unrelated profile, ephemeral direct profile, per-run staged extension, Chromium fallback, Chrome for Testing fallback, headless-only surface, or provider patch

## Required Evidence Rules

The check must cite evidence via existing refs only:

- `FR-0038` evidence kinds: `extension_state_ref`, `profile_state_ref`, `doctor_artifact_ref`
- `FR-0040` evidence kinds: `extension_binding_ref`, `profile_binding_ref`, `browser_channel_attestation`, `provider_health_ref`

Required evidence must fail closed when:

- evidence status is `unavailable` or `partial`
- evidence freshness is stale for the consuming gate
- evidence ref is missing or invalid
- redaction state is `redaction_required`, `policy_missing`, or `invalid`
- sensitivity is understated
- raw secret, cookie, token, storage, raw profile path, or raw extension private path appears on a public or unredacted surface

## Explicit Non-Coverage

This contract does not cover:

- Native Messaging host identity, manifest registration, allowed origins, transport reachability, or bridge health
- MV3 service worker freshness, wakeability, heartbeat, or runtime message freshness
- capability support matrix
- launch evidence
- runtime attestation
- live evidence
- official Chrome fixtures
- browser/runtime implementation

## Fail-Closed Outcomes

The consuming doctor/admission layer must fail closed for `official-chrome.persistent` when:

- the required check is missing
- expected extension identity ref is missing or unresolved
- observed extension id is missing, unknown, or mismatched
- observed source / installation ref is mismatched
- observed profile binding is mismatched
- observed browser channel is not `Google Chrome stable`
- observed binding is sourced from a staged extension, ephemeral profile, unrelated profile, unsupported fallback, or provider patch
- required evidence is unavailable, partial, stale, invalid, or under-redacted
- the check claims native messaging readiness, service worker freshness, runtime bootstrap readiness, runtime attestation, or live evidence attestation as a substitute for identity/source binding match
