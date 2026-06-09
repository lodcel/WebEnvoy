# cloakbrowser.cloakserve Descriptor Contract

## 1. Contract shape

```ts
interface CloakBrowserCloakserveDescriptor {
  descriptor_id: "cloakbrowser.cloakserve"
  descriptor_version: "v1"
  descriptor_owner: "#1148" | "FR-0051"
  provider_identity: CloakBrowserCloakserveProviderIdentity
  provider_mode: "external_managed"
  engine: CloakBrowserCloakserveEngine
  transport: CloakBrowserCloakserveTransport
  extension_workflow: CloakBrowserCloakserveExtensionWorkflow
  capability_declaration_refs: CloakBrowserCloakserveCapabilityRefs
  limitation_refs: CloakBrowserCloakserveLimitationRef[]
  evidence_reference_slots: CloakBrowserCloakserveEvidenceSlot[]
  downstream_owners: CloakBrowserCloakserveDownstreamOwners
  out_of_scope: CloakBrowserCloakserveOutOfScope[]
}
```

约束：

- This descriptor is a static provider-specific descriptor carrier.
- It is not runtime state, health output, launch evidence, live evidence, fixture data or a CloakBrowser patch manifest.
- Consumers must validate the descriptor id, version, owner, limitation refs and evidence slots before using it as #1148 input.

## 2. Provider identity

```ts
interface CloakBrowserCloakserveProviderIdentity {
  provider_id: "cloakbrowser.cloakserve"
  provider_family: "managed_browser_provider"
  provider_version: "v1"
  contract_version: "v1"
  distribution_channel: "experimental"
  implementation_owner: "external_provider"
}
```

Mapping:

- `provider_family` maps to `FR-0033.BrowserProviderIdentity.provider_family`.
- `contract_version=v1` maps to `FR-0033.browser_provider_contract.v1`.
- `distribution_channel=experimental` requires explicit downstream opt-in and cannot be treated as default runtime eligibility.

## 3. Engine descriptor

```ts
interface CloakBrowserCloakserveEngine {
  engine_family: "chromium"
  browser_channel: "CloakBrowser Chromium"
  browser_version_range: "provider_managed"
  headless_policy: "unknown"
  extension_binding_support: "none"
  profile_binding_support: "unknown"
}
```

Fail-closed rules:

- `headless_policy=unknown` cannot satisfy real-browser, headed anti-detection or latest-head live evidence requirements.
- `extension_binding_support=none` must block WebEnvoy extension runtime, relay bridge, content script and Native Messaging capabilities.
- `profile_binding_support=unknown` must block profile-bound capabilities unless a downstream owner supplies narrower evidence and policy.

## 4. Transport descriptor

```ts
interface CloakBrowserCloakserveTransport {
  transport_kind: "cdp"
  transport_owner: "provider"
  command_surface: Array<
    | "runtime_control"
    | "page_automation"
    | "diagnostics"
    | "artifact_passthrough"
  >
  attach_model: "provider_brokered"
  native_messaging_support: "none"
  cdp_support: "supported"
  playwright_support: "supported"
}
```

Constraints:

- `cdp_support=supported` means only that a downstream consumer may attach through a provider-brokered CDP surface after admission.
- CDP support does not prove endpoint safety, process isolation, profile ownership, runtime readiness or target-page behavior.
- Native Messaging remains unsupported for this descriptor.
- Target-site HTTP still must happen inside the browser process.

## 5. Extension workflow descriptor

```ts
interface CloakBrowserCloakserveExtensionWorkflow {
  default_extension_binding: "disabled"
  webenvoy_extension_bridge: "unsupported_by_default"
  native_messaging_bridge: "unsupported"
  extension_paths_input: "experimental_reference_only"
  extension_runtime_evidence: "not_provided_by_descriptor"
  extension_workflow_owner: "future_owner"
}
```

Rules:

- WebEnvoy extension binding is disabled by default for `cloakbrowser.cloakserve`.
- Upstream extension loading support is not WebEnvoy extension bridge readiness.
- `extension_paths_input=experimental_reference_only` may be used only by a future opt-in owner.
- Any capability requiring extension runtime, service worker freshness, content script relay, Native Messaging or WebEnvoy extension identity must deny by default.

## 6. Capability refs

```ts
interface CloakBrowserCloakserveCapabilityRefs {
  provider_contract_ref: "FR-0033.browser_provider_contract.v1"
  verification_model_ref: "FR-0035.provider_capability_verification_model"
  capability_matrix_owner: "#1149"
  limitation_gate_owner: "#1152"
}
```

Constraints:

- This object contains references only.
- It does not define supported actions, execution layers, verification thresholds, default eligibility or degraded states.

