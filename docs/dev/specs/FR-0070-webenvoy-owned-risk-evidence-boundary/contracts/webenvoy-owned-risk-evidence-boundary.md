# WebEnvoy-Owned Risk Evidence Boundary Contract

## 1. `WebEnvoyRiskEvidenceBoundaryV1`

```ts
interface WebEnvoyRiskEvidenceBoundaryV1 {
  boundary_id: "webenvoy_owned_risk_evidence_boundary"
  boundary_version: "v1"
  owner_ref: "#1183" | "FR-0070"
  provider_stealth_boundary_ref: string
  accepted_evidence_classes: WebEnvoyRiskEvidenceClass[]
  non_proofs: WebEnvoyRiskNonProof[]
  required_bindings: WebEnvoyRiskBindingField[]
  state_enum: WebEnvoyRiskEvidenceState[]
  blocking_reasons: WebEnvoyRiskBlockingReason[]
  provider_consumption_boundary: ProviderStealthRiskConsumptionBoundary
  closeout_audit_boundary: RiskEvidenceCloseoutAuditBoundary
  handoff_refs: WebEnvoyRiskHandoffRefs
}
```

约束：

- `boundary_version` 当前只允许 `v1`。
- `provider_stealth_boundary_ref` 必须指向 `FR-0069.provider_owned_stealth_boundary.v1` 或 later compatible formal ref。
- 该对象是 boundary declaration，不是 provider-owned stealth boundary、account safety result、live evidence record、risk hint consumer gate、read/write gate decision 或 Syvert normalized result。
- Consumer 遇到缺失的 required field、未识别 enum 或影响目标 capability 的未分类状态时，必须 fail-closed。

## 2. Risk evidence classes

```ts
type WebEnvoyRiskEvidenceClass =
  | "provider_stealth_boundary_ref"
  | "provider_limitation_ref"
  | "provider_redacted_evidence_ref"
  | "runtime_target_binding_ref"
  | "account_safety_ref"
  | "extension_native_bridge_ref"
  | "default_lock_ref"
  | "operator_unlock_ref"
  | "live_evidence_gate_ref"
  | "behavior_baseline_ref"
  | "route_evidence_ref"
  | "closeout_audit_ref"
  | "manual_risk_disposition_ref"
```

约束：

- Evidence class presence does not mean risk allow.
- Provider-related classes must remain opaque/redacted refs under `FR-0069`, `FR-0040`, and `FR-0041`.
- `account_safety_ref` consumes `FR-0066` / #1176 account safety gate semantics; #1187 account safety signal integration may provide a sibling input later, but this contract does not redefine account safety clear.
- `operator_unlock_ref`, `default_lock_ref`, and `live_evidence_gate_ref` are sibling/downstream refs, not gate allow.

## 3. Risk evidence state

```ts
type WebEnvoyRiskEvidenceState =
  | "accepted"
  | "blocked"
  | "unclassified"
  | "missing"
  | "stale"
  | "scope_mismatch"
  | "redaction_invalid"
  | "provider_private_boundary_violation"
```

约束：

- Only `accepted` can be passed to #1188 as a necessary risk hint input.
- `accepted` does not itself mean read/write gate allow.
- Unknown state values must fail closed with `risk_evidence_unclassified`.
- `redaction_invalid` and `provider_private_boundary_violation` must not be downgraded to warning.

## 4. Binding fields

```ts
type WebEnvoyRiskBindingField =
  | "workflow_ref"
  | "capability_level"
  | "target_domain"
  | "target_page"
  | "profile_ref"
  | "browser_channel"
  | "execution_surface"
  | "provider_ref"
  | "provider_stealth_boundary_ref"
  | "account_safety_ref"
  | "runtime_target_binding_ref"
  | "head_sha"
  | "run_id"
  | "evaluation_context_ref"
  | "evidence_collected_at"
  | "artifact_identity"
```

Rules:

- `run_id` may be absent only when `evaluation_context_ref` is a machine-checkable non-runtime planning context.
- Real live/account-touching evaluations must provide both `run_id` and `evidence_collected_at`.
- Any binding drift returns `state="stale"` or `state="scope_mismatch"` and blocks downstream allow.

## 5. Risk evidence scope

```ts
interface WebEnvoyRiskEvidenceScopeV1 {
  schema_version: "webenvoy-risk-evidence-boundary.v1"
  workflow_ref: string
  capability_level:
    | "read_only"
    | "write_admit"
    | "write_prepare"
    | "live_write_commit"
    | "closeout"
  target_domain: string
  target_page: string
  profile_ref: string
  browser_channel: string
  execution_surface: "real_browser" | "formal_spec" | "diagnostic" | "stub" | "fake_host"
  provider_ref: string
  provider_stealth_boundary_ref: string
  account_safety_ref: string | null
  runtime_target_binding_ref: string | null
  head_sha: string
  run_id: string | null
  evaluation_context_ref: string
  artifact_identity: string | null
}
```

Rules:

