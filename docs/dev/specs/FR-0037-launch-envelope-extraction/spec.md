# FR-0037 Launch Envelope Extraction

Canonical Issue: #1126

## 背景

`#1126` 属于 `#1111 Provider Runtime Foundation`，目标是在 provider runtime 继续实现前，把浏览器启动参数从分散的 CLI / runtime / provider 输入中收敛为单一 `launch_envelope`。`#1123` / `FR-0033` 已冻结 Browser Provider Contract，后续 `#1128` Provider Evidence Kernel 需要知道一次启动实际消费了哪个 provider、profile、浏览器模式、extension / native messaging 绑定和证据要求。

当前缺口是：浏览器启动参数同时涉及 provider、profile、headed/headless、proxy、locale、timezone、extension paths、Native Messaging、fingerprint seed policy 与 evidence requirements。如果这些字段继续分散传递，后续 provider registry、doctor、evidence kernel 和 runtime admission 无法稳定判断“本次启动要求什么、实际启动证明了什么、缺什么必须 fail-closed”。

本 FR 只冻结 Launch Envelope 的 formal contract。它不实现 provider registry、provider doctor、provider evidence kernel、browser launch code、CLI behavior 或任何真实 runtime 行为。

`#1126` 的 issue meta 已声明 `Close Semantics: fr-complete`，scope 是 “Route browser launch parameters through a single Launch Envelope”。因此本 PR 的 `Fixes #1126` 只关闭 Launch Envelope contract-freeze FR；`#1124/#1125/#1127/#1128/#1129/#1130` 的实现或契约由各自事项承接。

## 目标

1. 冻结 `launch_envelope` 的最小对象边界。
2. 明确 provider contract reference、profile binding、browser mode、proxy、locale、timezone、extension paths、native messaging、fingerprint seed policy 与 evidence requirements 的字段语义。
3. 明确 Launch Envelope 与 `FR-0033` Browser Provider Contract、`FR-0015` official Chrome runtime、`FR-0016` live evidence gate、`FR-0020` anti-detection validation 和 `FR-0034` Command Envelope v2 的关系。
4. 为后续 provider registry、launch admission、provider evidence kernel 与 runtime doctor 提供可直接引用的 launch-time 输入 contract。

## 非目标

- 不实现 provider registry、provider selection、provider health / doctor、provider evidence kernel 或 evidence redaction policy。
- 不修改 CLI 命令、stdout/stderr、exit code、browser launch implementation、extension、native host、Playwright 或 real-browser runtime 行为。
- 不触碰 `#1124/#1125/#1127/#1128/#1129/#1130` 的范围。
- 不冻结 Syvert normalized result、Syvert provider adapter、业务 schema 或跨仓业务 mapping。
- 不把 provider 私有 stealth patch、managed browser internals、driver state 或 browser patch 参数写成 WebEnvoy core contract。
- 不替代 `FR-0033.browser_provider_contract`；Launch Envelope 只能引用和消费 provider contract，不能重定义 provider capability declarations。
- 不替代 `FR-0016.live_evidence_record` 或 `FR-0020` anti-detection validation record。

## 功能需求

### 1. Contract 定位与 ownership

- 系统必须冻结一个稳定的 `launch_envelope` 对象。
- `launch_envelope` 的 ownership 属于 WebEnvoy core provider/runtime launch boundary。
- 该对象表达一次 browser launch admission 所需的输入、约束和证据要求。
- 该对象不得被解释为：
  - provider registry row
  - provider doctor report
  - runtime status record
  - live evidence record
  - anti-detection baseline record
  - Syvert normalized mapping
  - provider private patch manifest
- 后续实现若需要登记 provider、执行 doctor、选择 provider 或产出 evidence kernel，必须在独立 issue / FR 中消费本对象，不能反向把实现状态塞回 Launch Envelope。

### 2. Envelope identity

`launch_envelope.identity` 必须至少冻结以下字段：

- `launch_envelope_id`
- `launch_envelope_version`
- `command_ref`
- `run_id`
- `created_at`
- `requested_by`

