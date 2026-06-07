# official Chrome Descriptor Contract

## 1. `official_chrome_descriptor`

```ts
interface OfficialChromeDescriptor {
  descriptor_id: string
  descriptor_version: "v1"
  common_shape_owner: "#1137" | "FR-0042"
  variant_kind: "direct"
  provider_identity: OfficialChromeProviderIdentity
  provider_mode: "core_managed" | "external_managed" | "adapter_only" | "diagnostic_only"
  engine: OfficialChromeEngineDescriptor
  transport: OfficialChromeTransportDescriptor
  profile_semantics: OfficialChromeProfileSemantics
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
- common shape 由 `#1137` / `FR-0042` 持有；后续 variant 不得重写字段语义。
- descriptor 是 provider-specific carrier，不是 runtime status、health result、launch evidence、live evidence record 或 fixture。

## 2. Provider identity

```ts
interface OfficialChromeProviderIdentity {
  provider_id: "official-chrome.direct"
  provider_family: "official_chrome"
  provider_version: "v1"
  contract_version: "v1"
  distribution_channel: "builtin"
  implementation_owner: "webenvoy_core"
}
```

约束：

- `provider_id` 必须稳定唯一。
- identity 可映射到 `FR-0033.BrowserProviderIdentity`，但不证明 runtime ready。
- 后续 `official-chrome.persistent` 必须使用不同 provider id。

## 3. Engine descriptor

```ts
interface OfficialChromeEngineDescriptor {
  engine_family: "chrome"
  browser_channel: "Google Chrome stable"
  browser_version_range: "system_installed"
  headless_policy: "forbidden"
  extension_binding_support: "none"
  profile_binding_support: "none"
}
```

约束：

- `Google Chrome stable` 必须保持与 `FR-0033` canonical label 一致。
- `system_installed` 只表示依赖本机 branded Google Chrome stable；不表示本 PR 已完成 doctor 或 live verification。
- direct variant 不承诺 extension binding 或 persistent profile binding。

## 4. Transport descriptor

```ts
interface OfficialChromeTransportDescriptor {
  transport_kind: "playwright"
  transport_owner: "webenvoy_core"
  command_surface: Array<"runtime_control" | "page_automation" | "diagnostics">
  attach_model: "launch"
  native_messaging_support: "none"
  cdp_support: "supported"
  playwright_support: "supported"
}
```

约束：

- direct variant 表达 direct launch + Playwright/CDP orchestration。
- transport 声明不得绕过浏览器内执行原则直接对目标站点发 HTTP 请求。
- 本 contract 不定义 launch envelope、runtime readiness、process lifecycle 或 evidence artifact。

## 5. Profile semantics

```ts
interface OfficialChromeProfileSemantics {
  profile_kind: "ephemeral_direct_profile"
  profile_persistence: "not_guaranteed"
  login_state_reuse: "not_promised"
  profile_locking: "not_promised"
  cleanup_expectation: "best_effort_runtime_cleanup"
  persistent_delta_owner: "#1138"
}
```

约束：

- direct variant 不承诺长期登录态恢复。
- direct variant 不承诺跨 run profile persistence。
- direct variant 不定义 persistent profile path、extension id、native host id、service worker freshness 或 account safety health schema。

## 6. Capability declaration refs

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

- refs 只表达解引用入口。
- refs 不表达 direct variant 支持的 action、layer、verification threshold 或 matrix row。
- #1139 必须消费这些 refs 定义 capability matrix，不得回写 common descriptor shape。

## 7. Limitation refs

```ts
type DirectLimitationRefId =
  | "direct_no_persistent_profile_guarantee"
  | "direct_no_extension_binding"
  | "direct_no_native_messaging"
  | "direct_no_login_state_reuse_promise"
  | "direct_no_latest_head_live_evidence"

interface LimitationRef {
  limitation_ref: DirectLimitationRefId
  owner: "#1137"
  downstream_consumer_refs: Array<"#1139" | "#1140" | "#1141" | "#1142" | "#1143" | "#1144">
}
```

