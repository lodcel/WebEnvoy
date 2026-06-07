# official Chrome Persistent Descriptor Delta Contract

## 1. Delta boundary

`FR-0043` extends the `FR-0042.official_chrome_descriptor` common shape with the persistent variant only. It does not replace the common shape.

```ts
interface OfficialChromePersistentDescriptorDelta {
  descriptor_id: "official-chrome.persistent"
  descriptor_version: "v1"
  common_shape_owner: "#1137" | "FR-0042"
  variant_kind: "persistent"
  provider_identity: OfficialChromePersistentProviderIdentity
  provider_mode: "core_managed"
  engine: OfficialChromePersistentEngineDescriptor
  transport: OfficialChromePersistentTransportDescriptor
  profile_semantics: OfficialChromePersistentProfileSemantics
  extension_binding: PersistentExtensionBindingRef
  native_messaging_readiness_refs: NativeMessagingReadinessRefs
  capability_declaration_refs: CapabilityDeclarationRef[]
  limitation_refs: PersistentLimitationRef[]
  evidence_reference_slots: EvidenceReferenceSlot[]
  downstream_owners: PersistentDownstreamOwnerRefs
  out_of_scope: PersistentOutOfScopeRef[]
}
```

约束：

- 所有 common field 的字段职责由 `FR-0042` 持有。
- 本 contract 只冻结 persistent-specific allowed values、reference slots 与 constraints。
- delta 不是 runtime status、health result、launch evidence、live evidence record 或 fixture。

## 2. Provider identity

```ts
interface OfficialChromePersistentProviderIdentity {
  provider_id: "official-chrome.persistent"
  provider_family: "official_chrome"
  provider_version: "v1"
  contract_version: "v1"
  distribution_channel: "builtin"
  implementation_owner: "webenvoy_core"
}
```

约束：

- `provider_id` 必须稳定唯一，且不得与 `official-chrome.direct` 共用。
- identity 可映射到 `FR-0033.BrowserProviderIdentity`，但不证明 runtime ready。

## 3. Engine descriptor

```ts
interface OfficialChromePersistentEngineDescriptor {
  engine_family: "chrome"
  browser_channel: "Google Chrome stable"
  browser_version_range: "system_installed"
  headless_policy: "forbidden"
  extension_binding_support: "required"
  profile_binding_support: "required"
}
```

约束：

- `Google Chrome stable` 必须保持 `FR-0033` canonical label。
- `required` 表示 persistent provider 的前置要求，不表示已验证。
- headless、Chromium fallback、Chrome for Testing fallback 或 private browser patch 不满足本 descriptor。

## 4. Transport descriptor

```ts
interface OfficialChromePersistentTransportDescriptor {
  transport_kind: "hybrid"
  transport_owner: "webenvoy_core"
  command_surface: Array<"runtime_control" | "page_automation" | "diagnostics" | "artifact_passthrough">
  attach_model: "launch"
  native_messaging_support: "required"
  cdp_support: "supported"
  playwright_support: "supported"
}
```

约束：

- `hybrid` 表示 extension / native messaging readiness refs 与 Playwright/CDP orchestration 的组合。
- 本 contract 不定义 native messaging message envelope、doctor output、runtime readiness payload 或 launch artifact。
- transport 不得绕过浏览器进程对目标站点发 HTTP 请求。

## 5. Persistent profile reference

```ts
interface OfficialChromePersistentProfileSemantics {
  profile_kind: "persistent_profile"
  profile_persistence: "required"
  login_state_reuse: "expected_when_profile_ready"
  profile_locking: "required"
  cleanup_expectation: "preserve_profile_state"
  profile_reference: PersistentProfileReference
  profile_identity_constraints: ProfileIdentityConstraint[]
}

interface PersistentProfileReference {
  ref_kind: "named_profile" | "profile_locator_ref"
  ref: string
  owner: "webenvoy_core"
  sensitivity: "non_secret_locator"
}

type ProfileIdentityConstraint =
  | "must_match_named_profile"
  | "must_not_inline_credentials"
  | "must_not_inline_cookies"
  | "must_not_inline_sensitive_absolute_path"
  | "must_require_exclusive_profile_lock"
  | "must_preserve_profile_state"
```

约束：

- `ref` 是逻辑 locator，不是 secret。
- descriptor 不自证 profile directory exists、lock acquired、login state valid 或 account safe。
- sensitive local path、cookie、token、account credential 不得进入 descriptor。

## 6. Persistent extension binding