约束：

- `launch_envelope_version` 当前冻结为 `v1`。
- `run_id` 继承既有命令级 run id 语义；它不是 provider id、profile id、browser process id 或 evidence artifact id。
- `command_ref` 只引用触发本次 launch admission 的 WebEnvoy command，不替代 `FR-0034` Command Envelope v2。
- `created_at` 是 Launch Envelope 创建时间，不是 launch 成功时间、doctor 完成时间或 live evidence 采集时间。

### 3. Provider reference

`launch_envelope.provider` 必须至少冻结以下字段：

- `provider_contract_ref`
- `provider_id`
- `provider_contract_version`
- `provider_mode`
- `capability_refs`
- `minimum_verification_level`

约束：

- `provider_contract_ref` 必须引用符合 `FR-0033` 的 `browser_provider_contract`。
- `provider_id`、`provider_contract_version`、`provider_mode` 必须与被引用的 `browser_provider_contract.provider_identity` / `provider_mode` 一致。
- `capability_refs` 必须引用 `FR-0033.browser_provider_contract.capabilities[*].capability_id`。
- `minimum_verification_level` 只能使用 `FR-0033` 的 verification level 枚举。
- Launch Envelope 不得重新声明 provider identity、capability declarations、limitations 或 provider verification evidence；这些仍由 `FR-0033` 持有。
- 如果 provider contract 缺失、capability ref 不存在、verification level 不足或 limitation 命中本次 launch requirements，后续 launch admission 必须 fail-closed。

### 4. Profile binding

`launch_envelope.profile` 必须至少冻结：

- `profile_ref`
- `profile_binding_mode`
- `profile_lock_policy`
- `extension_identity_required`
- `native_host_binding_required`
- `login_state_requirement`

约束：

- `profile_ref` 是 WebEnvoy profile locator，不得写入 Cookie、token、LocalStorage 原文或账号敏感字段。
- `profile_binding_mode` 至少支持：
  - `required_existing`
  - `allow_create_for_login`
  - `not_required`
- `profile_lock_policy` 至少支持：
  - `exclusive_required`
  - `shared_read_only`
  - `not_applicable`
- 需要正式浏览器执行面的 launch 必须默认使用 `exclusive_required`，除非后续 FR 明确冻结只读共享降级规则。
- `extension_identity_required=true` 时，后续 admission 必须校验 profile 内稳定 extension identity 与 Native Messaging allowed origins 的绑定关系。
- `login_state_requirement` 至少支持：
  - `ready`
  - `login_allowed`
  - `not_required`
  - `unknown`
- `unknown` 不得默认通过需要登录态的 launch。

### 5. Browser mode

`launch_envelope.browser_mode` 必须至少冻结：

- `headed`
- `headless`
- `execution_safety_mode`
- `browser_channel`
- `browser_version_requirement`
- `real_browser_required`

约束：

- `headed` 与 `headless` 不得同时为 `true`。
- `execution_safety_mode` 至少支持：
  - `maximum_safety`
  - `default`
  - `high_efficiency`
  - `diagnostic_only`
- `browser_channel` 若指向 Google Chrome stable，必须使用 `Google Chrome stable` canonical label。
- `real_browser_required=true` 时，`headless=true` 不得满足 launch admission，除非后续 live gate 明确允许该特例。
- `diagnostic_only` mode 不得被业务 `read/write/download` command 当作真实执行面。

### 6. Network and regional settings

`launch_envelope.network` 必须至少冻结：

- `proxy_policy`
- `proxy_ref`
- `locale`
- `timezone`
- `accept_language`

约束：

- `proxy_policy` 至少支持：
  - `profile_bound`
  - `explicit_ref`
  - `direct`
  - `not_allowed`
  - `unknown`
- `proxy_ref` 只能是 locator 或 redacted reference，不得内联 proxy credential。
- `profile_bound` 必须服从既有 profile proxy 黏性绑定原则。
- `locale`、`timezone` 与 `accept_language` 表达 launch-time regional requirements，不替代 anti-detection baseline。
- `unknown` proxy policy 在目标 capability 需要稳定出口或真实 evidence 时必须阻断。

