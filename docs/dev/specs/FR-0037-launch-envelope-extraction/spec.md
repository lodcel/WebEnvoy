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

### 11. Launch admission health matrix

Launch Envelope 冻结的状态型输入必须能被后续 admission 映射到统一健康矩阵。矩阵只表达判定口径，不实现检查器。

`launch_admission_health.state` 至少支持：

- `healthy`
- `disconnected`
- `recoverable`
- `blocked`
- `unknown`

最小矩阵：

| 输入 | healthy | disconnected | recoverable | blocked |
|---|---|---|---|---|
| profile lock | 独占锁已获取，且 lock owner 匹配本次 `run_id` | lock 文件存在但 owner 不可确认或通信断开 | stale lock 可被后续实现按正式规则回收 | 其他进程持有有效 lock 或 lock 状态 unknown |
| login state | `login_state_requirement=ready` 且 profile 被后续 readiness 证明可用 | profile 可定位但登录态检查无法完成 | `login_allowed` 且允许进入人工登录流程 | 需要登录态但状态为失效、unknown 或不允许登录 |
| extension identity | profile 内 stable `extension_id` 与 envelope 要求一致 | extension 状态暂不可读或 background 未响应 | extension 已安装但需要后续 bootstrap / reconnect | extension 缺失、id 不匹配或使用不允许的 staged extension |
| native messaging | host name / manifest ref / allowed origins 与 extension identity 匹配 | native host 暂不可连接 | host 存在但需后续 reconnect / bootstrap | host 缺失、manifest 不匹配或 `unknown` |
| runtime bootstrap | envelope 声明的 bootstrap requirement 可被后续 runtime admission 满足 | extension/native host 通道断开导致无法确认 | bootstrap 可重试且不改变 envelope 输入 | bootstrap requirement 缺失、过期、secret 进入静态资产或无法证明 |
| proxy / regional settings | proxy policy、locale、timezone、accept language 满足本次 requirement | profile proxy locator 暂不可读 | profile-bound proxy 可重新读取或重新绑定到同一 profile | proxy policy unknown、credential 内联、或违反 profile 黏性 |
| fingerprint policy | seed policy 与 profile consistency requirement 一致，且 refs 已脱敏 | seed locator 暂不可读 | provider-managed / profile seed 可在不泄露 seed 的情况下重查 | seed policy unknown、run-scoped 未被允许或 seed 明文进入 envelope |
| evidence requirements | required kinds、freshness、artifact policy 与 redaction ref 完整 | artifact sink 或 evidence locator 暂不可访问 | evidence sink 可重试且保持 same launch / same head freshness | required evidence 不可产出、freshness 不满足或 redaction 缺失 |

约束：

- `unknown` state 在影响目标 capability 时必须按 `blocked` 处理。
- `disconnected` 只表示暂时无法读取或连接，不能被当作 `healthy`。
- `recoverable` 必须有后续正式实现冻结的恢复动作；本 FR 不授权实现自行清理 lock、重写 profile 或重发 secret。
- 任何恢复动作不得改变 `launch_envelope` 的 provider、profile、fingerprint 或 evidence requirement；需要改变输入时必须生成新的 envelope。

### 12. 恢复路径与断连边界

Launch Envelope 的恢复语义必须按输入类型分栏：

- `profile_lock_recovery`：只允许后续实现按正式 lock owner / stale-lock 规则恢复；不得在本 FR 中授权强制删除 lock。
- `login_recovery`：仅当 `login_state_requirement=login_allowed` 时可进入人工登录引导；`ready` 失败不得静默降级。
- `extension_recovery`：允许后续 runtime admission 重新连接已安装 persistent extension；不得把 per-run staged extension 作为 official Chrome 主路径恢复方式。
- `native_messaging_recovery`：允许后续实现重连同一 native host binding；不得切换 host name 或 allowed origins 来绕过 mismatch。
- `runtime_bootstrap_recovery`：允许后续实现重发 run/session bootstrap；不得把 run/session secret 写入 extension paths 或 profile 永久元数据。
- `evidence_recovery`：允许后续 evidence kernel 重试 artifact sink；不得用旧 head、旧 run 或 same-head 历史 artifact 满足 `current_launch` freshness。

