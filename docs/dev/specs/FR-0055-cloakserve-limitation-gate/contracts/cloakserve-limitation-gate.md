# Cloakserve Limitation Gate Contract

## Contract owner

- Owner: `#1152` / `FR-0055`
- Gate id: `cloakserve.limitation-gate.v1`
- Descriptor input: `FR-0051`
- Capability matrix input: `FR-0052`
- Verification model: `FR-0035`

This contract defines only the limitation / admission disposition for `cloakbrowser.cloakserve`. It does not define descriptor shape, capability matrix rows, health result schema, runtime status, launch evidence record, live evidence record, fixture payload, provider adapter behavior or #1153 runtime/evidence convergence.

## Gate input

```ts
interface CloakserveLimitationGateInput {
  provider_id: "cloakbrowser.cloakserve"
  capability_id: CloakserveCapabilityId
  requested_workflow: CloakserveRequestedWorkflow
  descriptor_ref: "FR-0051"
  capability_matrix_ref: "FR-0052"
  descriptor_limitation_refs: CloakserveDescriptorLimitationRef[]
  matrix_limitation_disposition: CloakserveMatrixLimitationDisposition[]
  required_runtime_requirements: string[]
  experimental_issue_ref: string | null
  evidence_refs: CloakserveGateEvidenceRef[]
  caller_intent: "business_admission" | "diagnostic_evaluation" | "artifact_passthrough" | "policy_check"
}
```

Rules:

- `experimental_issue_ref` must be a concrete GitHub issue locator when present.
- Empty or malformed refs do not unlock extension / Native Messaging / relay workflows.
- `evidence_refs` are references only and must not inline secrets, page content, local full paths, raw argv, raw seed or provider-private patch payloads.

## Requested workflows

```ts
type CloakserveRequestedWorkflow =
  | "runtime_launch"
  | "page_read"
  | "page_write"
  | "page_download"
  | "provider_diagnose"
  | "extension_runtime_bridge"
  | "native_messaging_bridge"
  | "webenvoy_relay_bridge"
  | "launch_evidence_passthrough"
  | "final_args_evidence_passthrough"
  | "fingerprint_seed_policy"
```

Unknown workflows must fail closed through `FR-0035` unsupported / blocked semantics.

## Capability ids

```ts
type CloakserveCapabilityId =
  | "browser-runtime.launch"
  | "page-automation.read"
  | "page-automation.write"
  | "page-automation.download"
  | "provider.diagnose"
  | "extension-runtime.bridge"
  | "native-bridge.messaging"
  | "artifact-passthrough.launch-evidence"
  | "artifact-passthrough.final-args-evidence"
  | "fingerprint.seed-reproducibility"
```

## Consumed limitation refs

```ts
type CloakserveDescriptorLimitationRef =
  | "cloakserve_external_lifecycle"
  | "cloakserve_distribution_experimental"
  | "cloakserve_headless_policy_unknown"
  | "cloakserve_profile_binding_unknown"
  | "cloakserve_default_extension_disabled"
  | "cloakserve_extension_workflow_experimental_only"
  | "cloakserve_no_webenvoy_extension_binding"
  | "cloakserve_no_native_messaging"
  | "cloakserve_no_descriptor_level_runtime_readiness"
  | "cloakserve_no_latest_head_live_evidence"
  | "cloakserve_cdp_endpoint_security_not_attested"
  | "cloakserve_provider_private_patch_required"
```

```ts
type CloakserveMatrixLimitationDisposition =
  | CloakserveDescriptorLimitationRef
  | "unsupported_by_default"
  | "unsupported"
  | "unknown_fail_closed"
  | "future_fr0058_required"
  | "future_fr0059_required"
  | "current_run_fr0058_required"
  | "docker_xvfb_doctor_input_allowed"
```

## Gate result

```ts
interface CloakserveLimitationGateResult {
  provider_id: "cloakbrowser.cloakserve"
  capability_id: CloakserveCapabilityId
  requested_workflow: CloakserveRequestedWorkflow
  support_state: "blocked" | "declared" | "unsupported"
  decision: "deny" | "defer"
  gate_status: "blocked" | "deferred_to_experimental_owner" | "not_applicable"
  blocking_reasons: CloakserveGateBlockingReason[]
  limitation_refs_consumed: Array<CloakserveDescriptorLimitationRef | CloakserveMatrixLimitationDisposition>
  experimental_issue_ref: string | null
  evidence_refs_required: string[]
  evidence_refs_consumed: CloakserveGateEvidenceRef[]
  downstream_owner: string | null
  verified_at: string | "N/A"
}
```

Rules:

- This contract does not emit `decision=allow`.
- `blocking_reasons` must be non-empty when `gate_status=blocked`.
- `verified_at=N/A` is valid for formal suite text; runtime implementation must use a decision time when it evaluates concrete inputs.

## Blocking reasons

```ts
type CloakserveGateBlockingReason =
  | "cloakserve_default_extension_disabled"
  | "cloakserve_no_webenvoy_extension_binding"
  | "cloakserve_no_native_messaging"
  | "cloakserve_distribution_experimental"
  | "cloakserve_headless_policy_unknown"
  | "cloakserve_profile_binding_unknown"
  | "cloakserve_cdp_endpoint_security_not_attested"
  | "cloakserve_no_descriptor_level_runtime_readiness"
  | "cloakserve_no_latest_head_live_evidence"
  | "no_extension_binding"
  | "no_native_messaging"
  | "no_real_browser_attestation"
  | "runtime_requirement_missing"
  | "verification_source_missing"
  | "verification_source_stale"
  | "evidence_ref_invalid"
  | "live_evidence_required"
  | "experimental_issue_missing"
  | "experimental_issue_scope_mismatch"
  | "experimental_issue_closed"
  | "unknown_limitation"
  | "capability_not_declared"
```

## Evidence refs

```ts
interface CloakserveGateEvidenceRef {
  kind:
    | "static_descriptor_ref"
    | "capability_matrix_ref"
    | "limitation_gate_ref"
    | "experimental_issue_ref"
    | "runtime_attestation_ref"
    | "runtime_observation_ref"
    | "live_evidence_ref"
    | "final_args_evidence_ref"
    | "fingerprint_seed_policy_ref"
    | "docker_xvfb_doctor_ref"
  ref: string
  source: string
  collected_at: string | "N/A"
  head_sha: string | "N/A"
  run_id: string | "N/A"
  scope: string
}
```

Evidence refs are carrier locators. They never prove success unless the corresponding downstream owner accepts them for the requested workflow and freshness boundary.

## Hard block rows

| requested_workflow | default support_state | default decision | required blocking reasons |
|---|---|---|---|
| `extension_runtime_bridge` | `blocked` | `deny` | `cloakserve_default_extension_disabled`, `cloakserve_no_webenvoy_extension_binding`, `no_extension_binding` |
| `native_messaging_bridge` | `blocked` | `deny` | `cloakserve_no_native_messaging`, `no_native_messaging` |
| `webenvoy_relay_bridge` | `blocked` | `deny` | `cloakserve_default_extension_disabled`, `cloakserve_no_webenvoy_extension_binding`, `no_extension_binding` |

Scoped experimental issue metadata may change these from hard block to downstream evaluation only when its scope exactly matches the provider, capability, workflow, evidence owner and freshness requirements. It cannot produce allow.
