# Provider Capability Verification Model

## 1. `provider_capability_verification_model`

```ts
interface ProviderCapabilityVerificationModel {
  support_states: CapabilitySupportState[]
  verification_sources: CapabilityVerificationSourceKind[]
  blocking_reasons: CapabilityBlockingReason[]
  decision_policy: CapabilityVerificationDecisionPolicy
}
```

约束：

- 本 model 是 `FR-0033 browser_provider_contract` 的消费与判定模型，不是 provider registry、doctor report、runtime status 或 live evidence record。
- contract consumer 必须先校验 `FR-0033` provider contract，再生成 capability verification record。
- `decision_policy` 必须使用本 FR 定义的 `CapabilityVerificationDecisionPolicy`，不得由 provider 私有 policy 字段替代。
- consumer 遇到未知必填字段、未知枚举、失效 evidence ref、影响目标 capability 的 unknown limitation 或 source conflict 时，必须 fail-closed。

## 2. Support state

```ts
type CapabilitySupportState =
  | "unsupported"
  | "declared"
  | "statically_verified"
  | "health_checked"
  | "runtime_attested"
  | "runtime_observed"
  | "live_evidence_attested"
  | "blocked"
```

约束：

- `unsupported`：目标 capability 没有 matching declaration。
- `declared`：仅 provider 自报。
- `statically_verified`：contract shape、枚举、本地引用或 build-time metadata 已通过。
- `health_checked`：doctor / health source 已通过，但不等于 runtime ready。
- `runtime_attested`：runtime readiness / attach / bootstrap / binding 事实已通过。
- `runtime_observed`：当前 runtime 执行面观察到 capability 关键行为或 artifact。
- `live_evidence_attested`：已引用适用 gate 接受的 latest-head live evidence。
- `blocked`：任一 fail-closed 条件命中时的最终状态。

## 3. Verification source

```ts
type CapabilityVerificationSourceKind =
  | "provider_declaration"
  | "static_contract_check"
  | "build_time_check"
  | "provider_health_check"
  | "runtime_attestation"
  | "runtime_observation"
  | "live_evidence_gate"
  | "manual_review_attestation"

type CapabilityVerificationSourceStatus =
  | "passed"
  | "failed"
  | "missing"
  | "stale"
  | "not_applicable"
```

约束：

- `provider_declaration` 必须来自 `FR-0033` contract。
- `static_contract_check` 与 `build_time_check` 不证明 runtime 可连接。
- `provider_health_check` 不证明真实页面交互成功。
- `runtime_attestation` 必须由对应 runtime readiness / attestation 事实支持。
- `runtime_observation` 必须来自当前 runtime 执行面，不允许绕过浏览器内执行原则。
- `live_evidence_gate` 必须引用适用 live evidence gate 的 accepted evidence。
- `manual_review_attestation` 不得单独提升 support state。

## 4. Verification record

```ts
interface ProviderCapabilityVerificationRecord {
  provider_id: string
  contract_version: "v1"
  capability_id: string
  requested_capability_ref: string
  required_actions: Array<"read" | "write" | "download" | "diagnose">
  required_execution_layers: Array<"L3" | "L2" | "L1">
  required_runtime_requirements: BrowserProviderRuntimeRequirement[]
  declared_capability_ref: string | null
  verification_sources: CapabilityVerificationSource[]
  support_state: CapabilitySupportState
  decision: CapabilityVerificationDecision
  blocking_reasons: CapabilityBlockingReason[]
  evidence_refs: CapabilityVerificationEvidenceRef[]
  verified_at?: string
}

// Re-exported alias from FR-0033 Browser Provider Contract.
// FR-0035 consumes this enum and does not own changes to its values.
type BrowserProviderRuntimeRequirement =
  | "profile_binding"
  | "extension_binding"
  | "native_messaging"
  | "target_tab"
  | "real_browser"
  | "headless_forbidden"
  | "runtime_bootstrap_ready"
  | "provider_doctor_passed"

interface CapabilityVerificationSource {
  kind: CapabilityVerificationSourceKind
  status: CapabilityVerificationSourceStatus
  scope: "provider" | "capability" | "runtime" | "live_gate" | "review"
  evidence_ref?: string
  checked_at?: string
}

type CapabilityVerificationDecision = "allow" | "deny" | "defer"
```

