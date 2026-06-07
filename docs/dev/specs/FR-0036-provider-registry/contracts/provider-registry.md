# Provider Registry Contract

## 1. `browser_provider_registry`

```ts
interface BrowserProviderRegistry {
  registry_id: string
  registry_version: "v1"
  contract_ref: "FR-0033.browser_provider_contract.v1"
  owner: string
  entries: BrowserProviderRegistryEntry[]
}
```

约束：

- `entries` 必须非空。
- registry 是 provider contract resolver，不是 runtime state、doctor result、selection decision 或 live evidence record。
- consumer 必须先按 `provider_id` lookup entry，再校验 `contract_snapshot` 是否满足 `FR-0033.browser_provider_contract`。

## 2. `browser_provider_registry_entry`

```ts
interface BrowserProviderRegistryEntry {
  entry_id: string
  provider_id: string
  provider_class: ProviderClass
  contract_ref: string
  contract_snapshot: BrowserProviderContract
  registry_status: RegistryStatus
  default_eligibility: DefaultEligibility
  priority: number
  locator: ProviderLocator
  selection_tags: string[]
  constraints: ProviderRegistryConstraints
}
```

约束：

- `provider_id` 必须等于 `contract_snapshot.provider_identity.provider_id`。
- `contract_ref` 必须稳定指向该 entry 的 contract snapshot；不得被解释为 repo 路径或 runtime store 行键。
- `contract_snapshot` 必须完整满足 `FR-0033.browser_provider_contract.v1`。
- `priority` 必须是整数；后续 selection 不得用驱动硬编码顺序替代 priority / policy。

## 3. Provider class

```ts
type ProviderClass =
  | "official_chrome"
  | "cloakbrowser_managed"
  | "remote_browser"
  | "custom_local"
  | "diagnostic"
```

约束：

- `official_chrome` 只登记 official branded Google Chrome persistent extension 主路径的 provider carrier；runtime readiness 仍由 `FR-0015` 等后续 gate 判定。
- `cloakbrowser_managed` 只登记 managed browser provider 类别，不暴露 private patch schema。
- `remote_browser` 只登记 future remote provider 类别，不冻结远端协议或认证。
- `diagnostic` 不得作为业务执行 provider。

## 4. Status 与 eligibility

```ts
type RegistryStatus =
  | "declared"
  | "static_checked"
  | "disabled"
  | "deprecated"
  | "blocked"

type DefaultEligibility =
  | "eligible"
  | "not_eligible"
  | "diagnostic_only"
  | "experimental_only"
```

fail-closed 规则：

- `declared` 不足以进入默认业务选择。
- `disabled`、`deprecated`、`blocked` 不得进入默认业务选择。
- `diagnostic_only` 与 `experimental_only` 不得进入默认业务选择。
- `eligible` 只表示可进入后续候选评估；仍需满足 provider contract verification、limitations 与 runtime requirements。

## 5. Locator

```ts
interface ProviderLocator {
  locator_kind: LocatorKind
  locator_ref: string
  version_constraint?: string
  integrity_ref?: string
}

type LocatorKind =
  | "builtin"
  | "local_adapter"
  | "external_adapter"
  | "remote_broker"
  | "diagnostic_only"
```

约束：

- `locator_ref` 是 provider implementation / adapter / broker 的稳定逻辑 locator，不是 secret。
- `remote_broker` 不表示连接、认证、SLA 或 runtime availability 已验证。
- `integrity_ref` 如存在，后续 parser 必须把它作为静态校验输入。

## 6. Constraints

```ts
interface ProviderRegistryConstraints {
  requires_contract_version: "FR-0033.browser_provider_contract.v1"
  requires_registry_status: RegistryStatus[]
  minimum_verification_level: VerificationLevel
  disallowed_limitations: BrowserProviderLimitation[]
  requires_opt_in: boolean
  out_of_scope_actions: Array<
    | "provider_selection"
    | "provider_doctor"
    | "runtime_launch"
    | "live_runtime_behavior"
    | "cloakbrowser_as_core"
    | "syvert_normalized_result"
  >
}
```

约束：

- `minimum_verification_level` 复用 `FR-0033.VerificationLevel`。
- `disallowed_limitations` 复用 `FR-0033.BrowserProviderLimitation`。
- `requires_opt_in=true` 时不得进入默认业务选择。
- `out_of_scope_actions` 是本 work item 的边界声明，不是 capabilities。

## 7. 最小示例

