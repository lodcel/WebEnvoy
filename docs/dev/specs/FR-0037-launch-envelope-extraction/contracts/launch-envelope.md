# Launch Envelope Contract

## 1. `launch_envelope`

```ts
interface LaunchEnvelope {
  identity: LaunchEnvelopeIdentity
  provider: LaunchProviderReference
  profile: LaunchProfileBinding
  browser_mode: LaunchBrowserMode
  network: LaunchNetworkSettings
  runtime_bindings: LaunchRuntimeBindings
  fingerprint: LaunchFingerprintPolicy
  evidence_requirements: LaunchEvidenceRequirements
  limitations: LaunchLimitation[]
}
```

约束：

- `launch_envelope` 是 launch-time admission 输入，不是 provider registry、doctor report、runtime status 或 evidence artifact。
- `launch_envelope_version` 当前只允许 `v1`。
- consumer 必须先校验 identity、provider ref、profile binding、browser mode、runtime binding、fingerprint policy、evidence requirements 与 limitations，再进入 browser launch。
- consumer 遇到未知必填字段、未知枚举或影响目标 capability 的 unknown limitation 时，必须 fail-closed。

## 2. Identity

```ts
interface LaunchEnvelopeIdentity {
  launch_envelope_id: string
  launch_envelope_version: "v1"
  command_ref: string
  run_id: string
  created_at: string
  requested_by: "webenvoy_cli" | "webenvoy_runtime" | "external_consumer" | "manual_operator"
}
```

约束：

- `launch_envelope_id` 是本对象 id。
- `run_id` 是命令级 run id，不是 provider、profile、browser process 或 artifact id。
- `created_at` 是 envelope 创建时间，不代表 launch 成功或 evidence 采集完成。

## 3. Provider reference

```ts
interface LaunchProviderReference {
  provider_contract_ref: string
  provider_id: string
  provider_contract_version: "v1"
  provider_mode: "core_managed" | "external_managed" | "adapter_only" | "diagnostic_only"
  capability_refs: string[]
  minimum_verification_level: VerificationLevel
}

type VerificationLevel =
  | "declared_only"
  | "static_checked"
  | "doctor_checked"
  | "runtime_attested"
  | "live_evidence_attested"
```

约束：

- `provider_contract_ref` 必须指向 `FR-0033` 的 `browser_provider_contract`。
- `provider_id`、`provider_contract_version`、`provider_mode` 必须与 provider contract 一致。
- `capability_refs` 必须非空，并精确匹配 provider contract capability ids。
- `minimum_verification_level` 使用 `FR-0033` verification level 枚举。
- `provider_mode=diagnostic_only` 不得用于业务 `read/write/download` launch。

## 4. Profile binding

```ts
interface LaunchProfileBinding {
  profile_ref: string
  profile_binding_mode: "required_existing" | "allow_create_for_login" | "not_required"
  profile_lock_policy: "exclusive_required" | "shared_read_only" | "not_applicable"
  extension_identity_required: boolean
  native_host_binding_required: boolean
  login_state_requirement: "ready" | "login_allowed" | "not_required" | "unknown"
}
```

约束：

- `profile_ref` 是 locator，不得包含 Cookie、token、LocalStorage 原文或账号敏感值。
- 正式业务 launch 默认要求 `profile_lock_policy=exclusive_required`。
- `extension_identity_required=true` 时，后续 admission 必须校验稳定 extension identity。
- `native_host_binding_required=true` 时，后续 admission 必须校验 Native Messaging allowed origins / host binding。
- `login_state_requirement=unknown` 不得满足需要登录态的 capability。

## 5. Browser mode

```ts
interface LaunchBrowserMode {
  headed: boolean
  headless: boolean
  execution_safety_mode: "maximum_safety" | "default" | "high_efficiency" | "diagnostic_only"
  browser_channel: string
  browser_version_requirement: string
  real_browser_required: boolean
}
```

约束：

- `headed` 与 `headless` 不得同时为 `true`。
- Google Chrome stable 必须编码为 `Google Chrome stable`。
- `real_browser_required=true` 时，headless launch 不得满足 admission。
- `execution_safety_mode=diagnostic_only` 只能进入诊断或 metadata 消费。

## 6. Network settings

```ts
interface LaunchNetworkSettings {
  proxy_policy: "profile_bound" | "explicit_ref" | "direct" | "not_allowed" | "unknown"
  proxy_ref?: string
  locale?: string
  timezone?: string
  accept_language?: string
}
```

约束：

- `proxy_ref` 只能是 redacted locator，不得内联 credential。
- `profile_bound` 必须服从 profile proxy 黏性绑定。
- `locale`、`timezone`、`accept_language` 是 launch requirement，不是 anti-detection validation result。
- `proxy_policy=unknown` 命中稳定出口或 real-browser evidence requirement 时必须阻断。

## 7. Runtime bindings

```ts
interface LaunchRuntimeBindings {
  extension_binding_mode:
    | "persistent_profile_extension"
    | "dev_unpacked_extension"
    | "not_required"
    | "unknown"
  extension_id?: string
  extension_paths: string[]
  native_messaging_mode: "required" | "supported" | "not_required" | "unknown"
  native_host_name?: string
  native_host_manifest_ref?: string
  runtime_bootstrap_required: boolean
}
```

约束：

- official Chrome 主路径必须使用 `persistent_profile_extension`。
- `extension_paths` 只引用静态扩展资产 locator，不得包含 run/session secret。
- `native_host_manifest_ref` 只引用 manifest locator 或 artifact ref。
- `runtime_bootstrap_required=true` 只声明要求；ready 事实由后续 runtime admission / evidence contract 证明。

## 8. Fingerprint policy