约束：

- `provider_id` 和 `contract_version` 必须精确匹配 `FR-0033` contract。
- `capability_id` 表示当前 consumer / command / admission 请求的目标 capability id；当目标未被 provider 声明时，它仍必须保留请求值，不得改写成 provider 已声明的其他 capability。
- `requested_capability_ref` 是必填请求 locator，必须能定位到 consumer / command / admission 的目标 capability 要求；它不是 `FR-0033` declaration locator。
- `BrowserProviderRuntimeRequirement` 的 enum ownership 仍属于 `FR-0033`；本 FR 只消费该类型并定义 verification policy 如何使用它。
- `required_actions` 与 `required_execution_layers` 是当前判定目标，不是 provider 全量能力。
- `declared_capability_ref` 仅在存在 matching declaration 时必须为非空 string，并且必须能定位到 `FR-0033 capabilities[*].capability_id`。
- 当 `capability_not_declared` 或 `unsupported` 路径没有 matching declaration 时，`declared_capability_ref` 必须为 `null`，不得伪造或指向相邻 capability；此时实现必须使用 `requested_capability_ref` 解释请求目标。
- `decision=allow` 只对当前目标 capability 和最低要求有效。
- `decision=defer` 只用于尚未进入目标 admission 或 consumer 明确允许继续补证的预检状态，不得携带 `blocking_reasons`，也不得被业务执行路径当作允许。
- 同类 required ref 规则：`evidence_refs[*].ref` 仅在对应 evidence ref 存在时必填；`CapabilityVerificationSource.evidence_ref` 是可选字段，source status 为 `missing`、`not_applicable` 或未进入目标 admission 的 `defer` 路径不得要求伪造 evidence locator。

## 5. Decision policy

```ts
interface CapabilityVerificationDecisionPolicy {
  default_business_minimum_support_state: CapabilitySupportState
  diagnostic_minimum_support_state: CapabilitySupportState
  runtime_requirement_minimum_support_state: CapabilitySupportState
  runtime_observation_minimum_support_state: CapabilitySupportState
  live_evidence_minimum_support_state: CapabilitySupportState
  allow_declared_only_for_business: false
  allow_defer_for_business: false
  fail_closed_on_blocking_reasons: true
  fail_closed_on_unknown_limitation: true
  fail_closed_on_invalid_or_stale_evidence_ref: true
  degraded_state_policy: "explicit_only"
  manual_review_policy: "confirm_existing_evidence_only"
}
```

必填字段：

- `default_business_minimum_support_state`
- `diagnostic_minimum_support_state`
- `runtime_requirement_minimum_support_state`
- `runtime_observation_minimum_support_state`
- `live_evidence_minimum_support_state`
- `allow_declared_only_for_business`
- `allow_defer_for_business`
- `fail_closed_on_blocking_reasons`
- `fail_closed_on_unknown_limitation`
- `fail_closed_on_invalid_or_stale_evidence_ref`
- `degraded_state_policy`
- `manual_review_policy`

约束：