## 7. Limitation refs

```ts
type CloakBrowserCloakserveLimitationRef =
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

Minimum consumer rule:

- #1149 and #1152 must treat these limitation refs as deny / blocked inputs when they affect the requested capability and no narrower downstream evidence exists.
- `cloakserve_provider_private_patch_required` must never expand into a WebEnvoy core patch schema.

## 8. Evidence slots

```ts
type CloakBrowserCloakserveEvidenceSlot =
  | "static_descriptor_ref"
  | "provider_contract_ref"
  | "registry_entry_ref"
  | "capability_matrix_ref"
  | "limitation_gate_ref"
  | "health_result_ref"
  | "launch_evidence_ref"
  | "fixture_ref"
```

Slot lifecycle:

- `static_descriptor_ref` and descriptor-level `provider_contract_ref` are supplied by this suite.
- `capability_matrix_ref` is owned by #1149.
- `limitation_gate_ref` is owned by #1152.
- `health_result_ref`, `launch_evidence_ref` and `fixture_ref` are future owner outputs.
- Slot existence is not evidence availability.

## 9. Downstream owners

```ts
interface CloakBrowserCloakserveDownstreamOwners {
  capability_matrix: "#1149"
  limitation_gate: "#1152"
  health: "future CloakBrowser health owner"
  launch_evidence: "future CloakBrowser launch evidence owner"
  fixtures: "future CloakBrowser fixture owner"
}
```

## 10. Out of scope

```ts
type CloakBrowserCloakserveOutOfScope =
  | "runtime_implementation"
  | "provider_selection"
  | "limitation_gate_implementation"
  | "capability_matrix_rows"
  | "health_result_schema"
  | "launch_evidence_record"
  | "fresh_live_evidence"
  | "fixture_payload"
  | "webenvoy_extension_install"
  | "native_messaging_bridge"
  | "cloakbrowser_private_patch_schema"
  | "syvert_normalized_result"
  | "xhs_business_semantics"
```

## 11. Minimal static example

```json
{
  "descriptor_id": "cloakbrowser.cloakserve",
  "descriptor_version": "v1",
  "descriptor_owner": "#1148",
  "provider_identity": {
    "provider_id": "cloakbrowser.cloakserve",
    "provider_family": "managed_browser_provider",
    "provider_version": "v1",
    "contract_version": "v1",
    "distribution_channel": "experimental",
    "implementation_owner": "external_provider"
  },
  "provider_mode": "external_managed",
  "engine": {
    "engine_family": "chromium",
    "browser_channel": "CloakBrowser Chromium",
    "browser_version_range": "provider_managed",
    "headless_policy": "unknown",
    "extension_binding_support": "none",
    "profile_binding_support": "unknown"
  },
  "transport": {
    "transport_kind": "cdp",
    "transport_owner": "provider",
    "command_surface": ["runtime_control", "page_automation", "diagnostics", "artifact_passthrough"],
    "attach_model": "provider_brokered",
    "native_messaging_support": "none",
    "cdp_support": "supported",
    "playwright_support": "supported"
  },
  "extension_workflow": {
    "default_extension_binding": "disabled",
    "webenvoy_extension_bridge": "unsupported_by_default",
    "native_messaging_bridge": "unsupported",
    "extension_paths_input": "experimental_reference_only",
    "extension_runtime_evidence": "not_provided_by_descriptor",
    "extension_workflow_owner": "future_owner"
  },
  "capability_declaration_refs": {
    "provider_contract_ref": "FR-0033.browser_provider_contract.v1",
    "verification_model_ref": "FR-0035.provider_capability_verification_model",
    "capability_matrix_owner": "#1149",
    "limitation_gate_owner": "#1152"
  },
  "limitation_refs": [
    "cloakserve_external_lifecycle",
    "cloakserve_distribution_experimental",
    "cloakserve_headless_policy_unknown",
    "cloakserve_profile_binding_unknown",
    "cloakserve_default_extension_disabled",
    "cloakserve_extension_workflow_experimental_only",
    "cloakserve_no_webenvoy_extension_binding",
    "cloakserve_no_native_messaging",
    "cloakserve_no_descriptor_level_runtime_readiness",
    "cloakserve_no_latest_head_live_evidence",
    "cloakserve_cdp_endpoint_security_not_attested",
    "cloakserve_provider_private_patch_required"
  ],
  "evidence_reference_slots": [
    "static_descriptor_ref",
    "provider_contract_ref",
    "registry_entry_ref",
    "capability_matrix_ref",
    "limitation_gate_ref",
    "health_result_ref",
    "launch_evidence_ref",
    "fixture_ref"
  ]
}
```
