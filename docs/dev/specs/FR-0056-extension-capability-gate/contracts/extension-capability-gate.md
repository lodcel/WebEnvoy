# Extension Capability Gate Contract

## Contract owner

- Owner: `#1153` / `FR-0056`
- Gate id: `extension.capability-gate.v1`
- Capability matrix input: `FR-0052`
- Persistent health input: `FR-0054`
- Cloakserve limitation input: `FR-0055`
- Native Messaging doctor input: `FR-0057`
- Verification model: `FR-0035`

This contract defines only the extension capability / admission disposition for CloakBrowser provider variants. It does not define descriptor shape, health result schema, runtime status, launch evidence record, live evidence record, fixture payload, provider adapter behavior or browser actions.

## Gate input

```ts
interface ExtensionCapabilityGateInput {
  provider_id:
    | "cloakbrowser.direct"
    | "cloakbrowser.persistent"
    | "cloakbrowser.cloakserve"
  variant_kind: "direct" | "persistent" | "cloakserve"
  capability_id: ExtensionCapabilityId
  requested_workflow: ExtensionRequestedWorkflow
  capability_matrix_ref: "FR-0052"
  capability_matrix_row_ref: string
  minimum_support_state: ProviderCapabilitySupportState
  required_runtime_requirements: string[]
  persistent_profile_health_ref: ExtensionGateEvidenceRef | null
  cloakserve_limitation_gate_ref: ExtensionGateEvidenceRef | null
  native_messaging_bridge_doctor_ref: ExtensionGateEvidenceRef | null
  runtime_attestation_ref: ExtensionGateEvidenceRef | null
  runtime_observation_ref: ExtensionGateEvidenceRef | null
  live_evidence_ref: ExtensionGateEvidenceRef | null
  evidence_refs: ExtensionGateEvidenceRef[]
  caller_intent:
    | "business_admission"
    | "diagnostic_evaluation"
    | "runtime_preflight"
    | "artifact_passthrough"
}
```

Rules:

- `capability_matrix_ref` is required for every provider.
- `persistent_profile_health_ref` is required only when the selected route depends on `cloakbrowser.persistent` extension/profile health.
- `cloakserve_limitation_gate_ref` is required for all `cloakbrowser.cloakserve` extension / relay / Native Messaging workflows.
- `native_messaging_bridge_doctor_ref` is required when `required_runtime_requirements` contains `native_messaging`.
- Runtime and live refs are references only; this formal suite does not generate them.

## Requested workflows

```ts
type ExtensionRequestedWorkflow =
  | "extension_runtime_bridge"
  | "webenvoy_relay_bridge"
  | "native_messaging_bridge"
  | "runtime_launch_with_extension"
  | "page_read_with_extension"
  | "page_write_with_extension"
  | "page_download_with_extension"
  | "provider_diagnose_extension"
  | "capability_admission_preflight"
```

Unknown workflows must fail closed.

## Capability ids

```ts
type ExtensionCapabilityId =
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

## Support state

```ts
type ProviderCapabilitySupportState =
  | "unsupported"
  | "declared"
  | "statically_verified"
  | "health_checked"
  | "runtime_attested"
  | "runtime_observed"
  | "live_evidence_attested"
  | "blocked"
