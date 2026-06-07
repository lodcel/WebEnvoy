# Service Worker Freshness Health Contract

Canonical suite: `FR-0047-service-worker-freshness-health`
Canonical issue: `#1142`

## 1. Contract boundary

This contract defines the official Chrome persistent extension service worker freshness health delta.

It does not define a new health result schema. Implementations must emit `FR-0038.provider_doctor_report` and represent this health as an `extension_load` check.

## 2. Required FR-0038 check

```yaml
provider_doctor_report:
  identity:
    doctor_report_id: doctor-report:official-chrome-persistent-service-worker:example
    doctor_contract_version: v1
    provider_id: official-chrome.persistent
    provider_contract_version: v1
    provider_version: v1
    generated_at: "2026-06-07T00:00:00Z"
    scope: local_runtime
  checks:
    - check_id: official_chrome_persistent_service_worker_freshness
      category: extension_load
      status: pass | warn | fail | unknown
      severity: info | warning | error | fatal
      blocking: none | capability_blocking | provider_blocking
      capability_id: N/A
      summary: string
      diagnostics:
        code: string
        observed: string
        expected: string
        remediation_hint: string
      evidence_refs:
        - kind: extension_state_ref | doctor_artifact_ref
          ref: string
          status: available | partial | unavailable | not_applicable
          collected_at: iso8601
          sensitivity: public | internal | sensitive | secret
```

Constraints:

- `category` must be `extension_load`.
- This contract does not add FR-0038 enum values.
- The check is required when `FR-0043.official-chrome.persistent` requires persistent extension binding.
- Provider-level service worker freshness uses `capability_id=N/A`.
- Capability-level readiness may reference this check through FR-0038 `capability_readiness`, but this contract does not define capability matrix rows.

## 3. Diagnostic codes

Implementations must use stable machine-readable diagnostic codes. The minimum required code set is:

- `service_worker_fresh`
- `service_worker_stale`
- `service_worker_lifecycle_recoverable`
- `service_worker_expected_identity_missing`
- `service_worker_observed_identity_missing`
- `service_worker_identity_unknown`
- `service_worker_evidence_redaction_invalid`
- `service_worker_source_conflict`

Constraints:

- `service_worker_fresh` is the only code that may map to `status=pass`.
- Missing expected identity must map to `status=fail`, `severity=fatal`, and `blocking=provider_blocking`.
- Stale or mismatched observed code identity must map to `status=fail`.
- Unknown observed identity must map to `status=unknown` when extension binding is required.
- Redaction invalid must not map to `pass`.

## 4. Freshness identity inputs

The check compares expected extension bundle identity with the observed active service worker code identity.

Required input locators:

- `expected_bundle_identity_ref`
- `expected_bundle_version_or_digest_ref`
- `observed_service_worker_script_identity_ref`
- `observed_service_worker_code_digest_ref`
- `service_worker_lifecycle_state_ref`

Allowed locator forms:

- digest
- artifact id
- logical ref
- redacted path token
- report-local locator

Forbidden raw values:

- extension source code
- private absolute path
- profile path
- browser storage
- Cookie
- token
- bootstrap secret
- account identifier

## 5. Status mapping

| Diagnostic code | status | severity | blocking |
|---|---|---|---|
| `service_worker_fresh` | `pass` | `info` | `none` |
| `service_worker_lifecycle_recoverable` | `warn` | `warning` | `capability_blocking` or `provider_blocking` |
| `service_worker_stale` | `fail` | `error` | `provider_blocking` when extension binding is required |
| `service_worker_expected_identity_missing` | `fail` | `fatal` | `provider_blocking` |
| `service_worker_observed_identity_missing` | `unknown` | `error` | `provider_blocking` when extension binding is required |
| `service_worker_identity_unknown` | `unknown` | `error` | `provider_blocking` when extension binding is required |
| `service_worker_evidence_redaction_invalid` | `fail` | `error` | `provider_blocking` |
| `service_worker_source_conflict` | `fail` or `unknown` | `error` | `provider_blocking` when extension binding is required |

## 6. Evidence mapping

FR-0038 evidence refs must be compatible with FR-0040 / FR-0041:

```yaml
provider_evidence_record.evidence_refs:
  - kind: extension_binding_ref | provider_health_ref | runtime_observation_ref
    source: provider_doctor | runtime_admission | runtime_observation
    freshness: current_record | current_launch | current_pr_head | historical_background | not_applicable
    sensitivity: public | internal | sensitive | secret
    redaction_state: redacted | redaction_required | not_required | policy_missing | invalid
    artifact_identity: string | null
```

Constraints:

- Required service worker freshness evidence must not rely on `historical_background`.
- `redaction_required`, `policy_missing`, or `invalid` on required evidence must block pass.
- `sensitive` evidence must use redacted or private locators.
- `secret` evidence must use secret handles only and must not expose raw values.
- `runtime.ping`, bootstrap ack, or native bridge ready evidence does not prove service worker code freshness.

## 7. Non-overlap guarantees

This contract does not own:

- persistent extension identity health: `#1140`
- native messaging health: `#1141`
- official Chrome capability matrix: `#1139`
- launch evidence: `#1143`
- official Chrome fixtures: `#1144`
- live evidence gate: `FR-0016`