### 7. Extension paths and native messaging

`launch_envelope.runtime_bindings` 必须至少冻结：

- `extension_binding_mode`
- `extension_id`
- `extension_paths`
- `native_messaging_mode`
- `native_host_name`
- `native_host_manifest_ref`
- `runtime_bootstrap_required`

约束：

- `extension_binding_mode` 至少支持：
  - `persistent_profile_extension`
  - `dev_unpacked_extension`
  - `not_required`
  - `unknown`
- official Chrome 主路径必须优先表达为 `persistent_profile_extension`，不得退回 per-run staged extension 作为正式主路径。
- `extension_paths` 只允许引用扩展资产 locator，不得承载 run/session secret。
- `native_messaging_mode` 至少支持：
  - `required`
  - `supported`
  - `not_required`
  - `unknown`
- `native_host_manifest_ref` 只能是 manifest locator 或 artifact ref，不内联 host secret。
- `runtime_bootstrap_required=true` 时，Launch Envelope 只表达要求；实际 bootstrap readiness 必须由后续 runtime admission / doctor / evidence contract 验证。

### 8. Fingerprint seed policy

`launch_envelope.fingerprint` 必须至少冻结：

- `seed_policy`
- `profile_seed_ref`
- `run_seed_ref`
- `rotation_policy`
- `patch_manifest_ref`

约束：

- `seed_policy` 至少支持：
  - `profile_sticky`
  - `run_scoped`
  - `provider_managed`
  - `not_required`
  - `unknown`
- `profile_seed_ref` 与 `run_seed_ref` 只能是 redacted locator，不得内联具体指纹种子值。
- `profile_sticky` 必须服从 profile 级指纹一致性原则。
- `run_scoped` 只能用于后续 FR 明确允许的低风险或隔离场景。
- `patch_manifest_ref` 只引用补丁/manifest 事实；不得把 provider 私有 patch schema 展开进 Launch Envelope。
- `unknown` seed policy 命中需要 fingerprint consistency 的 capability 时必须阻断。

### 9. Evidence requirements

`launch_envelope.evidence_requirements` 必须至少能表达：

- `required_evidence_kinds`
- `minimum_attestation_level`
- `artifact_policy`
- `redaction_policy_ref`
- `freshness_policy`
- `failure_disclosure_required`

约束：

- `required_evidence_kinds` 至少支持：
  - `launch_config_snapshot`
  - `provider_contract_ref`
  - `profile_binding_ref`
  - `extension_binding_ref`
  - `native_messaging_binding_ref`
  - `runtime_bootstrap_ref`
  - `browser_channel_attestation`
  - `fingerprint_policy_ref`
  - `launch_result_ref`
- `minimum_attestation_level` 只能使用 `FR-0033` verification level 枚举。
- `artifact_policy` 至少支持：
  - `required`
  - `best_effort`
  - `not_required`
- `freshness_policy` 至少支持：
  - `current_launch`
  - `current_pr_head`
  - `not_applicable`
- Evidence requirements 只声明本次 launch 需要哪些证据；不产出证据、不裁剪证据、不替代 `#1128` Provider Evidence Kernel。
- 当 `failure_disclosure_required=true` 时，后续 command / PR metadata 必须披露 launch admission 或 runtime blocker，而不能用 warning 隐藏阻断。

### 10. Fail-closed 边界

后续 consumer 必须至少按以下规则 fail-closed：

- provider contract reference 缺失或版本不匹配。
- capability ref 不存在或 verification level 低于 `minimum_verification_level`。
- `headed=true` 与 `headless=true` 同时出现。
- `real_browser_required=true` 但 browser mode / provider limitation 只能提供 headless 或 no real-browser attestation。
- 需要 extension binding / native messaging / profile binding 时，对应 support、locator 或 binding mode 为 `none|unknown|not_required`。
- 需要 fingerprint consistency 时，`seed_policy=unknown` 或 run-scoped policy 未被后续 FR 允许。
- 需要当前 launch evidence 时，`artifact_policy=not_required` 或 freshness 不能覆盖本次 launch。
- 任一影响目标 capability 的 `unknown` 字段不得被静默当作允许。

