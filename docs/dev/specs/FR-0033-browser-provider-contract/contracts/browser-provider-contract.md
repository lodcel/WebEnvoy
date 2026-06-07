# Browser Provider Contract

## 1. `browser_provider_contract`

```ts
interface BrowserProviderContract {
  provider_identity: BrowserProviderIdentity
  provider_mode: ProviderMode
  browser_engine: BrowserEngineDeclaration
  automation_transport: AutomationTransportDeclaration
  capabilities: BrowserProviderCapability[]
  verification: BrowserProviderVerification
  limitations: BrowserProviderLimitation[]
}
```

约束：

- `browser_provider_contract` 是 provider 声明对象，不是 provider registry row、runtime status row、Syvert normalized mapping 或 live evidence record。
- `contract_version` 当前只允许 `v1`。
- contract consumer 必须先校验 identity、枚举、capability 与 limitation，再进入 provider selection 或 runtime admission。
- contract consumer 遇到未知必填字段、未知枚举或影响目标 capability 的 unknown limitation 时，必须 fail-closed。

## 2. Provider identity

```ts
interface BrowserProviderIdentity {
  provider_id: string
  provider_family: "official_chrome" | "chromium_compatible" | "managed_browser_provider" | "custom_provider"
  provider_version: string
  contract_version: "v1"
  distribution_channel: "builtin" | "local_adapter" | "external_adapter" | "experimental"
  implementation_owner: string
}
```

约束：

- `provider_id` 必须在 WebEnvoy provider namespace 内稳定唯一。
- `provider_version` 表达 provider implementation 版本，不等于 browser version。
- `implementation_owner` 只表达责任归属；它不授予 provider 修改 WebEnvoy core contract 的权威。

## 3. Provider mode

```ts
type ProviderMode =
  | "core_managed"
  | "external_managed"
  | "adapter_only"
  | "diagnostic_only"
```

约束：

- `core_managed`：WebEnvoy core 可以管理生命周期或连接编排。
- `external_managed`：provider 生命周期由外部持有，WebEnvoy 只连接到既有执行面。
- `adapter_only`：provider 只提供 adapter / driver 能力，不声明独立生命周期管理。
- `diagnostic_only`：只用于 doctor / health / evidence inspection，不得被业务命令选择为执行 provider。

## 4. Browser engine declaration

```ts
interface BrowserEngineDeclaration {
  engine_family: "chrome" | "chromium" | "webkit" | "firefox" | "other"
  browser_channel: string
  browser_version_range: string
  headless_policy: "forbidden" | "allowed_for_dev_only" | "allowed" | "unknown"
  extension_binding_support: "required" | "supported" | "none" | "unknown"
  profile_binding_support: "required" | "supported" | "none" | "unknown"
}
```

约束：

- Google Chrome stable 必须编码为 `Google Chrome stable`。
- `engine_family` 允许表达非 Chrome provider，但不改变当前 official Chrome 主路径。
- `headless_policy=allowed|unknown` 不能满足 real-browser 或 live evidence 门禁。
- `extension_binding_support` 与 `profile_binding_support` 只表达 provider 能力声明，不替代 `FR-0015` / `FR-0003` 的实际 readiness 与 lock 判定。

## 5. Automation transport declaration

```ts
interface AutomationTransportDeclaration {
  transport_kind:
    | "native_messaging"
    | "cdp"
    | "playwright"
    | "extension_bridge"
    | "os_input"
    | "hybrid"
    | "none"
  transport_owner: "webenvoy_core" | "provider" | "external_system" | "manual_user"
  command_surface: Array<"runtime_control" | "page_automation" | "diagnostics" | "artifact_passthrough">
  attach_model: "launch" | "attach_existing" | "provider_brokered" | "not_attachable"
  native_messaging_support: "required" | "supported" | "none" | "unknown"
  cdp_support: "supported" | "none" | "unknown"
  playwright_support: "supported" | "none" | "unknown"
}
```

约束：

- `transport_kind=none` 或 `attach_model=not_attachable` 的 provider 不得执行业务命令。
- `command_surface` 必须非空。
- `cdp_support`、`playwright_support` 或 `os_input` 只声明自动化 transport，不允许绕过浏览器进程直接对目标站点发 HTTP 请求。

## 6. Capability declaration

```ts
interface BrowserProviderCapability {
  capability_id: string
  capability_kind:
    | "browser_runtime"
    | "page_automation"
    | "extension_runtime"
    | "native_bridge"
    | "artifact_provider"
    | "diagnostic_provider"
  supported_execution_layers: Array<"L3" | "L2" | "L1">
  supported_actions: Array<"read" | "write" | "download" | "diagnose">
  runtime_requirements: BrowserProviderRuntimeRequirement[]
  evidence_outputs: BrowserProviderEvidenceOutput[]
  risk_constraints: BrowserProviderRiskConstraint[]
  verification_level: VerificationLevel
  limitations: BrowserProviderLimitation[]
}
```

约束：

