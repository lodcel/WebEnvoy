# CloakBrowser License Guard Contract

Canonical suite: `FR-0048-cloakbrowser-license-guard`
Canonical issue: `#1145`

## 1. Contract boundary

This contract defines the CloakBrowser license / binary redistribution guard consumed by provider selection, provider evidence, and #1212 release packaging audit.

It does not define a runtime provider adapter, descriptor, health report, launch envelope, binary discovery command, release manifest, private patch schema, or Syvert adapter payload.

## 2. Top-level shape

```ts
interface CloakBrowserLicenseGuard {
  guard_identity: CloakBrowserLicenseGuardIdentity
  redistribution_policy: CloakBrowserRedistributionPolicy
  operator_binary: CloakBrowserOperatorBinary
  license_acknowledgement: CloakBrowserLicenseAcknowledgement
  binary_source_evidence: CloakBrowserBinarySourceEvidence
  audit_consumption: CloakBrowserAuditConsumption
  blocking_reasons: CloakBrowserLicenseGuardBlockingReason[]
}
```

Constraints:

- `guard_contract_version` is currently `v1`.
- Consumers must validate redistribution policy, acknowledgement, binary source evidence, redaction state, and blocking reasons before marking CloakBrowser provider eligible.
- Unknown required enum values or required evidence gaps must fail closed.

## 3. Identity

```ts
interface CloakBrowserLicenseGuardIdentity {
  guard_id: string
  guard_contract_version: "v1"
  provider_id: string
  provider_family: "managed_browser_provider"
  canonical_issue: "#1145"
  consumed_by: Array<"#1212" | "provider_selection" | "provider_doctor" | "release_packaging_audit">
}
```

Constraints:

- `provider_id` is a logical provider id, not a browser path, binary path, vendor account id, or profile name.
- `provider_family` must remain `managed_browser_provider` unless a later formal provider contract changes the family boundary.

## 4. Redistribution policy

```ts
interface CloakBrowserRedistributionPolicy {
  bundled_binary_allowed: false
  redistribution_allowed_by_webenvoy: false
  repository_binary_allowed: false
  release_artifact_binary_allowed: false
  fixture_binary_allowed: false
  encoded_payload_allowed: false
  allowed_public_material:
    | "operator_installation_instructions"
    | "logical_provider_id"
    | "redacted_locator"
    | "evidence_ref"
    | "license_acknowledgement_ref"
    | "audit_checklist"
}
```

Constraints:

- Any `true` value for the binary / redistribution booleans is invalid in `v1`.
- Encoded, encrypted, compressed, or patched payloads that can restore CloakBrowser proprietary binary material are treated as bundled binaries.

## 5. Operator-installed binary

```ts
interface CloakBrowserOperatorBinary {
  ownership_model: "operator_installed_binary"
  binary_locator_ref: string
  binary_locator_sensitivity: "sensitive" | "secret"
  binary_locator_redaction_state: "redacted" | "redaction_required" | "policy_missing" | "invalid"
  installation_responsibility: "operator"
  download_or_redistribution_by_webenvoy: "forbidden"
}
```

Constraints:

- `binary_locator_ref` must be an opaque handle, hash locator, redacted private locator, or artifact identity; it must not be a raw private absolute path in public surfaces.
- `download_or_redistribution_by_webenvoy` must remain `forbidden`.
- Operator-installed binary does not prove provider doctor pass, runtime readiness, or live evidence acceptance.

## 6. License acknowledgement

```ts
interface CloakBrowserLicenseAcknowledgement {
  acknowledgement_id: string
  acknowledgement_version: "v1"
  operator_ref: string
  provider_id: string
  license_terms_ref: string
  acknowledged_at: string
  acknowledgement_method:
    | "operator_attestation"
    | "legal_review_ref"
    | "vendor_account_ref"
    | "manual_record"
  acknowledgement_scope:
    | "local_development"
    | "internal_testing"
    | "production_runtime"
    | "release_packaging_audit"
  acknowledgement_status:
    | "acknowledged"
    | "pending"
    | "rejected"
    | "expired"
    | "unknown"
  evidence_refs: string[]
}
```

Constraints:

- `operator_ref` must be opaque or redacted and must not expose raw account identifiers, email, phone, license key, billing data, cookie, or token.
- `license_terms_ref` is a locator or legal review reference; this contract does not copy third-party license text.
- Only `acknowledged` can satisfy required acknowledgement. All other statuses fail closed when CloakBrowser execution or #1212 audit requires the guard.
- Acknowledgement never grants WebEnvoy redistribution permission.

## 7. Binary source evidence

```ts
interface CloakBrowserBinarySourceEvidence {
  binary_source_evidence_id: string
  provider_id: string
  source_kind:
    | "operator_installed_binary"
    | "vendor_account_download"
    | "provider_broker_locator"
    | "manual_locator"
    | "unknown"
  source_ref: string
  source_owner: "operator" | "vendor" | "provider" | "unknown"
  version_ref: string
  checksum_ref: string
  installed_by: "operator" | "manual_user" | "external_system" | "unknown"
  collected_at: string
  freshness: "current_record" | "current_launch" | "current_pr_head" | "historical_background" | "not_applicable"
  sensitivity: "public" | "internal" | "sensitive" | "secret"
  redaction_state: "redacted" | "redaction_required" | "not_required" | "policy_missing" | "invalid"
  artifact_identity: string | null
  evidence_refs: string[]
}
```