## GWT 验收场景

### 场景 1：Launch Envelope 引用 FR-0033 provider contract

Given 一个 `launch_envelope.provider.provider_contract_ref` 指向 `FR-0033` 形状的 provider contract
And `capability_refs` 均存在于该 contract 的 `capabilities[*].capability_id`
When 后续 launch admission 校验 provider 输入
Then admission 可以消费 provider id、mode、capability 与 minimum verification level
And 不需要在 Launch Envelope 中重新声明 provider capability details

### 场景 2：provider verification 不足时阻断

Given Launch Envelope 要求 `minimum_verification_level=runtime_attested`
And 被引用 provider capability 当前只有 `doctor_checked`
When 后续 launch admission 准备启动业务执行面
Then admission 必须 fail-closed
And failure 必须归类为 provider verification 不足

### 场景 3：real-browser launch 不允许 headless 漂移

Given `real_browser_required=true`
And `browser_mode.headless=true`
When 后续 launch admission 校验 browser mode
Then admission 必须 fail-closed
And 不得把 headless launch 作为真实浏览器证据通过

### 场景 4：official Chrome 主路径使用持久扩展绑定

Given `browser_channel=Google Chrome stable`
And launch 需要 extension 与 native messaging
When Launch Envelope 表达 runtime bindings
Then `extension_binding_mode` 应为 `persistent_profile_extension`
And `runtime_bootstrap_required=true`
And run/session secret 不得进入 `extension_paths`

### 场景 5：proxy 与 fingerprint locator 不泄露 secret

Given Launch Envelope 需要 proxy 与 fingerprint seed
When envelope 被写入 artifact 或 PR evidence
Then `proxy_ref`、`profile_seed_ref`、`run_seed_ref` 只能是 redacted locator
And 不得内联 proxy credential、Cookie、token 或具体 seed 值

### 场景 6：evidence requirements 不替代 evidence kernel

Given Launch Envelope 声明 `required_evidence_kinds` 包含 `launch_config_snapshot` 与 `runtime_bootstrap_ref`
When 后续 #1128 Provider Evidence Kernel 产出 artifact
Then kernel 可以消费这些 requirements
And Launch Envelope 本身不得被当作已采集的 live evidence record

## 异常与边界场景

- provider contract 存在但 `provider_id` 与 Launch Envelope 中声明不一致时，必须阻断。
- profile lock 不可获取时，正式业务 launch 必须阻断；只读共享降级需要后续 FR 单独冻结。
- `proxy_policy=unknown` 且目标能力需要稳定出口、账号安全或 real-browser evidence 时，必须阻断。
- `locale` / `timezone` / `accept_language` 缺失时，不能伪造 anti-detection validation；只能披露缺口或让对应 gate 阻断。
- `extension_binding_mode=dev_unpacked_extension` 只能作为开发/诊断候选，不得被写成 official Chrome 主路径。
- `native_messaging_mode=unknown` 不能满足需要 Native Messaging 的 launch。
- `fingerprint.seed_policy=provider_managed` 只能声明 provider 持有策略；provider 私有字段仍不得进入 WebEnvoy core contract。
- `freshness_policy=current_pr_head` 不能由历史 artifact 或旧 head run 满足。

## 验收标准

1. `launch_envelope` 的字段、枚举、ownership 与 fail-closed 规则已冻结。
2. Launch Envelope 明确引用并消费 `FR-0033.browser_provider_contract`，不重定义 provider contract。
3. provider、profile、browser mode、network/regional settings、runtime bindings、fingerprint seed policy 与 evidence requirements 均有明确边界。
4. GWT 覆盖 provider verification、real-browser/headless、persistent extension、secret redaction 与 evidence kernel 边界。
5. 套件不实现 provider registry、doctor、evidence kernel、CLI 或 browser launch runtime 行为。