- `supported_execution_layers` 与 `supported_actions` 必须非空。
- `diagnose` 只能表达 provider 诊断动作，不是用户业务能力面。
- `runtime_requirements` 是前置要求，不是已验证事实。
- `evidence_outputs` 是证据产出/透传声明，不替代 live evidence 或 anti-detection validation record。
- capability-level `limitations` 与 top-level `limitations` 都必须参与 fail-closed 判定。

## 7. Requirements, evidence outputs and risk constraints

```ts
type BrowserProviderRuntimeRequirement =
  | "profile_binding"
  | "extension_binding"
  | "native_messaging"
  | "target_tab"
  | "real_browser"
  | "headless_forbidden"
  | "runtime_bootstrap_ready"
  | "provider_doctor_passed"

type BrowserProviderEvidenceOutput =
  | "runtime_health"
  | "doctor_report"
  | "artifact_ref_passthrough"
  | "runtime_attestation"
  | "live_evidence_ref"

type BrowserProviderRiskConstraint =
  | "no_live_write"
  | "read_only"
  | "diagnostic_only"
  | "requires_manual_confirmation"
  | "requires_latest_head_evidence"
```

约束：

- `runtime_bootstrap_ready` 必须由 runtime contract 消费和验证，本 contract 不能自证 ready。
- `live_evidence_ref` 必须引用适用 live evidence gate 的证据载体，本 contract 不能伪造。
- `requires_latest_head_evidence` 必须交给 `FR-0016` 或后续适用 gate 判定。

## 8. Verification

```ts
type VerificationLevel =
  | "declared_only"
  | "static_checked"
  | "doctor_checked"
  | "runtime_attested"
  | "live_evidence_attested"

interface BrowserProviderVerification {
  provider_level: VerificationLevel
  capability_levels: Record<string, VerificationLevel>
  verified_at?: string
  evidence_refs?: string[]
}
```

约束：

- `declared_only` 不足以进入默认业务执行选择。
- `doctor_checked` 不等于 runtime ready，也不等于 live evidence ready。
- `runtime_attested` 必须来自对应 runtime contract 的 readiness / attestation 事实。
- `live_evidence_attested` 必须能追溯到适用 latest-head run / artifact / PR metadata。
- `capability_levels` key 必须精确匹配 `capabilities[*].capability_id`；缺失时按 `declared_only` 处理。

## 9. Limitations

```ts
type BrowserProviderLimitation =
  | "unsupported_engine"
  | "unsupported_channel"
  | "headless_only"
  | "no_extension_binding"
  | "no_profile_binding"
  | "no_native_messaging"
  | "no_real_browser_attestation"
  | "diagnostic_only"
  | "experimental_only"
  | "provider_private_patch_required"
  | "unknown"
```

fail-closed 规则：

- `unknown` 影响目标 capability 时必须阻断。
- `diagnostic_only` 必须阻断业务 `read/write/download`。
- `provider_private_patch_required` 只能表达依赖私有 provider 能力，不允许展开私有 patch schema。
- `no_extension_binding`、`no_profile_binding`、`no_native_messaging` 命中对应 runtime requirement 时必须阻断。
- `no_real_browser_attestation` 命中 real-browser / live evidence 门禁时必须阻断。

## 10. 最小合法示例

```json
{
  "provider_identity": {
    "provider_id": "official-chrome-stable",
    "provider_family": "official_chrome",
    "provider_version": "v1",
    "contract_version": "v1",
    "distribution_channel": "builtin",
    "implementation_owner": "webenvoy_core"
  },
  "provider_mode": "core_managed",
  "browser_engine": {
    "engine_family": "chrome",
    "browser_channel": "Google Chrome stable",
    "browser_version_range": ">=137",
    "headless_policy": "forbidden",
    "extension_binding_support": "required",
    "profile_binding_support": "required"
  },
  "automation_transport": {
    "transport_kind": "hybrid",
    "transport_owner": "webenvoy_core",
    "command_surface": ["runtime_control", "page_automation", "diagnostics", "artifact_passthrough"],
    "attach_model": "launch",
    "native_messaging_support": "required",
    "cdp_support": "supported",
    "playwright_support": "supported"
  },
  "capabilities": [
    {
      "capability_id": "runtime-page-automation",
      "capability_kind": "page_automation",
      "supported_execution_layers": ["L3", "L2"],
      "supported_actions": ["read", "write", "download", "diagnose"],
      "runtime_requirements": ["profile_binding", "extension_binding", "native_messaging", "target_tab", "real_browser", "headless_forbidden", "runtime_bootstrap_ready"],
      "evidence_outputs": ["runtime_health", "doctor_report", "artifact_ref_passthrough", "runtime_attestation"],
      "risk_constraints": ["requires_latest_head_evidence"],
      "verification_level": "declared_only",
      "limitations": []
    }
  ],
  "verification": {
    "provider_level": "declared_only",
    "capability_levels": {
      "runtime-page-automation": "declared_only"
    }
  },
  "limitations": []
}
```