```

## Gate result

```ts
interface ExtensionCapabilityGateResult {
  provider_id:
    | "cloakbrowser.direct"
    | "cloakbrowser.persistent"
    | "cloakbrowser.cloakserve"
  variant_kind: "direct" | "persistent" | "cloakserve"
  capability_id: ExtensionCapabilityId
  requested_workflow: ExtensionRequestedWorkflow
  support_state: ProviderCapabilitySupportState
  decision: "allow" | "deny" | "defer"
  gate_status:
    | "blocked"
    | "deferred_to_runtime_owner"
    | "deferred_to_experimental_owner"
    | "admission_ready"
    | "not_applicable"
  blocking_reasons: ExtensionGateBlockingReason[]
  matrix_refs_consumed: string[]
  health_refs_consumed: ExtensionGateEvidenceRef[]
  limitation_gate_refs_consumed: ExtensionGateEvidenceRef[]
  bridge_doctor_refs_consumed: ExtensionGateEvidenceRef[]
  runtime_refs_required: string[]
  runtime_refs_consumed: ExtensionGateEvidenceRef[]
  downstream_owner: string | null
  verified_at: string | "N/A"
}
```

Rules:

- This formal suite does not produce a concrete `decision=allow` artifact.
- `admission_ready` means only this gate's prerequisites are satisfied; it is not runtime success, target tab success, live evidence or business result success.
- Any non-empty `blocking_reasons` forces `support_state="blocked"` and `decision="deny"`.

## Evidence refs

```ts
interface ExtensionGateEvidenceRef {
  kind:
    | "capability_matrix_ref"
    | "persistent_profile_health_ref"
    | "cloakserve_limitation_gate_ref"
    | "native_messaging_bridge_doctor_ref"
    | "runtime_attestation_ref"
    | "target_tab_binding_ref"
    | "runtime_observation_ref"
    | "live_evidence_ref"
    | "redaction_record_ref"
  ref: string
  source_owner: string
  collected_at: string | "N/A"
  head_sha: string | "N/A"
  run_id: string | "N/A"
  freshness_scope:
    | "current_health_run"
    | "current_runtime_admission"
    | "current_pr_head"
    | "historical_background"
    | "N/A"
}
```

Evidence refs are carrier locators. They never inline secret material, raw local paths, page content, raw manifest, raw argv, raw seed or provider-private patch payload.

## Blocking reasons

```ts
type ExtensionGateBlockingReason =
  | "capability_not_declared"
  | "unknown_requested_workflow"
  | "matrix_ref_missing"
  | "minimum_support_state_unmet"
  | "extension_binding_missing"
  | "extension_identity_missing"
  | "extension_load_not_ready"
  | "extension_runtime_surface_missing"
  | "profile_binding_missing"
  | "profile_state_not_healthy"
  | "health_freshness_stale"
  | "native_messaging_required"
  | "native_messaging_unsupported"
  | "native_bridge_doctor_missing"
  | "native_bridge_doctor_not_ready"
  | "cloakserve_limitation_gate_missing"
  | "cloakserve_extension_bridge_blocked"
  | "cloakserve_native_messaging_blocked"
  | "runtime_attestation_required"
  | "runtime_observation_required"
  | "target_tab_binding_required"
  | "live_evidence_required"
  | "evidence_ref_invalid"
  | "source_owner_mismatch"
  | "stub_or_fake_host_evidence"
  | "stale_or_historical_evidence"
  | "redaction_invalid"
```

## Default decision table

| Condition | support_state | decision | gate_status |
|---|---|---|---|
| Matrix row missing or capability unknown | `blocked` | `deny` | `blocked` |
| `cloakbrowser.direct` requires Native Messaging | `blocked` | `deny` | `blocked` |
| `cloakbrowser.direct` requires stable extension bridge without future owner refs | `blocked` | `deny` | `blocked` |
| `cloakbrowser.persistent` missing current profile / extension health | `blocked` | `deny` | `blocked` |
| `cloakbrowser.persistent` needs Native Messaging but bridge doctor is missing or non-ready | `blocked` | `deny` | `blocked` |
| `cloakbrowser.persistent` health / doctor is ready but runtime refs are absent | `blocked` | `deny` or `defer` | `deferred_to_runtime_owner` |
| `cloakbrowser.cloakserve` extension / relay / Native Messaging workflow without accepted limitation gate disposition | `blocked` | `deny` | `blocked` |
| Matching cloakserve experimental issue permits evaluation but runtime refs are absent | `declared` | `defer` | `deferred_to_experimental_owner` |

Future implementation may return `admission_ready` only when all required current refs satisfy the requested workflow minimum.