```ts
interface PersistentExtensionBindingRef {
  extension_binding_kind: "persistent_profile_extension"
  extension_identity_ref: string
  extension_installation_ref: string
  extension_runtime_ref: string
  service_worker_readiness_ref: string
  owner: "webenvoy_core"
}
```

约束：

- refs 是 stable logical references，不是 install evidence。
- 本 contract 不冻结 extension installation method、manifest payload、Chrome Web Store / external extension / developer mode choice 或 extension runtime result schema。
- service worker readiness 必须由 runtime / health owner 判定。

## 7. Native messaging readiness refs

```ts
interface NativeMessagingReadinessRefs {
  native_host_identity_ref: string
  native_host_manifest_ref: string
  allowed_origins_ref: string
  host_registration_ref: string
  bridge_readiness_ref: string
  owner: "webenvoy_core"
}
```

约束：

- refs 表达 persistent provider readiness dependencies only。
- 本 contract 不定义 native host manifest schema、registration implementation、message envelope、doctor result 或 health result schema。
- native messaging cannot be used as an external HTTP exit for target-site requests.

## 8. Capability declaration refs

```ts
interface CapabilityDeclarationRef {
  ref_kind:
    | "browser_provider_contract_capabilities"
    | "provider_capability_verification_model"
    | "official_chrome_capability_matrix_owner"
  ref: "FR-0033.browser_provider_contract.capabilities" | "FR-0035.provider_capability_verification_model" | "#1139"
  owner: "FR-0033" | "FR-0035" | "#1139"
}
```

约束：

- refs do not express supported actions, execution layers, verification thresholds or matrix rows.
- #1139 owns capability semantics.

## 9. Limitation refs

```ts
type PersistentLimitationRefId =
  | "persistent_requires_profile_binding"
  | "persistent_requires_extension_binding"
  | "persistent_requires_native_messaging"
  | "persistent_requires_profile_identity_match"
  | "persistent_no_descriptor_level_runtime_readiness"
  | "persistent_no_latest_head_live_evidence"

interface PersistentLimitationRef {
  limitation_ref: PersistentLimitationRefId
  owner: "#1138"
  downstream_consumer_refs: Array<"#1139" | "#1140" | "#1141" | "#1142" | "#1143" | "#1144">
}
```

约束：

- limitation refs are descriptor boundaries, not a capability fail-closed matrix.
- runtime readiness, profile lock, extension runtime and native bridge readiness must be verified by downstream owners.

## 10. Evidence reference slots

```ts
type EvidenceReferenceSlot =
  | "static_descriptor_ref"
  | "registry_entry_ref"
  | "capability_matrix_ref"
  | "health_result_ref"
  | "launch_evidence_ref"
  | "fixture_ref"
```

约束：

- slots are future evidence reference positions, not evidence schema.
- `health_result_ref` consumes `FR-0038`.
- `launch_evidence_ref` consumes `FR-0040` and `FR-0041`.
- this FR only provides `static_descriptor_ref`.

## 11. Downstream owners and out-of-scope refs

```ts
interface PersistentDownstreamOwnerRefs {
  common_shape_owner: "#1137"
  capability_matrix_owner: "#1139"
  health_schema_owner: "FR-0038"
  launch_evidence_owner: "#1143"
  evidence_redaction_owner: "FR-0041"
  official_chrome_fixtures_owner: "#1144"
}

type PersistentOutOfScopeRef =
  | "common_descriptor_shape_redefinition"
  | "direct_variant_redefinition"
  | "capability_matrix_semantics"
  | "health_result_schema"
  | "launch_evidence"
  | "evidence_redaction_shape"
  | "fresh_live_evidence"
  | "fixtures"
  | "runtime_implementation"
  | "browser_patching"
  | "syvert_normalized_result"
```

## 12. `official-chrome.persistent` minimum valid example

