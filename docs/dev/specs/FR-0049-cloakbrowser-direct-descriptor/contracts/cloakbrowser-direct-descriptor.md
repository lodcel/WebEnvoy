# cloakbrowser.direct Descriptor Contract

## 1. `cloakbrowser_descriptor`

```ts
interface CloakBrowserDescriptor {
  descriptor_id: "cloakbrowser.direct"
  descriptor_version: "v1"
  common_shape_owner: "#1146" | "FR-0049"
  variant_kind: "direct"
  provider_identity: CloakBrowserProviderIdentity
  provider_mode: "core_managed" | "external_managed" | "adapter_only" | "diagnostic_only"
  engine: CloakBrowserEngineDescriptor
  transport: CloakBrowserTransportDescriptor
  profile_semantics: CloakBrowserDirectProfileSemantics
  extension_path_handling: CloakBrowserDirectExtensionPathHandling
  final_args_evidence: CloakBrowserDirectFinalArgsEvidence
  fingerprint_seed_boundary: CloakBrowserFingerprintSeedBoundary
  capability_declaration_refs: CapabilityDeclarationRef[]
  limitation_refs: LimitationRef[]
  evidence_reference_slots: EvidenceReferenceSlot[]
  downstream_owners: DownstreamOwnerRefs
  out_of_scope: OutOfScopeRef[]
}
```

约束：

- `descriptor_version` 当前只允许 `v1`。
- `variant_kind=direct` 是本 FR 唯一落成的 variant。
- `common_shape_owner` 由 `#1146` / `FR-0049` 持有。
- descriptor 是 provider-specific carrier，不是 runtime status、health result、launch evidence、live evidence record、fixture、private patch manifest 或 Syvert mapping。

## 2. Provider identity

```ts
interface CloakBrowserProviderIdentity {
  provider_id: "cloakbrowser.direct"
  provider_family: "managed_browser_provider"
  provider_version: "v1"
  contract_version: "v1"
  distribution_channel: "external_adapter"
  implementation_owner: "cloakbrowser_provider_adapter"
}
```

约束：

- `provider_id` 必须稳定唯一。
- identity 可映射到 `FR-0033.BrowserProviderIdentity`，但不证明 adapter installed、provider licensed、runtime ready 或 live evidence attested。
- `provider_family=managed_browser_provider` 不把 CloakBrowser 变成 WebEnvoy core。

## 3. Engine descriptor

```ts
interface CloakBrowserEngineDescriptor {
  engine_family: "chromium"
  browser_channel: "CloakBrowser managed Chromium"
  browser_version_range: "provider_managed"
  headless_policy: "forbidden"
  extension_binding_support: "supported"
  profile_binding_support: "none"
}
```

约束：

- `provider_managed` 只表示 browser version 由 provider / adapter 证明。
- direct variant 不承诺 persistent profile binding。
- direct variant 支持 extension path locator input，但不承诺 stable extension identity。
- headless launch 不得满足 real-browser 或 live evidence gate。

## 4. Transport descriptor

```ts
interface CloakBrowserTransportDescriptor {
  transport_kind: "hybrid"
  transport_owner: "provider"
  command_surface: Array<"runtime_control" | "page_automation" | "diagnostics" | "artifact_passthrough">
  attach_model: "launch"
  native_messaging_support: "none"
  cdp_support: "supported"
  playwright_support: "supported"
}
```

约束：

- `hybrid` 表达 provider-managed launch plus WebEnvoy adapter / Playwright / CDP orchestration。
- `native_messaging_support=none` 不定义 persistent variant 的 Native Messaging delta。
- transport 声明不得绕过浏览器内执行原则直接对目标站点发 HTTP 请求。

## 5. Profile semantics

```ts
interface CloakBrowserDirectProfileSemantics {
  profile_kind: "ephemeral_provider_profile"
  profile_persistence: "not_guaranteed"
  login_state_reuse: "not_promised"
  profile_locking: "not_promised"
  cleanup_expectation: "provider_managed_best_effort_cleanup"
  persistent_delta_owner: "#1147"
}
```

约束：

- direct variant 不承诺长期登录态恢复。
- direct variant 不承诺跨 run profile persistence。
- direct variant 不定义 persistent profile path、profile lock、extension identity、native host binding 或 account safety health schema。

