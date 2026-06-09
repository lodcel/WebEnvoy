# CloakBrowser Persistent Descriptor

## 1. `cloakbrowser_persistent_descriptor`

```ts
interface CloakBrowserPersistentDescriptor {
  descriptor_id: "cloakbrowser.persistent"
  descriptor_version: "v1"
  variant_kind: "persistent"
  provider_identity: BrowserProviderIdentity
  provider_mode: "external_managed"
  engine: CloakBrowserPersistentEngine
  transport: CloakBrowserPersistentTransport
  profile_semantics: CloakBrowserPersistentProfileSemantics
  extension_workflow: CloakBrowserExtensionWorkflow
  health_requirement_inputs: CloakBrowserHealthRequirementInputs
  capability_declaration_refs: string[]
  limitation_refs: CloakBrowserPersistentLimitationRef[]
  evidence_reference_slots: CloakBrowserEvidenceReferenceSlot[]
  downstream_owners: CloakBrowserPersistentDownstreamOwners
  out_of_scope: string[]
}
```

约束：

- descriptor 是静态 provider-specific carrier，不是 runtime status、health result、launch evidence、live evidence record 或 fixture。
- consumer 必须先校验 identity、engine、transport、profile、extension workflow、health inputs 与 limitation refs，再进入 provider selection、capability matrix 或 health admission。
- consumer 遇到未知必填字段、未知枚举、缺失 required ref 或影响目标 capability 的 unknown limitation 时，必须 fail-closed。

## 2. Provider identity

```ts
interface BrowserProviderIdentity {
  provider_id: "cloakbrowser.persistent"
  provider_family: "managed_browser_provider"
  provider_version: "v1"
  contract_version: "v1"
  distribution_channel: "external_adapter"
  implementation_owner: "cloakbrowser_provider_adapter"
}
```

约束：

- identity 只表达 WebEnvoy provider namespace 下的 descriptor id。
- identity 不证明 CloakBrowser installed、profile bound、extension workflow ready、doctor pass、runtime ready 或 live evidence ready。
- license、workspace secret、account credential 与 provider broker credential 不得进入 identity。

## 3. Engine

```ts
interface CloakBrowserPersistentEngine {
  engine_family: "chromium"
  browser_channel: "CloakBrowser managed Chromium"
  browser_version_range: "provider_managed"
  headless_policy: "forbidden"
  extension_binding_support: "required"
  profile_binding_support: "required"
}
```

约束：

- `provider_managed` 只表示 version / binary 由 CloakBrowser provider 管理，不是 version check pass。
- `headless_policy=forbidden` 要求后续 health / runtime owner 验证 headed real browser surface。
- extension/profile `required` 是前置声明，不是 ready fact。

## 4. Transport

```ts
interface CloakBrowserPersistentTransport {
  transport_kind: "hybrid"
  transport_owner: "provider"
  command_surface: Array<"runtime_control" | "page_automation" | "diagnostics" | "artifact_passthrough">
  attach_model: "provider_brokered"
  native_messaging_support: "required"
  cdp_support: "supported"
  playwright_support: "supported"
}
```

约束：

- `command_surface` 必须包含 `runtime_control`、`page_automation`、`diagnostics` 与 `artifact_passthrough`。
- `provider_brokered` 不表示 WebEnvoy 已 attach 到 browser context；后续 runtime admission 必须验证。
- transport 不允许把目标站点 HTTP 请求移出浏览器进程。

## 5. Profile semantics

```ts
interface CloakBrowserPersistentProfileSemantics {
  profile_kind: "cloakbrowser_persistent_profile"
  profile_persistence: "required"
  login_state_reuse: "expected_when_profile_ready"
  profile_locking: "required"
  cleanup_expectation: "preserve_profile_state"
  profile_reference: CloakBrowserPersistentProfileReference
  profile_identity_constraints: CloakBrowserProfileIdentityConstraint[]
}

interface CloakBrowserPersistentProfileReference {
  provider_workspace_ref: string
  profile_locator_ref: string
  selected_profile_identity_ref: string
  locator_sensitivity: "internal" | "sensitive"
  locator_disclosure: "redacted" | "opaque" | "report_local"
}

type CloakBrowserProfileIdentityConstraint =
  | "no_cookie_inline"
  | "no_token_inline"
  | "no_license_secret_inline"
  | "no_account_credential_inline"
  | "no_raw_sensitive_path_inline"
  | "no_provider_broker_credential_inline"
  | "requires_profile_identity_match"
  | "requires_profile_lock_health"
```

约束：