```json
{
  "descriptor_id": "official-chrome.persistent",
  "descriptor_version": "v1",
  "common_shape_owner": "#1137",
  "variant_kind": "persistent",
  "provider_identity": {
    "provider_id": "official-chrome.persistent",
    "provider_family": "official_chrome",
    "provider_version": "v1",
    "contract_version": "v1",
    "distribution_channel": "builtin",
    "implementation_owner": "webenvoy_core"
  },
  "provider_mode": "core_managed",
  "engine": {
    "engine_family": "chrome",
    "browser_channel": "Google Chrome stable",
    "browser_version_range": "system_installed",
    "headless_policy": "forbidden",
    "extension_binding_support": "required",
    "profile_binding_support": "required"
  },
  "transport": {
    "transport_kind": "hybrid",
    "transport_owner": "webenvoy_core",
    "command_surface": ["runtime_control", "page_automation", "diagnostics", "artifact_passthrough"],
    "attach_model": "launch",
    "native_messaging_support": "required",
    "cdp_support": "supported",
    "playwright_support": "supported"
  },
  "profile_semantics": {
    "profile_kind": "persistent_profile",
    "profile_persistence": "required",
    "login_state_reuse": "expected_when_profile_ready",
    "profile_locking": "required",
    "cleanup_expectation": "preserve_profile_state",
    "profile_reference": {
      "ref_kind": "named_profile",
      "ref": "profile://official-chrome/default",
      "owner": "webenvoy_core",
      "sensitivity": "non_secret_locator"
    },
    "profile_identity_constraints": [
      "must_match_named_profile",
      "must_not_inline_credentials",
      "must_not_inline_cookies",
      "must_not_inline_sensitive_absolute_path",
      "must_require_exclusive_profile_lock",
      "must_preserve_profile_state"
    ]
  },
  "extension_binding": {
    "extension_binding_kind": "persistent_profile_extension",
    "extension_identity_ref": "refs/official-chrome/extension-identity",
    "extension_installation_ref": "refs/official-chrome/profile-extension-installation",
    "extension_runtime_ref": "refs/official-chrome/extension-runtime",
    "service_worker_readiness_ref": "refs/official-chrome/service-worker-readiness",
    "owner": "webenvoy_core"
  },
  "native_messaging_readiness_refs": {
    "native_host_identity_ref": "refs/official-chrome/native-host-identity",
    "native_host_manifest_ref": "refs/official-chrome/native-host-manifest",
    "allowed_origins_ref": "refs/official-chrome/native-host-allowed-origins",
    "host_registration_ref": "refs/official-chrome/native-host-registration",
    "bridge_readiness_ref": "refs/official-chrome/native-bridge-readiness",
    "owner": "webenvoy_core"
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
      "ref_kind": "official_chrome_capability_matrix_owner",
      "ref": "#1139",
      "owner": "#1139"
    }
  ],
  "limitation_refs": [
    {
      "limitation_ref": "persistent_requires_profile_binding",
      "owner": "#1138",
      "downstream_consumer_refs": ["#1139", "#1140", "#1141", "#1142", "#1143", "#1144"]
    },
    {
      "limitation_ref": "persistent_requires_extension_binding",
      "owner": "#1138",
      "downstream_consumer_refs": ["#1139", "#1140", "#1141", "#1142", "#1143", "#1144"]
    },
    {
      "limitation_ref": "persistent_requires_native_messaging",
      "owner": "#1138",
      "downstream_consumer_refs": ["#1139", "#1140", "#1141", "#1142", "#1143", "#1144"]
    },
    {
      "limitation_ref": "persistent_requires_profile_identity_match",
      "owner": "#1138",
      "downstream_consumer_refs": ["#1140", "#1141", "#1142", "#1143", "#1144"]
    },
    {
      "limitation_ref": "persistent_no_descriptor_level_runtime_readiness",
      "owner": "#1138",
      "downstream_consumer_refs": ["#1139", "#1140", "#1141", "#1142", "#1143", "#1144"]
    },
    {
      "limitation_ref": "persistent_no_latest_head_live_evidence",
      "owner": "#1138",
      "downstream_consumer_refs": ["#1143", "#1144"]
    }
  ],
  "evidence_reference_slots": [
    "static_descriptor_ref",
    "registry_entry_ref",
    "capability_matrix_ref",
    "health_result_ref",
    "launch_evidence_ref",
    "fixture_ref"
  ],
  "downstream_owners": {
    "common_shape_owner": "#1137",
    "capability_matrix_owner": "#1139",
    "health_schema_owner": "FR-0038",
    "launch_evidence_owner": "#1143",
    "evidence_redaction_owner": "FR-0041",
    "official_chrome_fixtures_owner": "#1144"
  },
  "out_of_scope": [
    "common_descriptor_shape_redefinition",
    "direct_variant_redefinition",
    "capability_matrix_semantics",
    "health_result_schema",
    "launch_evidence",
    "evidence_redaction_shape",
    "fresh_live_evidence",
    "fixtures",
    "runtime_implementation",
    "browser_patching",
    "syvert_normalized_result"
  ]
}
```