## 6. Extension path handling

```ts
interface CloakBrowserDirectExtensionPathHandling {
  extension_input_source: "FR-0037.launch_envelope.runtime_bindings.extension_paths"
  extension_binding_mode: "dev_unpacked_extension"
  accepted_locator_kinds: Array<"extension_asset_ref" | "workspace_artifact_ref">
  path_materialization_owner: "launch_admission_or_adapter"
  path_redaction_policy: "redacted_locator_only"
  stable_extension_identity: "not_promised"
}
```

约束：

- extension paths 必须来自 `FR-0037.launch_envelope.runtime_bindings.extension_paths`。
- descriptor 只允许 redacted locator / artifact ref；不得内联 full local sensitive path、secret、Cookie、token、proxy credential 或 fingerprint seed。
- launch-time materialized path 不得作为 descriptor static field 落库。
- `dev_unpacked_extension` 不改变 official Chrome persistent extension 主路径。

## 7. Final args evidence

```ts
interface CloakBrowserDirectFinalArgsEvidence {
  evidence_kind: "redacted_final_args_snapshot"
  evidence_owner: "future_launch_evidence_owner"
  freshness_requirement: "current_launch_when_required"
  allowed_disclosure: Array<
    | "arg_keys"
    | "redacted_values"
    | "extension_locator_refs"
    | "path_hashes"
    | "provider_contract_ref"
    | "launch_envelope_ref"
  >
  forbidden_disclosure: Array<
    | "full_local_paths"
    | "cookies"
    | "tokens"
    | "proxy_credentials"
    | "fingerprint_seed_values"
    | "private_patch_payload"
    | "page_content"
  >
  proves: "launch_input_shape_only"
  does_not_prove: Array<
    | "browser_honored_args"
    | "runtime_ready"
    | "health_pass"
    | "anti_detection_pass"
    | "live_evidence_attested"
  >
}
```

约束：

- final args snapshot is a future evidence slot, not evidence produced by this descriptor.
- redacted final args do not prove browser honored args, runtime readiness, health pass, anti-detection pass or live evidence.
- unknown, missing, stale or unredacted final args evidence must fail closed when required by a target capability.

## 8. Fingerprint seed boundary

```ts
interface CloakBrowserFingerprintSeedBoundary {
  seed_policy: "provider_managed"
  seed_ref_policy: "redacted_locator_only"
  patch_manifest_ref_policy: "provider_private_ref_only"
  rotation_policy: "provider_managed"
  disclosure_boundary: "no_seed_values_no_private_patch_schema"
}
```

约束：

- provider-managed seed policy does not prove the seed was applied.
- descriptor may reference redacted locators or provider-private refs only.
- descriptor must not expose seed values, stealth parameters, driver internal state or private patch schema.

## 9. Capability declaration refs

```ts
interface CapabilityDeclarationRef {
  ref_kind:
    | "browser_provider_contract_capabilities"
    | "provider_capability_verification_model"
    | "cloakbrowser_capability_matrix_owner"
  ref:
    | "FR-0033.browser_provider_contract.capabilities"
    | "FR-0035.provider_capability_verification_model"
    | "#1149"
  owner: "FR-0033" | "FR-0035" | "#1149"
}
```

约束：

- refs 只表达解引用入口。
- refs 不表达 direct variant 支持的 action、layer、verification threshold 或 matrix row。
- #1149 must consume these refs to define capability semantics.

## 10. Limitation refs

```ts
type CloakBrowserDirectLimitationRefId =
  | "direct_no_persistent_profile_guarantee"
  | "direct_no_login_state_reuse_promise"
  | "direct_extension_paths_are_locator_only"
  | "direct_no_stable_extension_identity"
  | "direct_no_native_messaging"
  | "direct_final_args_evidence_redacted_only"
  | "direct_no_descriptor_level_runtime_readiness"
  | "direct_no_latest_head_live_evidence"
  | "direct_provider_private_patch_not_core_contract"
  | "direct_fingerprint_seed_not_disclosed"

interface LimitationRef {
  limitation_ref: CloakBrowserDirectLimitationRefId
  owner: "#1146"
  downstream_consumer_refs: Array<"#1147" | "#1148" | "#1149" | "future_cloakbrowser_health_owner" | "future_cloakbrowser_evidence_owner" | "future_cloakbrowser_fixture_owner">
}
```