- all locator refs 必须是 redacted、opaque 或 report-local。
- profile reference 不能证明 profile lock、account safety、login state、workspace availability 或 runtime readiness。

## 6. Extension workflow

```ts
interface CloakBrowserExtensionWorkflow {
  workflow_kind: "persistent_profile_extension_workflow"
  extension_binding_kind: "provider_managed_persistent_extension"
  extension_identity_ref: string
  extension_installation_ref: string
  extension_runtime_ref: string
  workflow_capability_refs: string[]
  native_bridge_ref: string
  artifact_passthrough_ref: string
}
```

约束：

- `workflow_capability_refs` 指向 capability matrix / provider contract consumer，不在 descriptor 中声明 business support。
- extension identity / installation / runtime refs 是 static slots 或 health inputs，不是 extension ready result。
- manifest schema、allowed origins、service worker freshness、runtime message envelope 与 artifact payload 由后续 owner 定义。

## 7. Health requirement inputs

```ts
interface CloakBrowserHealthRequirementInputs {
  expected_binary_source_ref: string
  provider_broker_ref: string
  profile_binding_ref: string
  extension_binding_ref: string
  native_messaging_ref: string
  display_mode_ref: string
  provider_private_patch_presence_ref: string
  capability_readiness_ref: string
}
```

约束：

- health inputs 必须由 `FR-0038.provider_doctor_report` 或后续 runtime / evidence owner 消费。
- `provider_private_patch_presence_ref` 只能要求证明 private provider route 与 declared limitation 一致，不暴露 patch fields。
- descriptor 中不得出现 doctor result payload、runtime attestation 或 live evidence attestation。

## 8. Limitation refs

```ts
type CloakBrowserPersistentLimitationRef =
  | "persistent_requires_cloakbrowser_managed_profile"
  | "persistent_requires_profile_binding"
  | "persistent_requires_extension_workflow_binding"
  | "persistent_requires_native_messaging"
  | "persistent_requires_provider_broker_attachment"
  | "persistent_provider_private_patch_required"
  | "persistent_no_descriptor_level_health_pass"
  | "persistent_no_descriptor_level_runtime_readiness"
  | "persistent_no_latest_head_live_evidence"
```

fail-closed 规则：

- required profile / extension / native messaging / broker refs 缺失时，consumer 必须 fail-closed。
- `persistent_provider_private_patch_required` 不允许展开 private patch schema。
- `persistent_no_descriptor_level_health_pass` 与 `persistent_no_descriptor_level_runtime_readiness` 阻止 consumer 把 descriptor existence 当成 readiness。

## 9. Evidence slots and owners

```ts
type CloakBrowserEvidenceReferenceSlot =
  | "static_descriptor_ref"
  | "registry_entry_ref"
  | "capability_matrix_ref"
  | "health_result_ref"
  | "launch_evidence_ref"
  | "fixture_ref"

interface CloakBrowserPersistentDownstreamOwners {
  capability_matrix: "#1149"
  direct_descriptor: "#1146"
  cloakserve_descriptor: "#1148"
  health_contract: "FR-0038"
  provider_contract: "FR-0033"
  provider_registry: "FR-0036"
}
```

约束：

- FR-0050 only satisfies `static_descriptor_ref`.
- `health_result_ref`、`launch_evidence_ref` 与 `fixture_ref` 必须由 downstream owner 填充。
- `direct_descriptor=#1146` 仅用于 sibling boundary；FR-0050 不消费或修改 direct launch shape。

## 10. 最小可消费示例

该示例只用于 downstream parser、fixture、capability matrix 与 health consumer 理解字段形状。它不证明 CloakBrowser installed、profile ready、extension workflow ready、doctor pass、runtime ready 或 live evidence ready。