- `formal_spec` is allowed only for spec samples and static review; it cannot produce current risk accepted for runtime/live gates.
- `stub` and `fake_host` cannot satisfy live/account-touching closeout or #1188 gate allow.
- `account_safety_ref` is required for `write_prepare` and `live_write_commit`.
- `runtime_target_binding_ref` is required when the downstream gate depends on current browser/page/profile binding.

## 6. Evidence refs

```ts
interface WebEnvoyRiskEvidenceRefV1 {
  evidence_class: WebEnvoyRiskEvidenceClass
  ref: string
  owner_ref: string
  sensitivity: "public" | "internal" | "sensitive" | "secret"
  redaction_state:
    | "redacted"
    | "redaction_required"
    | "not_required"
    | "policy_missing"
    | "invalid"
  freshness_ref: string | null
  collected_at: string | null
  expires_at: string | null
  artifact_identity: string | null
}
```

Rules:

- Refs are locators only. They must not inline Cookie, token, account identifier, raw profile path, browser path, private patch body, raw fingerprint seed, page content, media content or secret-bearing payloads.
- `sensitivity=secret` is permitted only as an opaque secret handle or redacted locator.
- `redaction_state=redaction_required|policy_missing|invalid` blocks required evidence.
- `collected_at` and either `freshness_ref` or `expires_at` are required for real evaluations.

## 7. Gate input

```ts
interface RiskEvidenceGateInputV1 {
  schema_version: "webenvoy-risk-evidence-boundary.v1"
  requested_scope: WebEnvoyRiskEvidenceScopeV1
  provider_boundary_ref: string
  evidence_refs: WebEnvoyRiskEvidenceRefV1[]
  non_proofs_observed: WebEnvoyRiskNonProof[]
  evaluated_at: string
}
```

Rules:

- Missing `provider_boundary_ref` returns `risk_state="blocked"` unless target capability is explicitly independent from provider stealth and still has other required evidence.
- `non_proofs_observed` may be logged but cannot produce `risk_state="accepted"`.
- Unknown evidence class or missing required class must fail closed.

## 8. Gate result

```ts
interface RiskEvidenceGateResultV1 {
  schema_version: "webenvoy-risk-evidence-boundary.v1"
  risk_state: WebEnvoyRiskEvidenceState
  decision: "allow_input_to_1188" | "deny" | "defer"
  blocking_reasons: WebEnvoyRiskBlockingReason[]
  risk_evidence_ref: string | null
  evidence_refs_consumed: string[]
  evaluated_at: string
  downstream_owner: "#1188" | "account_safety_owner" | "runtime_owner" | "provider_owner" | "live_evidence_owner" | "none"
}
```

Rules:

- `decision=allow_input_to_1188` is valid only when `risk_state=accepted` and `blocking_reasons=[]`.
- `decision=allow_input_to_1188` does not mean read/write gate allow; it only hands accepted risk input to #1188.
- If `blocking_reasons` is non-empty, `decision` must be `deny` or `defer`.
- `defer` requires a concrete `downstream_owner`.

## 9. Non-proofs

```ts
type WebEnvoyRiskNonProof =
  | "provider_stealth_declared"
  | "provider_contract_present"
  | "provider_descriptor_present"
  | "provider_capability_matrix_present"
  | "provider_registry_row_present"
  | "provider_doctor_pass"
  | "provider_health_pass"
  | "runtime_ping"
  | "runtime_bootstrap_ack"
  | "fingerprint_seed_ref_present"
  | "private_patch_ref_present"
  | "account_safety_issue_closed"
  | "operator_unlock_present"
  | "default_lock_present"
  | "live_evidence_gate_present"
  | "historical_artifact"
  | "same_head_historical_artifact"
  | "post_merge_evidence"
  | "stub_or_fake_host"
  | "control_plane_only_signal"
  | "dry_run_only_output"
  | "spec_sample_or_fixture"
```

Rules:

- Non-proof may explain context or blocker classification but cannot produce `risk_state=accepted`.

## 10. Blocking reasons

```ts
type WebEnvoyRiskBlockingReason =
  | "risk_evidence_missing"
  | "risk_evidence_unclassified"
  | "risk_evidence_stale"
  | "risk_evidence_scope_mismatch"
  | "risk_evidence_head_mismatch"
  | "risk_evidence_run_mismatch"
  | "risk_evidence_profile_mismatch"
  | "risk_evidence_page_mismatch"
  | "risk_evidence_provider_mismatch"
  | "risk_evidence_redaction_invalid"
  | "provider_stealth_boundary_missing"
  | "provider_stealth_boundary_unresolved"
  | "provider_stealth_non_proof"
  | "provider_private_patch_disclosed"
  | "provider_private_patch_required_but_unverified"
  | "account_safety_required"
  | "account_safety_not_clear"
  | "runtime_target_binding_required"
  | "runtime_target_binding_not_accepted"
  | "extension_native_bridge_required"
  | "default_lock_required"
  | "operator_unlock_required"
  | "live_evidence_required"
  | "behavior_baseline_required"
  | "route_evidence_required"
  | "closeout_audit_required"
  | "stub_or_fake_host_evidence"
  | "control_plane_only_signal"
  | "historical_or_stale_evidence"
  | "risk_hint_consumer_required"
  | "downstream_owner_required"
```