```ts
interface LaunchFingerprintPolicy {
  seed_policy: "profile_sticky" | "run_scoped" | "provider_managed" | "not_required" | "unknown"
  profile_seed_ref?: string
  run_seed_ref?: string
  rotation_policy: "never_within_profile" | "per_run" | "provider_defined" | "not_applicable" | "unknown"
  patch_manifest_ref?: string
}
```

约束：

- seed refs 只能是 redacted locator，不得内联具体 seed 值。
- `profile_sticky` 服从 profile 级指纹一致性原则。
- `run_scoped` 只能用于后续 FR 明确允许的低风险或隔离场景。
- `patch_manifest_ref` 只能引用补丁事实，不展开 provider 私有 schema。
- `seed_policy=unknown` 命中 fingerprint consistency requirement 时必须阻断。

## 9. Evidence requirements

```ts
interface LaunchEvidenceRequirements {
  required_evidence_kinds: LaunchEvidenceKind[]
  minimum_attestation_level: VerificationLevel
  artifact_policy: "required" | "best_effort" | "not_required"
  redaction_policy_ref?: string
  freshness_policy: "current_launch" | "current_pr_head" | "not_applicable"
  failure_disclosure_required: boolean
}

type LaunchEvidenceKind =
  | "launch_config_snapshot"
  | "provider_contract_ref"
  | "profile_binding_ref"
  | "extension_binding_ref"
  | "native_messaging_binding_ref"
  | "runtime_bootstrap_ref"
  | "browser_channel_attestation"
  | "fingerprint_policy_ref"
  | "launch_result_ref"
```

约束：

- Evidence requirements 声明本次 launch 需要的证据，不产出证据。
- `minimum_attestation_level` 使用 `FR-0033` verification level 枚举。
- `artifact_policy=not_required` 不得满足需要 launch evidence 的 capability。
- `freshness_policy=current_pr_head` 不能由历史 artifact 或旧 head run 满足。

## 10. Limitations

```ts
type LaunchLimitation =
  | "provider_contract_missing"
  | "provider_verification_insufficient"
  | "profile_lock_unavailable"
  | "headless_conflict"
  | "no_real_browser_attestation"
  | "extension_binding_missing"
  | "native_messaging_binding_missing"
  | "proxy_policy_unknown"
  | "fingerprint_policy_unknown"
  | "evidence_requirement_unmet"
  | "diagnostic_only"
  | "unknown"
```

fail-closed 规则：

- `unknown` 影响目标 capability 时必须阻断。
- `provider_contract_missing`、`provider_verification_insufficient`、`profile_lock_unavailable` 必须阻断业务 launch。
- `headless_conflict` 或 `no_real_browser_attestation` 命中 real-browser requirement 时必须阻断。
- `extension_binding_missing`、`native_messaging_binding_missing` 命中对应 runtime requirement 时必须阻断。
- `evidence_requirement_unmet` 命中 required artifact policy 时必须阻断。

## 11. 最小合法示例

```json
{
  "identity": {
    "launch_envelope_id": "launch-env-001",
    "launch_envelope_version": "v1",
    "command_ref": "runtime.start",
    "run_id": "run_20260607_001",
    "created_at": "2026-06-07T08:00:00Z",
    "requested_by": "webenvoy_cli"
  },
  "provider": {
    "provider_contract_ref": "browser-provider-contract:official-chrome-stable:v1",
    "provider_id": "official-chrome-stable",
    "provider_contract_version": "v1",
    "provider_mode": "core_managed",
    "capability_refs": ["runtime-page-automation"],
    "minimum_verification_level": "runtime_attested"
  },
  "profile": {
    "profile_ref": "profile:xhs_account_001",
    "profile_binding_mode": "required_existing",
    "profile_lock_policy": "exclusive_required",
    "extension_identity_required": true,
    "native_host_binding_required": true,
    "login_state_requirement": "ready"
  },
  "browser_mode": {
    "headed": true,
    "headless": false,
    "execution_safety_mode": "default",
    "browser_channel": "Google Chrome stable",
    "browser_version_requirement": ">=137",
    "real_browser_required": true
  },
  "network": {
    "proxy_policy": "profile_bound",
    "proxy_ref": "profile:xhs_account_001:proxy",
    "locale": "zh-CN",
    "timezone": "Asia/Shanghai",
    "accept_language": "zh-CN,zh;q=0.9"
  },
  "runtime_bindings": {
    "extension_binding_mode": "persistent_profile_extension",
    "extension_id": "stable-extension-id",
    "extension_paths": ["extension:webenvoy:installed-profile-asset"],
    "native_messaging_mode": "required",
    "native_host_name": "com.webenvoy.native_host",
    "native_host_manifest_ref": "native-host-manifest:com.webenvoy.native_host",
    "runtime_bootstrap_required": true
  },
  "fingerprint": {
    "seed_policy": "profile_sticky",
    "profile_seed_ref": "profile:xhs_account_001:fingerprint-seed",
    "rotation_policy": "never_within_profile",
    "patch_manifest_ref": "fingerprint-patch:default"
  },
  "evidence_requirements": {
    "required_evidence_kinds": [
      "launch_config_snapshot",
      "provider_contract_ref",
      "profile_binding_ref",
      "extension_binding_ref",
      "native_messaging_binding_ref",
      "runtime_bootstrap_ref",
      "browser_channel_attestation",
      "fingerprint_policy_ref",
      "launch_result_ref"
    ],
    "minimum_attestation_level": "runtime_attested",
    "artifact_policy": "required",
    "redaction_policy_ref": "provider-evidence-redaction:v1",
    "freshness_policy": "current_launch",
    "failure_disclosure_required": true
  },
  "limitations": []
}
```