约束：

- limitation refs freeze direct launch boundaries only.
- limitation refs do not replace `FR-0033` fail-closed rules or define capability matrix rows.
- `direct_no_latest_head_live_evidence` only says this descriptor PR does not produce fresh evidence.

## 11. Evidence reference slots

```ts
type EvidenceReferenceSlot =
  | "static_descriptor_ref"
  | "registry_entry_ref"
  | "capability_matrix_ref"
  | "health_result_ref"
  | "launch_evidence_ref"
  | "final_args_evidence_ref"
  | "fixture_ref"
```

约束：

- slots are future reference positions, not evidence schemas.
- slot existence does not mean evidence has been generated, accepted or fresh.
- `final_args_evidence_ref` must be redacted and must consume the later evidence / redaction owner.

## 12. Downstream owners and out-of-scope refs

```ts
interface DownstreamOwnerRefs {
  persistent_delta_owner: "#1147"
  cloakserve_delta_owner: "#1148"
  capability_matrix_owner: "#1149"
  health_schema_owner: "FR-0038"
  launch_evidence_owner: "future_cloakbrowser_evidence_owner"
  fixtures_owner: "future_cloakbrowser_fixture_owner"
}

type OutOfScopeRef =
  | "persistent_specific_delta"
  | "cloakserve_specific_delta"
  | "capability_matrix_semantics"
  | "health_result_schema"
  | "launch_evidence"
  | "fresh_live_evidence"
  | "fixtures"
  | "runtime_implementation"
  | "cloakbrowser_as_core"
  | "syvert_normalized_result"
  | "xhs_business_semantics"
  | "provider_private_patch_schema"
```

约束：

- owner refs are boundary statements, not dependency completion proof.
- out-of-scope refs must be treated as forbidden scope for this suite.

## 13. `cloakbrowser.direct` 最小合法示例