Constraints:

- Required binary source evidence must not use `source_kind=unknown`, `source_owner=unknown`, or `installed_by=unknown`.
- `source_ref`, `version_ref`, and `checksum_ref` must not expose raw download credentials, raw private paths, license keys, or vendor account ids.
- `historical_background` evidence is insufficient for current release packaging closeout unless #1212 explicitly marks it as non-required background.
- `redaction_required`, `policy_missing`, or `invalid` fails closed when evidence is required.

## 8. #1212 audit consumption

```ts
interface CloakBrowserAuditConsumption {
  audit_issue: "#1212"
  required_inputs: Array<
    | "no_bundled_binary_conclusion"
    | "repository_scan_ref"
    | "release_artifact_scan_ref"
    | "license_acknowledgement_ref"
    | "binary_source_evidence_ref"
    | "redaction_policy_ref"
    | "blocking_reasons"
  >
  closeout_semantics: "audit_consumes_guard_only"
}
```

Constraints:

- #1212 consumes this guard but does not redefine the ownership model.
- #1212 audit pass does not mean CloakBrowser provider runtime, adapter, descriptor, or live evidence is complete.

## 9. Blocking reasons

```ts
type CloakBrowserLicenseGuardBlockingReason =
  | "bundled_binary_detected"
  | "redistribution_payload_detected"
  | "operator_binary_missing"
  | "operator_binary_source_unknown"
  | "license_acknowledgement_missing"
  | "license_acknowledgement_not_accepted"
  | "license_scope_mismatch"
  | "binary_source_evidence_missing"
  | "binary_source_evidence_stale"
  | "binary_source_redaction_invalid"
  | "raw_private_locator_leaked"
  | "secret_or_license_material_leaked"
  | "provider_self_declaration_only"
  | "unknown"
```

Fail-closed rules:

- Any blocking reason except an empty list blocks provider eligibility and #1212 closeout.
- `provider_self_declaration_only` blocks any attempt to replace license / binary evidence with provider self-reporting.
- `unknown` blocks required guard consumption until classified.

## 10. Minimal valid sample

```json
{
  "guard_identity": {
    "guard_id": "cloakbrowser-license-guard:v1",
    "guard_contract_version": "v1",
    "provider_id": "cloakbrowser.managed",
    "provider_family": "managed_browser_provider",
    "canonical_issue": "#1145",
    "consumed_by": ["#1212", "provider_selection", "provider_doctor", "release_packaging_audit"]
  },
  "redistribution_policy": {
    "bundled_binary_allowed": false,
    "redistribution_allowed_by_webenvoy": false,
    "repository_binary_allowed": false,
    "release_artifact_binary_allowed": false,
    "fixture_binary_allowed": false,
    "encoded_payload_allowed": false,
    "allowed_public_material": "evidence_ref"
  },
  "operator_binary": {
    "ownership_model": "operator_installed_binary",
    "binary_locator_ref": "<redacted:path:cloakbrowser-binary>",
    "binary_locator_sensitivity": "sensitive",
    "binary_locator_redaction_state": "redacted",
    "installation_responsibility": "operator",
    "download_or_redistribution_by_webenvoy": "forbidden"
  },
  "license_acknowledgement": {
    "acknowledgement_id": "ack:cloakbrowser:example",
    "acknowledgement_version": "v1",
    "operator_ref": "operator:opaque-example",
    "provider_id": "cloakbrowser.managed",
    "license_terms_ref": "legal-review-ref:cloakbrowser-terms-example",
    "acknowledged_at": "2026-06-09T00:00:00Z",
    "acknowledgement_method": "operator_attestation",
    "acknowledgement_scope": "release_packaging_audit",
    "acknowledgement_status": "acknowledged",
    "evidence_refs": ["evidence:license-ack:example"]
  },
  "binary_source_evidence": {
    "binary_source_evidence_id": "binary-source:cloakbrowser:example",
    "provider_id": "cloakbrowser.managed",
    "source_kind": "operator_installed_binary",
    "source_ref": "operator-binary-ref:opaque-example",
    "source_owner": "operator",
    "version_ref": "version-ref:opaque-example",
    "checksum_ref": "checksum-ref:sha256-redacted-example",
    "installed_by": "operator",
    "collected_at": "2026-06-09T00:00:00Z",
    "freshness": "current_record",
    "sensitivity": "sensitive",
    "redaction_state": "redacted",
    "artifact_identity": "artifact:license-guard-example",
    "evidence_refs": ["evidence:binary-source:example"]
  },
  "audit_consumption": {
    "audit_issue": "#1212",
    "required_inputs": [
      "no_bundled_binary_conclusion",
      "repository_scan_ref",
      "release_artifact_scan_ref",
      "license_acknowledgement_ref",
      "binary_source_evidence_ref",
      "redaction_policy_ref",
      "blocking_reasons"
    ],
    "closeout_semantics": "audit_consumes_guard_only"
  },
  "blocking_reasons": []
}
```