- `default_business_minimum_support_state` 当前必须不低于 `statically_verified`，且不得为 `declared`。
- `diagnostic_minimum_support_state` 可以低于业务 read/write/download，但不得把 `diagnose` 扩展成业务能力。
- `runtime_requirement_minimum_support_state` 当前必须为 `runtime_attested`。
- `runtime_observation_minimum_support_state` 当前必须为 `runtime_observed`。
- `live_evidence_minimum_support_state` 当前必须为 `live_evidence_attested`。
- `allow_declared_only_for_business` 当前固定为 `false`。
- `allow_defer_for_business` 当前固定为 `false`；`defer` 只能用于未进入目标 admission 或明确允许继续补证的预检。
- `fail_closed_on_blocking_reasons` 当前固定为 `true`；任一 `blocking_reasons` 非空时必须输出 `support_state=blocked` 且 `decision=deny`。
- `fail_closed_on_unknown_limitation` 当前固定为 `true`。
- `fail_closed_on_invalid_or_stale_evidence_ref` 当前固定为 `true`。
- `degraded_state_policy` 当前固定为 `explicit_only`；没有 `CapabilityMinimumRequirement.allowed_degraded_states` 时不得自动降级。
- `manual_review_policy` 当前固定为 `confirm_existing_evidence_only`；manual review 不得单独提升 support state。
- 后续实现不得通过 provider 私有 decision policy 放宽上述固定值；放宽必须另走 formal spec review。

## 6. Evidence ref

```ts
interface CapabilityVerificationEvidenceRef {
  kind:
    | "contract_ref"
    | "build_artifact"
    | "doctor_report"
    | "runtime_attestation"
    | "runtime_observation"
    | "live_evidence"
    | "review_record"
  ref: string
  source: CapabilityVerificationSourceKind
  collected_at?: string
  head_sha?: string
  run_id?: string
  scope: "provider" | "capability" | "runtime" | "live_gate" | "review"
}
```

约束：

- evidence ref 只引用证据载体，不内联敏感原文。
- `live_evidence` 必须能追溯到 latest-head fresh rerun。
- `runtime_attestation` 和 `runtime_observation` 必须能追溯到 run/session 或等价 runtime evidence。
- provenance 缺失时不得提升到需要该 provenance 的 support state。

## 7. Minimum requirement

```ts
interface CapabilityMinimumRequirement {
  minimum_support_state: CapabilitySupportState
  required_sources: CapabilityVerificationSourceKind[]
  required_runtime_requirements: BrowserProviderRuntimeRequirement[]
  required_evidence_freshness:
    | "not_applicable"
    | "current_contract"
    | "current_build"
    | "current_runtime"
    | "latest_head_live"
  allowed_degraded_states: CapabilitySupportState[]
}
```

约束：

- 默认业务 `read/write/download` 不得接受 `declared`。
- 需要 extension / native messaging / profile / target tab / real browser 时，最低不得低于 `runtime_attested`。
- 需要当前 runtime 行为或 artifact 时，最低不得低于 `runtime_observed`。
- 需要真实 live closeout 时，最低必须为 `live_evidence_attested`。
- 降级必须显式声明；未声明时必须 fail-closed。

## 8. Blocking reason

```ts
type CapabilityBlockingReason =
  | "capability_not_declared"
  | "unsupported_action"
  | "unsupported_execution_layer"
  | "runtime_requirement_missing"
  | "provider_limitation_conflict"
  | "capability_limitation_conflict"
  | "unknown_limitation"
  | "diagnostic_only"
  | "transport_not_attachable"
  | "headless_policy_conflict"
  | "no_extension_binding"
  | "no_profile_binding"
  | "no_native_messaging"
  | "no_real_browser_attestation"
  | "verification_source_missing"
  | "verification_source_stale"
  | "evidence_ref_invalid"
  | "live_evidence_required"
  | "manual_review_required"
  | "source_conflict"
```

fail-closed 规则：

- 任一 blocking reason 命中时，最终 `support_state=blocked` 且 `decision=deny`。
- `unknown_limitation` 影响目标 capability 时必须阻断。
- `diagnostic_only` 阻断业务 `read/write/download`。
- `verification_source_missing`、`verification_source_stale` 或 `evidence_ref_invalid` 命中当前最低要求时必须进入 `blocking_reasons`，最终输出 `blocked/deny`；未进入目标 admission 时可以用 `defer` 等待补证，但不得写入 `blocking_reasons`。

## 9. 最小合法示例

### 9.1 Decision policy 示例