恢复结论必须显式落在：

- `healthy_after_recovery`
- `still_disconnected`
- `blocked_after_recovery`
- `new_envelope_required`

`new_envelope_required` 表示当前 envelope 不再是权威输入，后续实现必须重新生成并重新验证，不得复用旧 admission 结论。

### 13. 最小验证矩阵

后续实现进入 launch admission 前，至少需要覆盖以下验证点；本 FR 只冻结验证要求，不实现测试。

| 验证点 | 最低验证方式 | 不通过时结论 |
|---|---|---|
| provider contract ref | 静态解析 `FR-0033` shape、provider id、contract version、capability refs | `provider_contract_missing` 或 `provider_verification_insufficient` |
| profile lock | 校验 profile locator、lock policy、owner 与 same-run exclusivity | `profile_lock_unavailable` |
| login requirement | 校验 login state requirement 与 allowed transition | blocked login state |
| extension identity | 校验 extension binding mode、extension id、persistent profile binding | `extension_binding_missing` |
| native messaging | 校验 host name、manifest ref、allowed origins 与 required mode | `native_messaging_binding_missing` |
| browser mode | 校验 headed/headless、real browser、browser channel canonical label | `headless_conflict` 或 `no_real_browser_attestation` |
| network / regional | 校验 proxy policy 不为 unknown，secret 不内联，locale/timezone 可审计 | `proxy_policy_unknown` 或 secret redaction failure |
| fingerprint policy | 校验 seed policy、rotation policy、redacted refs 与 profile consistency | `fingerprint_policy_unknown` |
| evidence requirements | 校验 required kinds、artifact policy、freshness 与 redaction policy ref | `evidence_requirement_unmet` |

最小验证矩阵必须在后续 parser / admission tests 中覆盖 happy path、blocked path 与 recoverable path。任何只验证 happy path 的实现不得宣称满足本 FR 的进入实现前条件。

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

### 场景 7：profile lock 断连不能默认为健康

Given Launch Envelope 要求 `profile_lock_policy=exclusive_required`
And 后续 admission 无法确认 lock owner 或 runtime 通信断开
When admission 生成 health matrix
Then profile lock state 必须是 `disconnected` 或 `blocked`
And 不得把该状态当作 `healthy`
And 需要恢复时必须走正式 lock recovery 规则

### 场景 8：runtime bootstrap 恢复不能污染静态资产

Given Launch Envelope 要求 `runtime_bootstrap_required=true`
And runtime bootstrap 需要重试
When 后续实现执行 bootstrap recovery
Then 只能重发 run/session 级 bootstrap 输入
And 不得把 run/session secret 写入 `extension_paths`
And 如果需要改变 envelope 输入，结论必须是 `new_envelope_required`

## 异常与边界场景

- provider contract 存在但 `provider_id` 与 Launch Envelope 中声明不一致时，必须阻断。
- profile lock 不可获取时，正式业务 launch 必须阻断；只读共享降级需要后续 FR 单独冻结。
- profile lock owner 无法确认、Native Messaging 断连或 extension background 无响应时，只能进入 `disconnected` / `recoverable` / `blocked`，不得伪装成 ready。
- runtime bootstrap 可重试不等于 launch admission 已通过；重试后仍需重新记录 health conclusion。
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
4. health matrix、恢复路径与最小验证矩阵已覆盖 profile lock、login state、extension identity、native messaging、runtime bootstrap、proxy/fingerprint 与 evidence requirements。
5. GWT 覆盖 provider verification、real-browser/headless、persistent extension、secret redaction、evidence kernel、profile lock 断连与 runtime bootstrap recovery 边界。
6. 套件不实现 provider registry、doctor、evidence kernel、CLI 或 browser launch runtime 行为。
