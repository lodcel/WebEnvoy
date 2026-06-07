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
  required_actions: Array<"read" | "write" | "download" | "diagnose">
  required_execution_layers: Array<"L3" | "L2" | "L1">
  required_runtime_requirements: BrowserProviderRuntimeRequirement[]
  declared_capability_ref: string
  verification_sources: CapabilityVerificationSource[]
  support_state: CapabilitySupportState
  decision: CapabilityVerificationDecision
  blocking_reasons: CapabilityBlockingReason[]
  evidence_refs: CapabilityVerificationEvidenceRef[]
  verified_at?: string
}

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

- `provider_id`、`contract_version` 和 `capability_id` 必须精确匹配 `FR-0033` contract。
- `required_actions` 与 `required_execution_layers` 是当前判定目标，不是 provider 全量能力。
- `declared_capability_ref` 必须能定位到 `FR-0033 capabilities[*].capability_id`。
- `decision=allow` 只对当前目标 capability 和最低要求有效。
- `decision=defer` 只用于尚未进入目标 admission 或 consumer 明确允许继续补证的预检状态，不得携带 `blocking_reasons`，也不得被业务执行路径当作允许。

## 5. Evidence ref

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

## 6. Minimum requirement

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

## 7. Blocking reason

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

## 8. 最小合法示例

```json
{
  "provider_id": "official-chrome-stable",
  "contract_version": "v1",
  "capability_id": "runtime-page-automation",
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