```json
{
  "default_business_minimum_support_state": "statically_verified",
  "diagnostic_minimum_support_state": "health_checked",
  "runtime_requirement_minimum_support_state": "runtime_attested",
  "runtime_observation_minimum_support_state": "runtime_observed",
  "live_evidence_minimum_support_state": "live_evidence_attested",
  "allow_declared_only_for_business": false,
  "allow_defer_for_business": false,
  "fail_closed_on_blocking_reasons": true,
  "fail_closed_on_unknown_limitation": true,
  "fail_closed_on_invalid_or_stale_evidence_ref": true,
  "degraded_state_policy": "explicit_only",
  "manual_review_policy": "confirm_existing_evidence_only"
}
```

说明：

- 该示例表达 FR-0035 当前唯一合法的默认 decision policy。
- 它不能作为 provider 自定义 policy 扩展点；后续实现只能消费该 policy，不能放宽固定 fail-closed 规则。

### 9.2 Verification record 示例

```json
{
  "provider_id": "official-chrome-stable",
  "contract_version": "v1",
  "capability_id": "runtime-page-automation",
  "requested_capability_ref": "consumer:read-page:runtime-page-automation",
  "required_actions": ["read"],
  "required_execution_layers": ["L3"],
  "required_runtime_requirements": ["profile_binding", "extension_binding", "native_messaging", "runtime_bootstrap_ready"],
  "declared_capability_ref": "browser_provider_contract.capabilities[runtime-page-automation]",
  "verification_sources": [
    {
      "kind": "provider_declaration",
      "status": "passed",
      "scope": "capability",
      "evidence_ref": "FR-0033:official-chrome-stable:runtime-page-automation"
    },
    {
      "kind": "static_contract_check",
      "status": "passed",
      "scope": "capability",
      "evidence_ref": "schema-fixture:provider-contract-v1"
    }
  ],
  "support_state": "blocked",
  "decision": "deny",
  "blocking_reasons": ["verification_source_missing"],
  "evidence_refs": [
    {
      "kind": "contract_ref",
      "ref": "docs/dev/specs/FR-0033-browser-provider-contract/contracts/browser-provider-contract.md",
      "source": "provider_declaration",
      "scope": "capability"
    }
  ]
}
```

说明：

- 该示例已有 declaration 与 static check source，但因当前目标要求 runtime requirements 且缺少 runtime source，最终必须 `blocked/deny`，不能作为业务执行放行证据。
- 后续实现若要求 runtime-ready read capability，必须补 `runtime_attestation` source。

### 9.3 未声明 capability 的最小合法 record 示例

```json
{
  "provider_id": "official-chrome-stable",
  "contract_version": "v1",
  "capability_id": "download-current-page",
  "requested_capability_ref": "consumer:download-page:download-current-page",
  "required_actions": ["download"],
  "required_execution_layers": ["L3"],
  "required_runtime_requirements": ["profile_binding", "extension_binding"],
  "declared_capability_ref": null,
  "verification_sources": [
    {
      "kind": "provider_declaration",
      "status": "missing",
      "scope": "capability"
    }
  ],
  "support_state": "blocked",
  "decision": "deny",
  "blocking_reasons": ["capability_not_declared"],
  "evidence_refs": [
    {
      "kind": "contract_ref",
      "ref": "docs/dev/specs/FR-0033-browser-provider-contract/contracts/browser-provider-contract.md",
      "source": "provider_declaration",
      "scope": "provider"
    }
  ]
}
```

说明：

- 该示例没有 matching `FR-0033 capabilities[*].capability_id`，因此 `declared_capability_ref` 必须为 `null`。
- `requested_capability_ref` 保留 consumer 请求目标，保证 unsupported / `capability_not_declared` 路径可构造、可审查。
- 因该 record 已进入目标 admission 且命中 `capability_not_declared`，最终必须按 fail-closed 输出 `blocked/deny`；若尚未进入目标 admission，consumer 可以输出 `support_state=unsupported` 与 `decision=deny`，但不得携带 `blocking_reasons` 或进入业务执行。