```json
{
  "registry_id": "webenvoy-browser-provider-registry",
  "registry_version": "v1",
  "contract_ref": "FR-0033.browser_provider_contract.v1",
  "owner": "webenvoy_core_provider_runtime",
  "entries": [
    {
      "entry_id": "builtin-official-chrome-stable",
      "provider_id": "official-chrome-stable",
      "provider_class": "official_chrome",
      "contract_ref": "providers/official-chrome-stable/browser-provider-contract/v1",
      "contract_snapshot": {
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
            "verification_level": "static_checked",
            "limitations": []
          }
        ],
        "verification": {
          "provider_level": "static_checked",
          "capability_levels": {
            "runtime-page-automation": "static_checked"
          }
        },
        "limitations": []
      },
      "registry_status": "static_checked",
      "default_eligibility": "eligible",
      "priority": 100,
      "locator": {
        "locator_kind": "builtin",
        "locator_ref": "webenvoy.providers.official_chrome_stable"
      },
      "selection_tags": ["builtin", "official_chrome", "persistent_extension"],
      "constraints": {
        "requires_contract_version": "FR-0033.browser_provider_contract.v1",
        "requires_registry_status": ["static_checked"],
        "minimum_verification_level": "static_checked",
        "disallowed_limitations": ["unknown", "diagnostic_only"],
        "requires_opt_in": false,
        "out_of_scope_actions": ["provider_selection", "provider_doctor", "runtime_launch", "live_runtime_behavior", "cloakbrowser_as_core", "syvert_normalized_result"]
      }
    },
    {
      "entry_id": "placeholder-cloakbrowser-managed",
      "provider_id": "cloakbrowser-managed-placeholder",
      "provider_class": "cloakbrowser_managed",
      "contract_ref": "providers/cloakbrowser-managed-placeholder/browser-provider-contract/v1",
      "contract_snapshot": {
        "provider_identity": {
          "provider_id": "cloakbrowser-managed-placeholder",
          "provider_family": "managed_browser_provider",
          "provider_version": "placeholder",
          "contract_version": "v1",
          "distribution_channel": "external_adapter",
          "implementation_owner": "provider"
        },
        "provider_mode": "external_managed",
        "browser_engine": {
          "engine_family": "chromium",
          "browser_channel": "provider-managed",
          "browser_version_range": "unknown",
          "headless_policy": "unknown",
          "extension_binding_support": "unknown",
          "profile_binding_support": "unknown"
        },
        "automation_transport": {
          "transport_kind": "hybrid",
          "transport_owner": "provider",
          "command_surface": ["diagnostics", "artifact_passthrough"],
          "attach_model": "provider_brokered",
          "native_messaging_support": "unknown",
          "cdp_support": "unknown",
          "playwright_support": "unknown"
        },
        "capabilities": [
          {
            "capability_id": "managed-browser-diagnostics",
            "capability_kind": "diagnostic_provider",
            "supported_execution_layers": ["L3", "L2", "L1"],
            "supported_actions": ["diagnose"],
            "runtime_requirements": ["provider_doctor_passed"],
            "evidence_outputs": ["doctor_report", "artifact_ref_passthrough"],
            "risk_constraints": ["diagnostic_only"],
            "verification_level": "declared_only",
            "limitations": ["provider_private_patch_required", "unknown"]
          }
        ],
        "verification": {
          "provider_level": "declared_only",
          "capability_levels": {
            "managed-browser-diagnostics": "declared_only"
          }
        },
        "limitations": ["provider_private_patch_required", "unknown"]
      },
      "registry_status": "declared",
      "default_eligibility": "experimental_only",
      "priority": 10,
      "locator": {
        "locator_kind": "external_adapter",
        "locator_ref": "provider.external.cloakbrowser.placeholder"
      },
      "selection_tags": ["managed_browser_provider", "cloakbrowser", "placeholder"],
      "constraints": {
        "requires_contract_version": "FR-0033.browser_provider_contract.v1",
        "requires_registry_status": ["static_checked"],
        "minimum_verification_level": "doctor_checked",
        "disallowed_limitations": ["unknown", "diagnostic_only"],
        "requires_opt_in": true,
        "out_of_scope_actions": ["provider_selection", "provider_doctor", "runtime_launch", "live_runtime_behavior", "cloakbrowser_as_core", "syvert_normalized_result"]
      }
    },
    {
      "entry_id": "placeholder-remote-browser",
      "provider_id": "remote-browser-placeholder",
      "provider_class": "remote_browser",
      "contract_ref": "providers/remote-browser-placeholder/browser-provider-contract/v1",
      "contract_snapshot": {
        "provider_identity": {
          "provider_id": "remote-browser-placeholder",
          "provider_family": "custom_provider",
          "provider_version": "placeholder",
          "contract_version": "v1",
          "distribution_channel": "external_adapter",
          "implementation_owner": "external_system"
        },
        "provider_mode": "external_managed",
        "browser_engine": {
          "engine_family": "other",
          "browser_channel": "remote-provider-managed",
          "browser_version_range": "unknown",
          "headless_policy": "unknown",
          "extension_binding_support": "unknown",
          "profile_binding_support": "unknown"
        },
        "automation_transport": {
          "transport_kind": "none",
          "transport_owner": "external_system",
          "command_surface": ["diagnostics"],
          "attach_model": "not_attachable",
          "native_messaging_support": "unknown",
          "cdp_support": "unknown",
          "playwright_support": "unknown"
        },
        "capabilities": [
          {
            "capability_id": "remote-provider-metadata",
            "capability_kind": "diagnostic_provider",
            "supported_execution_layers": ["L3", "L2", "L1"],
            "supported_actions": ["diagnose"],
            "runtime_requirements": ["provider_doctor_passed"],
            "evidence_outputs": ["doctor_report"],
            "risk_constraints": ["diagnostic_only"],
            "verification_level": "declared_only",
            "limitations": ["unknown"]
          }
        ],
        "verification": {
          "provider_level": "declared_only",
          "capability_levels": {
            "remote-provider-metadata": "declared_only"
          }
        },
        "limitations": ["unknown"]
      },
      "registry_status": "blocked",
      "default_eligibility": "not_eligible",
      "priority": 0,
      "locator": {
        "locator_kind": "remote_broker",
        "locator_ref": "provider.remote.placeholder"
      },
      "selection_tags": ["remote_browser", "placeholder"],
      "constraints": {
        "requires_contract_version": "FR-0033.browser_provider_contract.v1",
        "requires_registry_status": ["static_checked"],
        "minimum_verification_level": "doctor_checked",
        "disallowed_limitations": ["unknown", "diagnostic_only"],
        "requires_opt_in": true,
        "out_of_scope_actions": ["provider_selection", "provider_doctor", "runtime_launch", "live_runtime_behavior", "cloakbrowser_as_core", "syvert_normalized_result"]
      }
    }
  ]
}
```