```json
{
  "descriptor_id": "cloakbrowser.direct",
  "descriptor_version": "v1",
  "common_shape_owner": "#1146",
  "variant_kind": "direct",
  "provider_identity": {
    "provider_id": "cloakbrowser.direct",
    "provider_family": "managed_browser_provider",
    "provider_version": "v1",
    "contract_version": "v1",
    "distribution_channel": "external_adapter",
    "implementation_owner": "cloakbrowser_provider_adapter"
  },
  "provider_mode": "core_managed",
  "engine": {
    "engine_family": "chromium",
    "browser_channel": "CloakBrowser managed Chromium",
    "browser_version_range": "provider_managed",
    "headless_policy": "forbidden",
    "extension_binding_support": "supported",
    "profile_binding_support": "none"
  },
  "transport": {
    "transport_kind": "hybrid",
    "transport_owner": "provider",
    "command_surface": ["runtime_control", "page_automation", "diagnostics", "artifact_passthrough"],
    "attach_model": "launch",
    "native_messaging_support": "none",
    "cdp_support": "supported",
    "playwright_support": "supported"
  },
  "profile_semantics": {
    "profile_kind": "ephemeral_provider_profile",
    "profile_persistence": "not_guaranteed",
    "login_state_reuse": "not_promised",
    "profile_locking": "not_promised",
    "cleanup_expectation": "provider_managed_best_effort_cleanup",
    "persistent_delta_owner": "#1147"
  },
  "extension_path_handling": {
    "extension_input_source": "FR-0037.launch_envelope.runtime_bindings.extension_paths",
    "extension_binding_mode": "dev_unpacked_extension",
    "accepted_locator_kinds": ["extension_asset_ref", "workspace_artifact_ref"],
    "path_materialization_owner": "launch_admission_or_adapter",
    "path_redaction_policy": "redacted_locator_only",
    "stable_extension_identity": "not_promised"
  },
  "final_args_evidence": {
    "evidence_kind": "redacted_final_args_snapshot",
    "evidence_owner": "future_launch_evidence_owner",
    "freshness_requirement": "current_launch_when_required",
    "allowed_disclosure": ["arg_keys", "redacted_values", "extension_locator_refs", "path_hashes", "provider_contract_ref", "launch_envelope_ref"],
    "forbidden_disclosure": ["full_local_paths", "cookies", "tokens", "proxy_credentials", "fingerprint_seed_values", "private_patch_payload", "page_content"],
    "proves": "launch_input_shape_only",
    "does_not_prove": ["browser_honored_args", "runtime_ready", "health_pass", "anti_detection_pass", "live_evidence_attested"]
  },
  "fingerprint_seed_boundary": {
    "seed_policy": "provider_managed",
    "seed_ref_policy": "redacted_locator_only",
    "patch_manifest_ref_policy": "provider_private_ref_only",
    "rotation_policy": "provider_managed",
    "disclosure_boundary": "no_seed_values_no_private_patch_schema"
  },
  "capability_declaration_refs": [
    {
      "ref_kind": "browser_provider_contract_capabilities",
      "ref": "FR-0033.browser_provider_contract.capabilities",
      "owner": "FR-0033"
    },
    {
      "ref_kind": "provider_capability_verification_model",
      "ref": "FR-0035.provider_capability_verification_model",
      "owner": "FR-0035"
    },
    {
      "ref_kind": "cloakbrowser_capability_matrix_owner",
      "ref": "#1149",
      "owner": "#1149"
    }
  ],
  "limitation_refs": [
    {
      "limitation_ref": "direct_no_persistent_profile_guarantee",
      "owner": "#1146",
      "downstream_consumer_refs": ["#1149"]
    },
    {
      "limitation_ref": "direct_no_login_state_reuse_promise",
      "owner": "#1146",
      "downstream_consumer_refs": ["#1149"]
    },
    {
      "limitation_ref": "direct_extension_paths_are_locator_only",
      "owner": "#1146",
      "downstream_consumer_refs": ["#1149", "future_cloakbrowser_evidence_owner"]
    },
    {
      "limitation_ref": "direct_no_stable_extension_identity",
      "owner": "#1146",
      "downstream_consumer_refs": ["#1149", "future_cloakbrowser_health_owner"]
    },
    {
      "limitation_ref": "direct_no_native_messaging",
      "owner": "#1146",
      "downstream_consumer_refs": ["#1149", "future_cloakbrowser_health_owner"]
    },
    {
      "limitation_ref": "direct_final_args_evidence_redacted_only",
      "owner": "#1146",
      "downstream_consumer_refs": ["#1149", "future_cloakbrowser_evidence_owner"]
    },
    {
      "limitation_ref": "direct_no_descriptor_level_runtime_readiness",
      "owner": "#1146",
      "downstream_consumer_refs": ["#1149", "future_cloakbrowser_health_owner", "future_cloakbrowser_evidence_owner"]
    },
    {
      "limitation_ref": "direct_no_latest_head_live_evidence",
      "owner": "#1146",
      "downstream_consumer_refs": ["#1149", "future_cloakbrowser_evidence_owner"]
    },
    {
      "limitation_ref": "direct_provider_private_patch_not_core_contract",
      "owner": "#1146",
      "downstream_consumer_refs": ["#1149"]
    },
    {
      "limitation_ref": "direct_fingerprint_seed_not_disclosed",
      "owner": "#1146",
      "downstream_consumer_refs": ["#1149", "future_cloakbrowser_evidence_owner"]
    }
  ],
  "evidence_reference_slots": [
    "static_descriptor_ref",
    "registry_entry_ref",
    "capability_matrix_ref",
    "health_result_ref",
    "launch_evidence_ref",
    "final_args_evidence_ref",
    "fixture_ref"
  ],
  "downstream_owners": {
    "persistent_delta_owner": "#1147",
    "cloakserve_delta_owner": "#1148",
    "capability_matrix_owner": "#1149",
    "health_schema_owner": "FR-0038",
    "launch_evidence_owner": "future_cloakbrowser_evidence_owner",
    "fixtures_owner": "future_cloakbrowser_fixture_owner"
  },
  "out_of_scope": [
    "persistent_specific_delta",
    "cloakserve_specific_delta",
    "capability_matrix_semantics",
    "health_result_schema",
    "launch_evidence",
    "fresh_live_evidence",
    "fixtures",
    "runtime_implementation",
    "cloakbrowser_as_core",
    "syvert_normalized_result",
    "xhs_business_semantics",
    "provider_private_patch_schema"
  ]
}
```