Rules:

- `risk_hint_consumer_required` is a handoff blocker to #1188, not a #1183-defined read/write gate result.
- `provider_private_patch_disclosed` and `risk_evidence_redaction_invalid` are hard blockers.
- Unknown blocking reasons must fail closed.

## 11. Provider consumption boundary

```ts
interface ProviderStealthRiskConsumptionBoundary {
  provider_stealth_owner: "#1182" | "FR-0069"
  allowed_provider_refs:
    | "provider_owned_stealth_boundary_ref"
    | "provider_contract_ref"
    | "provider_id"
    | "provider_mode"
    | "owned_domain"
    | "limitation_ref"
    | "redacted_evidence_ref"
    | "freshness_ref"
    | "scope_binding"
    | "blocking_reason"
  forbidden_provider_inputs:
    | "private_patch_payload"
    | "raw_fingerprint_seed"
    | "stealth_raw_value"
    | "browser_binary_diff"
    | "driver_internal_state"
    | "fingerprint_internals_snapshot"
    | "worker_or_kernel_patch_detail"
}
```

Rules:

- Any forbidden provider input invalidates the evidence and must produce a blocker.
- Allowed provider refs are context/blocker inputs, not proof of risk acceptance.

## 12. Closeout audit boundary

```ts
interface RiskEvidenceCloseoutAuditBoundary {
  required_for_closeout: true
  requires_latest_head_or_current_main: true
  requires_fresh_run_for_live_or_account_touching: true
  requires_blocker_split_handling: true
  forbidden_closeout_inputs: WebEnvoyRiskNonProof[]
}
```

Rules:

- Closeout must identify current head/main, run/evaluation context, artifact identity, evidence class coverage and blocker split.
- Fallback product value cannot substitute for formal closeout evidence.
- Historical or post-merge evidence must be labeled as context, not pre-merge proof.

## 13. Handoff refs

```ts
interface WebEnvoyRiskHandoffRefs {
  provider_stealth_owner: "#1182" | "FR-0069"
  webenvoy_risk_evidence_owner: "#1183" | "FR-0070"
  risk_hint_consumer_owner: "#1188"
  account_safety_gate_owner: "#1176" | "FR-0066"
  account_safety_signal_integration_owner: "#1187"
  parent_phase_ref: "#1118"
}
```

Rules:

- #1188 must consume #1183 / FR-0070 risk evidence semantics and must not infer gate allow from provider stealth presence.
- FR-0066 / #1176 account safety gate remains the base contract, and #1187 account safety signal integration remains a sibling input; neither replaces risk evidence or #1188 gate allow.

## 14. Minimum valid example payloads

### 14.1 Formal spec planning input

This payload is valid only as formal planning input. It cannot be used as runtime risk accepted or live closeout evidence.

```json
{
  "schema_version": "webenvoy-risk-evidence-boundary.v1",
  "requested_scope": {
    "schema_version": "webenvoy-risk-evidence-boundary.v1",
    "workflow_ref": "FR-0070.formal-spec-review",
    "capability_level": "closeout",
    "target_domain": "N/A",
    "target_page": "N/A",
    "profile_ref": "N/A",
    "browser_channel": "N/A",
    "execution_surface": "formal_spec",
    "provider_ref": "FR-0069.provider_owned_stealth_boundary.v1",
    "provider_stealth_boundary_ref": "FR-0069.provider_owned_stealth_boundary.v1",
    "account_safety_ref": null,
    "runtime_target_binding_ref": null,
    "head_sha": "a16bcdf8a7f5245fcda0ee587bbd2f0b9999377b",
    "run_id": null,
    "evaluation_context_ref": "issue:#1183",
    "artifact_identity": null
  },
  "provider_boundary_ref": "FR-0069.provider_owned_stealth_boundary.v1",
  "evidence_refs": [
    {
      "evidence_class": "provider_stealth_boundary_ref",
      "ref": "docs/dev/specs/FR-0069-provider-owned-stealth-boundary/spec.md",
      "owner_ref": "FR-0069",
      "sensitivity": "public",
      "redaction_state": "not_required",
      "freshness_ref": "origin/main@a16bcdf8a7f5245fcda0ee587bbd2f0b9999377b",
      "collected_at": null,
      "expires_at": null,
      "artifact_identity": null
    }
  ],
  "non_proofs_observed": [
    "spec_sample_or_fixture"
  ],
  "evaluated_at": "N/A"
}
```

### 14.2 Redaction blocker result

```json
{
  "schema_version": "webenvoy-risk-evidence-boundary.v1",
  "risk_state": "redaction_invalid",
  "decision": "deny",
  "blocking_reasons": [
    "risk_evidence_redaction_invalid",
    "provider_private_patch_disclosed"
  ],
  "risk_evidence_ref": null,
  "evidence_refs_consumed": [],
  "evaluated_at": "N/A",
  "downstream_owner": "provider_owner"
}
```
