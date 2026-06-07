# FR-0041 Contract: Evidence Redaction Policy v1

Canonical Issue: #1129

## Ownership

This contract defines WebEnvoy-local evidence redaction policy semantics for provider evidence, launch evidence, health evidence, fixture evidence, PR summaries, stdout summaries, and artifacts.

It does not define or modify `FR-0040.provider_evidence_record`, `FR-0016.live_evidence_record`, Launch Envelope shape, provider doctor schema, redaction engine behavior, artifact storage, secret storage, Syvert normalized results, or provider adapter payloads.

## EvidenceSensitivity

```ts
type EvidenceSensitivity =
  | "public"
  | "internal"
  | "sensitive"
  | "secret";
```

Constraints:

- `public` may enter PR body, stdout summary, public artifact, fixture, and spec sample when it contains no private locator or account-affine value.
- `internal` may enter controlled internal artifacts but must not be promoted to public when it exposes local topology or environment structure.
- `sensitive` must use a policy-approved redacted locator or excerpt before it can satisfy required evidence.
- `secret` must never expose raw values in PR body, stdout summary, public artifact, fixture, spec sample, or unredacted artifact.
- Unknown sensitivity must be classified at the more conservative level.

## EvidenceRedactionState

This contract consumes the `FR-0040` redaction state enum without changing its field shape.

```ts
type EvidenceRedactionState =
  | "redacted"
  | "redaction_required"
  | "not_required"
  | "policy_missing"
  | "invalid";
```

Constraints:

- `redacted` means the disclosure boundary is satisfied; it does not mean evidence is fresh, trusted, runtime-attested, or live-accepted.
- `redaction_required`, `policy_missing`, and `invalid` must fail closed when the evidence is required.
- `not_required` is valid only for `public` evidence unless a later formal policy freezes a narrower exception.

## EvidenceLocatorKind

```ts
type EvidenceLocatorKind =
  | "public_locator"
  | "private_locator"
  | "secret_handle"
  | "artifact_locator";
```

Rules:

- `public_locator` may contain issue refs, PR refs, contract refs, run ids, artifact ids, sanitized filenames, logical provider ids, and opaque profile handles.
- `public_locator` must not contain home paths, workspace absolute paths, browser binary absolute paths, profile absolute paths, account identifiers, email, phone, Cookie values, token values, or proxy credentials.
- `private_locator` must be redacted, hashed, or opaque; it must not contain the raw private absolute path.
- `secret_handle` must be an opaque reference to secret presence; it must not be reversible from public evidence or PR metadata.
- `artifact_locator` may contain artifact identity, relative artifact path, checksum, or run-scoped ref; it must not expose private artifact roots.

## SecretClass

```ts
type SecretClass =
  | "fingerprint_seed"
  | "proxy_credential"
  | "cookie"
  | "storage_secret"
  | "auth_header"
  | "token"
  | "api_key"
  | "account_password"
  | "two_factor_seed"
  | "native_messaging_bootstrap_secret"
  | "extension_private_payload"
  | "provider_private_patch_secret";
```

Rules:

- Every `SecretClass` value has `EvidenceSensitivity="secret"`.
- Secret raw values must be replaced with `secret_handle` or a placeholder such as `<redacted:proxy_credential>`.
- Secret presence can support an evidence conclusion, but the secret raw value itself cannot be an evidence ref.
- A detected raw secret on any public or unredacted surface must produce `redaction_state="invalid"` and a secret leak blocker.

## Default classification table

| Evidence value | Default sensitivity | Required locator |
|---|---|---|
| Provider id, contract ref, contract version, provider mode | `public` | `public_locator` or inline public metadata |
| Browser channel label | `public` | inline public metadata |
| Browser version | `public` or `internal` | public metadata when not path-derived |
| Run id, PR head sha, artifact id | `public` | `public_locator` or `artifact_locator` |
| Browser binary locator | `sensitive` | `private_locator` or redacted public handle |
| Profile locator | `sensitive` | `private_locator` or opaque profile handle |
| Extension installation locator | `sensitive` | `private_locator` |
| Native Host manifest locator | `sensitive` | `private_locator` |
| Allowed origin source | `sensitive` | `private_locator` or redacted origin ref |
| Network / regional config locator | `sensitive` | `private_locator` |
| Fingerprint policy locator | `sensitive` | `private_locator` |
| Raw argv, env, command output with local paths | `sensitive` | redacted excerpt or private locator |
| Account identifier | `sensitive` | hashed or opaque account ref |
| Fingerprint seed, proxy credential, Cookie, storage secret, auth header, token, API key | `secret` | `secret_handle` only |

## DisclosureSurface

```ts
type DisclosureSurface =
  | "pr_body"
  | "stdout_summary"
  | "public_artifact"
  | "internal_artifact"
  | "fixture"
  | "spec_sample";
```

Allowed content by surface:

- `pr_body`: public metadata, public locator, redacted locator, structured blocker, validation command, head sha, and run id.
- `stdout_summary`: public metadata, redacted locator, and structured blocker.
- `public_artifact`: redacted evidence object and sanitized fixture.
- `internal_artifact`: redacted/private locator and diagnostic excerpt without raw secret values.
- `fixture`: synthetic, opaque, or redacted values only.
- `spec_sample`: synthetic, opaque, or redacted values only.

Forbidden on every surface except a future secure storage policy:

- raw secret values
- raw private absolute paths
- raw account identifiers
- raw browser profile paths
- raw browser binary paths
- raw credential-bearing argv or env

## Required fail-closed outcomes

An evidence consumer must fail closed when required evidence has any of:

- `redaction_state="redaction_required"`
- `redaction_state="policy_missing"`
- `redaction_state="invalid"`
- secret raw value detected
- public locator containing raw private path
- public locator containing raw account identifier
- sensitivity lower than this contract's default classification
- fixture or spec sample containing real secret, account, profile, binary path, or private absolute path

## FR-0040 consumption boundary

FR-0040 consumers may apply this contract to existing `provider_evidence_record.evidence_refs[*].sensitivity` and `provider_evidence_record.evidence_refs[*].redaction_state`.

This contract does not add fields to:

- `provider_evidence_record`
- `provider_evidence_ref`
- `provider_evidence_closeout_plan`
- `provider_evidence_blocking_reason`

## Minimal valid examples

```yaml
profile_ref:
  locator_kind: private_locator
  value: "<redacted:path:profile>"
  sensitivity: sensitive
  redaction_state: redacted
```

```yaml
proxy_credential:
  locator_kind: secret_handle
  value: "<redacted:proxy_credential>"
  sensitivity: secret
  redaction_state: redacted
```

```yaml
browser_channel:
  value: "Google Chrome stable"
  sensitivity: public
  redaction_state: not_required
```

## Invalid examples

```yaml
profile_ref:
  locator_kind: public_locator
  value: "/absolute/private/profile/path"
  sensitivity: public
  redaction_state: not_required
```

```yaml
cookie:
  locator_kind: public_locator
  value: "raw-cookie-value"
  sensitivity: public
  redaction_state: not_required
```