约束：

- limitation refs 只冻结 direct launch 边界。
- limitation refs 不替代 `FR-0033` fail-closed rule，也不定义 capability matrix。
- `direct_no_latest_head_live_evidence` 只说明本 descriptor PR 不产出 fresh evidence。

## 8. Evidence reference slots

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

- slots 是未来证据引用位置，不是 evidence schema。
- slot 存在不表示对应证据已生成、fresh 或通过。
- `health_result_ref` 必须消费 `FR-0038`，不得在本 contract 中定义 health schema。
- `launch_evidence_ref` 与 `fixture_ref` 由后续 issue 填充。

## 9. Downstream owners and out-of-scope refs

```ts
interface DownstreamOwnerRefs {
  persistent_delta_owner: "#1138"
  capability_matrix_owner: "#1139"
  health_schema_owner: "FR-0038"
  launch_evidence_owner: "#1143"
  official_chrome_fixtures_owner: "#1144"
}

type OutOfScopeRef =
  | "persistent_specific_delta"
  | "capability_matrix_semantics"
  | "health_result_schema"
  | "launch_evidence"
  | "fresh_live_evidence"
  | "fixtures"
  | "runtime_implementation"
```

约束：

- owner refs 是边界声明，不是依赖实现完成证明。
- out-of-scope refs 必须被 PR purity 和 review 当作本 suite 的禁止范围。

## 10. `official-chrome.direct` 最小合法示例

```json
{
  "descriptor_id": "official-chrome.direct",
  "descriptor_version": "v1",
  "common_shape_owner": "#1137",
  "variant_kind": "direct",
  "provider_identity": {
    "provider_id": "official-chrome.direct",
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
    "extension_binding_support": "none",
    "profile_binding_support": "none"
  },
  "transport": {
    "transport_kind": "playwright",
    "transport_owner": "webenvoy_core",
    "command_surface": ["runtime_control", "page_automation", "diagnostics"],
    "attach_model": "launch",
    "native_messaging_support": "none",
    "cdp_support": "supported",
    "playwright_support": "supported"
  },
  "profile_semantics": {
    "profile_kind": "ephemeral_direct_profile",
    "profile_persistence": "not_guaranteed",
    "login_state_reuse": "not_promised",
    "profile_locking": "not_promised",
    "cleanup_expectation": "best_effort_runtime_cleanup",
    "persistent_delta_owner": "#1138"
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
      "limitation_ref": "direct_no_persistent_profile_guarantee",
      "owner": "#1137",
      "downstream_consumer_refs": ["#1139", "#1140", "#1141", "#1142", "#1143", "#1144"]
    },
    {
      "limitation_ref": "direct_no_extension_binding",
      "owner": "#1137",
      "downstream_consumer_refs": ["#1139", "#1140", "#1141", "#1142"]
    },
    {
      "limitation_ref": "direct_no_native_messaging",
      "owner": "#1137",
      "downstream_consumer_refs": ["#1139", "#1140", "#1141", "#1142"]
    },
    {
      "limitation_ref": "direct_no_login_state_reuse_promise",
      "owner": "#1137",
      "downstream_consumer_refs": ["#1139", "#1140", "#1141", "#1142", "#1144"]
    },
    {
      "limitation_ref": "direct_no_latest_head_live_evidence",
      "owner": "#1137",
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
    "persistent_delta_owner": "#1138",
    "capability_matrix_owner": "#1139",
    "health_schema_owner": "FR-0038",
    "launch_evidence_owner": "#1143",
    "official_chrome_fixtures_owner": "#1144"
  },
  "out_of_scope": [
    "persistent_specific_delta",
    "capability_matrix_semantics",
    "health_result_schema",
    "launch_evidence",
    "fresh_live_evidence",
    "fixtures",
    "runtime_implementation"
  ]
}
```