```json
{
  "descriptor_id": "cloakbrowser.persistent",
  "descriptor_version": "v1",
  "variant_kind": "persistent",
  "provider_identity": {
    "provider_id": "cloakbrowser.persistent",
    "provider_family": "managed_browser_provider",
    "provider_version": "v1",
    "contract_version": "v1",
    "distribution_channel": "external_adapter",
    "implementation_owner": "cloakbrowser_provider_adapter"
  },
  "provider_mode": "external_managed",
  "engine": {
    "engine_family": "chromium",
    "browser_channel": "CloakBrowser managed Chromium",
    "browser_version_range": "provider_managed",
    "headless_policy": "forbidden",
    "extension_binding_support": "required",
    "profile_binding_support": "required"
  },
  "transport": {
    "transport_kind": "hybrid",
    "transport_owner": "provider",
    "command_surface": [
      "runtime_control",
      "page_automation",
      "diagnostics",
      "artifact_passthrough"
    ],
    "attach_model": "provider_brokered",
    "native_messaging_support": "required",
    "cdp_support": "supported",
    "playwright_support": "supported"
  },
  "profile_semantics": {
    "profile_kind": "cloakbrowser_persistent_profile",
    "profile_persistence": "required",
    "login_state_reuse": "expected_when_profile_ready",
    "profile_locking": "required",
    "cleanup_expectation": "preserve_profile_state",
    "profile_reference": {
      "provider_workspace_ref": "cloakbrowser.workspace_ref:opaque:default",
      "profile_locator_ref": "cloakbrowser.profile_ref:redacted:selected",
      "selected_profile_identity_ref": "cloakbrowser.profile_identity_ref:opaque:selected",
      "locator_sensitivity": "sensitive",
      "locator_disclosure": "opaque"
    },
    "profile_identity_constraints": [
      "no_cookie_inline",
      "no_token_inline",
      "no_license_secret_inline",
      "no_account_credential_inline",
      "no_raw_sensitive_path_inline",
      "no_provider_broker_credential_inline",
      "requires_profile_identity_match",
      "requires_profile_lock_health"
    ]
  },
  "extension_workflow": {
    "workflow_kind": "persistent_profile_extension_workflow",
    "extension_binding_kind": "provider_managed_persistent_extension",
    "extension_identity_ref": "cloakbrowser.extension_identity_ref:opaque:managed",
    "extension_installation_ref": "cloakbrowser.extension_installation_ref:redacted:profile-scoped",
    "extension_runtime_ref": "cloakbrowser.extension_runtime_ref:opaque:pending-health",
    "workflow_capability_refs": [
      "FR-0033.browser_provider_contract.capabilities",
      "#1149.cloakbrowser_capability_matrix"
    ],
    "native_bridge_ref": "cloakbrowser.native_bridge_ref:opaque:pending-health",
    "artifact_passthrough_ref": "cloakbrowser.artifact_passthrough_ref:opaque:pending-owner"
  },
  "health_requirement_inputs": {
    "expected_binary_source_ref": "FR-0038.input_contract_ref.expected_binary_source:cloakbrowser-provider",
    "provider_broker_ref": "cloakbrowser.provider_broker_ref:opaque:pending-health",
    "profile_binding_ref": "cloakbrowser.profile_binding_ref:redacted:selected",
    "extension_binding_ref": "cloakbrowser.extension_binding_ref:redacted:profile-scoped",
    "native_messaging_ref": "cloakbrowser.native_messaging_ref:opaque:pending-health",
    "display_mode_ref": "cloakbrowser.display_mode_ref:opaque:headed-required",
    "provider_private_patch_presence_ref": "cloakbrowser.private_capability_ref:opaque:presence-required",
    "capability_readiness_ref": "FR-0038.provider_doctor_report.checks[capability_readiness]"
  },
  "capability_declaration_refs": [
    "FR-0033.browser_provider_contract.capabilities",
    "FR-0035.provider_capability_verification_model",
    "FR-0038.provider_doctor_report",
    "#1149 CloakBrowser Capability Matrix"
  ],
  "limitation_refs": [
    "persistent_requires_cloakbrowser_managed_profile",
    "persistent_requires_profile_binding",
    "persistent_requires_extension_workflow_binding",
    "persistent_requires_native_messaging",
    "persistent_requires_provider_broker_attachment",
    "persistent_provider_private_patch_required",
    "persistent_no_descriptor_level_health_pass",
    "persistent_no_descriptor_level_runtime_readiness",
    "persistent_no_latest_head_live_evidence"
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
    "capability_matrix": "#1149",
    "direct_descriptor": "#1146",
    "cloakserve_descriptor": "#1148",
    "health_contract": "FR-0038",
    "provider_contract": "FR-0033",
    "provider_registry": "FR-0036"
  },
  "out_of_scope": [
    "health_result_schema",
    "runtime_launch",
    "capability_matrix_rows",
    "fixture_payload",
    "live_evidence",
    "cloakbrowser_private_patch_schema",
    "syvert_normalized_result",
    "xhs_flow"
  ]
}
```

示例消费约束：

- `limitation_refs` 必须包含本文件第 8 节的全部 required refs。
- `profile_reference`、extension refs、broker refs 与 private capability refs 必须保持 opaque / redacted，不得替换为 raw local path、credential、secret 或 private patch field。
- `health_requirement_inputs` 只提供 FR-0038 doctor/admission inputs，不是 doctor result payload。
- `evidence_reference_slots` 中除 `static_descriptor_ref` 外均由 downstream owner 填充。
