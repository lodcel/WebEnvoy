# FR-0040 Provider Evidence Kernel

Canonical Issue: #1128

## 背景

`#1128` 属于 `#1111 Provider Runtime Foundation`，目标是在 provider runtime 继续实现前，冻结 WebEnvoy 可消费的 provider evidence kernel contract。上游 `FR-0033 Browser Provider Contract` 已冻结 provider identity、capability、verification level 与 limitations；`FR-0037 Launch Envelope Extraction` 已冻结一次 launch admission 的 provider、profile、browser mode、runtime bindings 与 evidence requirements。当前缺口是：后续 provider registry、launch admission、capability verification、doctor、selection、command output 与 closeout gate 需要同一份 evidence record 来回答“本次选择了哪个 provider、启动输入是什么、profile / extension / native messaging / version 事实由哪些证据证明、哪些证据必须脱敏、哪些缺口需要阻断”。

本 FR 只冻结 Provider Evidence Kernel 的 formal contract。它不实现 evidence collector、runtime evidence kernel、CLI 行为、provider doctor、browser launch、extension、Native Messaging、Playwright 或任何真实 runtime 行为。

`#1128` 的 issue meta 已声明 `Close Semantics: fr-complete`，scope 是 “Define provider evidence records for selected provider, version evidence, launch arguments, profile reference, extension status, native messaging status and closeout plan.” 因此本 suite 合入后只关闭 Provider Evidence Kernel 的规约冻结事项，不关闭 `#1127/#1129/#1130/#1135/#1136` 或任何 runtime implementation。

## 目标

1. 冻结 `provider_evidence_record` 的最小共享对象边界。
2. 冻结 selected provider、version evidence、launch arguments、profile reference、extension status、native messaging status 的 evidence section。
3. 冻结 evidence refs、redaction / sensitivity 标记、freshness、provenance 与 artifact identity 的最小机器契约。
4. 冻结 evidence closeout plan、required evidence coverage、blocking reason 与 fail-closed 规则。
5. 明确本 kernel 与 `FR-0033`、`FR-0035`、`FR-0036`、`FR-0037`、`FR-0016`、evidence redaction policy 和 Syvert consuming layer 的 ownership。

## 非目标

- 不实现 runtime evidence kernel、evidence collector、artifact writer、parser、validator、CLI command、provider selection、doctor command 或 browser launch code。
- 不修改 Chrome extension、Native Messaging host、Playwright launcher、profile lock、runtime bootstrap、stdout/stderr、exit code、GitHub workflow 或任何外部可见 runtime 行为。
- 不触碰 `#1127` / PR #1224 Provider Health Doctor 的文件或契约范围；本 FR 只允许为未来 doctor report 保留可选 `provider_health_ref`，不定义 doctor schema。
- 不触碰 `#1135/#1136`、Syvert normalized result、Syvert business schema、Syvert provider adapter 或 shared normalized mapping。
- 不把 CloakBrowser 设为 WebEnvoy core、默认 provider 或 browser patching 主路径。
- 不冻结完整 Evidence Redaction Policy；本 FR 只冻结 provider evidence record 内的 redaction refs、sensitivity 等级和不得内联 secret 的最低规则，完整策略由后续 `#1129` 或对应 policy 承接。
- 不把 stub/fake host、`runtime.ping`、`runtime.bootstrap` ack、历史 artifact 或 provider 自报提升为真实 live evidence。
- 不执行 live browser/runtime/account/external visible actions。

## 功能需求

### 1. Contract 定位与 ownership

- 系统必须冻结一个稳定的 `provider_evidence_record` 对象。
- `provider_evidence_record` 的 ownership 属于 WebEnvoy core provider/runtime evidence contract。
- 该对象只表达一次 provider selection / launch / runtime admission / closeout 可消费的证据索引、归一化状态与阻断结论。
- 该对象不得被解释为：
  - provider registry row
  - provider doctor report
  - launch envelope
  - runtime status row
  - live evidence record
  - Syvert normalized result
  - anti-detection baseline record
  - provider private patch manifest
- 后续实现若需要采集、存储或展示 provider evidence，必须保持本对象的 evidence ref、redaction 与 fail-closed 语义，不得用私有字段绕过阻断结果。

### 2. Record identity

`provider_evidence_record.identity` 必须至少冻结以下字段：

- `provider_evidence_record_id`
- `provider_evidence_contract_version`
- `run_id`
- `command_ref`
- `created_at`
- `evidence_scope`
- `base_refs`

约束：

- `provider_evidence_contract_version` 当前冻结为 `v1`。
- `run_id` 继承既有命令 / Launch Envelope 的 run id 语义；它不是 provider id、profile id、browser process id 或 artifact id。
- `command_ref` 只引用触发本次 evidence 归档的 WebEnvoy command，不替代 `FR-0034` Command Envelope v2。
- `created_at` 是 evidence record 生成时间，不是 launch 成功时间、doctor 完成时间或 live evidence 采集时间。
- `evidence_scope` 至少支持：
  - `selection`
  - `launch_admission`
  - `runtime_admission`
  - `capability_closeout`
  - `diagnostic`
- `base_refs` 必须能引用当前 record 消费的 formal contract，例如 `FR-0033.browser_provider_contract.v1` 与 `FR-0037.launch_envelope.v1`。

### 3. Selected provider evidence

`provider_evidence_record.selected_provider` 必须至少冻结以下字段：

- `provider_id`
- `provider_contract_ref`
- `provider_contract_version`
- `provider_mode`
- `provider_class_ref`
- `selection_reason`
- `selection_source`
- `selection_evidence_refs`

约束：

- `provider_id`、`provider_contract_ref`、`provider_contract_version` 与 `provider_mode` 必须与 `FR-0033.browser_provider_contract` 一致。
- `provider_class_ref` 可以引用 `FR-0036.browser_provider_registry_entry.provider_class`，但不得复制 registry row 或重定义 registry status。
- `selection_reason` 至少支持：
  - `default_eligible`
  - `explicit_request`
  - `diagnostic_only`
  - `fallback_candidate`
  - `blocked_candidate`
- `selection_source` 至少支持：
  - `provider_registry`
  - `launch_envelope`
  - `manual_override`
  - `diagnostic_input`
- `manual_override` 必须进入 evidence refs 与 closeout plan；它不得绕过 provider contract、limitations 或 integration gate。
- 选择证据缺失、provider id 不匹配、contract version 不匹配或 provider limitation 命中目标 capability 时，record 必须输出 blocking reason。

### 4. Version evidence

`provider_evidence_record.version_evidence` 必须至少冻结：

- `provider_version`
- `browser_channel`
- `browser_version`
- `extension_version`
- `native_host_version`
- `contract_version`
- `version_evidence_refs`

约束：

- `provider_version` 与 `contract_version` 必须来自 `FR-0033.provider_identity`。
- `browser_channel` 若指向 Google Chrome stable，必须使用 canonical label `Google Chrome stable`。
- `browser_version`、`extension_version`、`native_host_version` 可以为 `unknown`，但当目标 capability 要求对应事实时必须 fail-closed。
- 版本字段不得使用显示名称、profile 名称或本地路径临时代替。
- 版本 evidence refs 只能引用 redacted locator、artifact identity 或 doctor / runtime evidence source；不得内联完整 command output、absolute private path、token、Cookie 或 provider private patch payload。

### 5. Launch arguments evidence

`provider_evidence_record.launch_arguments` 必须至少冻结：

- `launch_envelope_ref`
- `launch_envelope_version`
- `provider_launch_ref`
- `browser_mode`
- `runtime_bindings`
- `network_regional_ref`
- `fingerprint_policy_ref`
- `launch_argument_evidence_refs`

约束：

- `launch_envelope_ref` 必须引用符合 `FR-0037.launch_envelope.v1` 的 Launch Envelope。
- `provider_launch_ref` 只能引用 launch input / snapshot locator，不得复制完整 CLI argv 或 secret-bearing env。
- `browser_mode` 必须保留 headed/headless、real browser requirement 与 browser channel 的 evidence conclusion，但不替代 `FR-0037` 的 admission rules。
- `runtime_bindings` 只能表达 extension / native messaging / runtime bootstrap 的 evidence status，不承载 bootstrap secret。
- `network_regional_ref` 与 `fingerprint_policy_ref` 只能是 redacted locator，不得内联 proxy credential、fingerprint seed、Cookie、token 或 concrete patch details。
- 若 `FR-0037.evidence_requirements.required_evidence_kinds` 要求 launch evidence，而本 section 缺失或 freshness 不满足，record 必须 fail-closed。

### 6. Profile reference evidence

`provider_evidence_record.profile_reference` 必须至少冻结：

- `profile_ref`
- `profile_binding_mode`
- `profile_lock_status`
- `login_state_evidence`
- `profile_persistence_status`
- `profile_evidence_refs`

约束：

- `profile_ref` 是 locator，不得包含 Cookie、token、LocalStorage、账号标识原文或 private absolute path，除非后续 redaction policy 明确允许更窄的 internal-only locator。
- `profile_lock_status` 至少支持：
  - `locked_by_current_run`
  - `shared_read_only`
  - `unlocked`
  - `stale_or_disconnected`
  - `blocked`
  - `unknown`
- 正式业务 launch 默认只能由 `locked_by_current_run` 满足 `exclusive_required`；`shared_read_only` 需要后续 FR 明确冻结降级规则。
- `login_state_evidence` 只能表达 `ready | login_allowed | not_required | blocked | unknown` 等状态，不得保存账号 secret。
- `unknown` profile lock 或 login state 在影响目标 capability 时必须阻断。

### 7. Extension status evidence

`provider_evidence_record.extension_status` 必须至少冻结：

- `extension_required`
- `extension_binding_mode`
- `extension_id`
- `extension_version`
- `extension_installation_status`
- `extension_runtime_status`
- `extension_evidence_refs`

约束：

- `extension_binding_mode` 必须与 `FR-0037.launch_envelope.runtime_bindings.extension_binding_mode` 对齐。
- official Chrome 主路径应表达为 `persistent_profile_extension`；不得把 per-run staged extension 写成正式主路径证据。
- `extension_installation_status` 至少支持：
  - `installed_in_profile`
  - `dev_unpacked`
  - `missing`
  - `mismatch`
  - `unknown`
- `extension_runtime_status` 至少支持：
  - `ready`
  - `disconnected`
  - `recoverable`
  - `blocked`
  - `unknown`
- `extension_id` 可以进入 evidence record，但不得携带 extension secret、runtime bootstrap payload 或 user account data。
- 当目标 capability 要求 extension binding 时，`missing|mismatch|blocked|unknown` 必须 fail-closed；`disconnected|recoverable` 不得被当作 `ready`。

### 8. Native Messaging status evidence

`provider_evidence_record.native_messaging_status` 必须至少冻结：

- `native_messaging_required`
- `native_host_name`
- `native_host_manifest_ref`
- `allowed_origin_ref`
- `native_host_version`
- `native_messaging_runtime_status`
- `native_messaging_evidence_refs`

约束：

- `native_host_name` 与 `native_host_manifest_ref` 必须与 `FR-0037.launch_envelope.runtime_bindings` 对齐。
- `allowed_origin_ref` 只能引用 redacted allowed origin evidence；不得内联 host secret 或 user token。
- `native_messaging_runtime_status` 至少支持：
  - `ready`
  - `disconnected`
  - `recoverable`
  - `blocked`
  - `unknown`
- 当目标 capability 要求 Native Messaging 时，host name 缺失、manifest mismatch、allowed origin mismatch、`blocked` 或 `unknown` 必须 fail-closed。
- `runtime.ping` 或 bootstrap ack 可以作为 control-plane evidence ref，但不得单独证明真实页面交互或 live evidence closeout。

### 9. Evidence refs、redaction 与 provenance

`provider_evidence_record.evidence_refs[*]` 必须至少冻结：

- `evidence_ref_id`
- `kind`
- `ref`
- `source`
- `status`
- `collected_at`
- `freshness`
- `sensitivity`
- `redaction_state`
- `artifact_identity`

`kind` 至少支持：

- `provider_contract_ref`
- `registry_entry_ref`
- `launch_envelope_ref`
- `launch_config_snapshot`
- `profile_binding_ref`
- `extension_binding_ref`
- `native_messaging_binding_ref`
- `runtime_bootstrap_ref`
- `browser_channel_attestation`
- `version_attestation`
- `provider_health_ref`
- `runtime_observation_ref`
- `live_evidence_ref`
- `closeout_artifact_ref`

`source` 至少支持：

- `provider_contract`
- `provider_registry`
- `launch_envelope`
- `provider_doctor`
- `runtime_admission`
- `runtime_observation`
- `live_evidence_gate`
- `manual_review`

`status` 至少支持 `available`、`partial`、`unavailable`、`not_applicable`。

`freshness` 至少支持:

- `current_record`
- `current_launch`
- `current_pr_head`
- `historical_background`
- `not_applicable`

`sensitivity` 至少支持 `public`、`internal`、`sensitive`、`secret`。

`redaction_state` 至少支持：

- `redacted`
- `redaction_required`
- `not_required`
- `policy_missing`
- `invalid`

约束：

- `sensitivity=secret` 的值不得进入 PR body、stdout summary、unredacted artifact 或 spec sample。
- `redaction_required|policy_missing|invalid` 命中 required evidence 时必须阻断，除非后续 redaction policy 明确冻结降级规则。
- `provider_health_ref` 只是可选 evidence source locator；它不定义 doctor schema，也不依赖 #1127 在本 PR 中落地。
- `live_evidence_ref` 不等于 `FR-0016.live_evidence_record` 本体；它只能引用适用 gate 已接受的 latest-head live evidence。
- `historical_background` 可以辅助解释，但不得满足 `current_launch` 或 `current_pr_head` freshness requirement。

### 10. Closeout plan

`provider_evidence_record.closeout_plan` 必须至少冻结：

- `required_evidence_kinds`
- `required_freshness`
- `minimum_attestation_level`
- `coverage_status`
- `blocking_reasons`
- `missing_evidence`
- `redaction_gaps`
- `next_required_gates`
- `closeout_decision`

`coverage_status` 至少支持：

- `complete`
- `partial`
- `missing_required`
- `blocked`
- `unknown`

`closeout_decision` 至少支持：

- `allow`
- `deny`
- `defer`

约束：

- `required_evidence_kinds` 必须可从 `FR-0037.launch_envelope.evidence_requirements` 与目标 capability minimum verification requirement 推导。
- `minimum_attestation_level` 只能使用 `FR-0033` verification level 枚举。
- `allow` 只表示 provider evidence record 满足当前 closeout plan；不表示真实 live evidence gate、guardian、GitHub checks 或 merge gate 已通过。
- `deny` 表示存在 required evidence 缺失、freshness 不足、redaction 违规或 provider/runtime blocker。
- `defer` 只能用于 spec / diagnostic / pre-admission 阶段；业务执行不得把 `defer` 当作 `allow`。
- 若 `blocking_reasons` 非空，`closeout_decision` 必须为 `deny`，除非该 blocker 明确只影响未请求 optional capability。

### 11. Blocking reason 与 fail-closed

`provider_evidence_record.blocking_reason` 必须至少支持：

- `provider_contract_missing`
- `provider_contract_version_mismatch`
- `provider_selection_unproven`
- `provider_limitation_conflict`
- `launch_envelope_missing`
- `launch_argument_snapshot_missing`
- `profile_ref_missing`
- `profile_lock_unavailable`
- `profile_login_state_unknown`
- `extension_binding_missing`
- `extension_status_unready`
- `native_messaging_binding_missing`
- `native_messaging_status_unready`
- `version_evidence_missing`
- `evidence_ref_invalid`
- `evidence_ref_unavailable`
- `evidence_freshness_stale`
- `redaction_policy_missing`
- `redaction_invalid`
- `secret_leak_detected`
- `live_evidence_required`
- `runtime_attestation_required`
- `manual_review_required`
- `source_conflict`

fail-closed 规则：

- provider contract missing、version mismatch 或 provider id 不一致时必须阻断。
- selected provider 不能证明来自 registry / launch envelope / explicit request 时必须阻断。
- launch evidence freshness 不能满足 `current_launch` 时必须阻断当前 launch closeout。
- `current_pr_head` required evidence 不能由旧 head、旧 run、历史 artifact 或 same-head 历史 artifact 替代。
- profile、extension、Native Messaging 任一 required status 为 `blocked|unknown` 时必须阻断。
- `disconnected|recoverable` 只能进入恢复或补证路径，不能被当作 ready。
- required evidence ref 为 `unavailable|partial` 且没有正式降级规则时必须阻断。
- `sensitivity=secret` 未脱敏、redaction policy 缺失或 redaction invalid 时必须阻断。
- runtime/live evidence 需求不得由 provider 自报、doctor pass、stub/fake host、`runtime.ping` 或 bootstrap ack 替代。

### 12. 明确边界关系

本 FR 必须明确：

- 与 `FR-0033`：provider evidence record 消费 provider identity、contract version、verification level 与 limitations；不修改 Browser Provider Contract。
- 与 `FR-0035`：capability verification record 可以消费 provider evidence refs；本 FR 不重定义 support state 或 selection policy。
- 与 `FR-0036`：selected provider 可引用 registry entry；本 FR 不重定义 registry row、default eligibility 或 provider class。
- 与 `FR-0037`：provider evidence record 消费 Launch Envelope 的 provider/profile/runtime binding/evidence requirements；Launch Envelope 声明要求，本 FR 记录 evidence refs 与 closeout coverage。
- 与 `FR-0016`：真实 live evidence gate 仍由 `FR-0016` 持有；本 FR 只能引用 gate 已接受的 live evidence，不自证 live closeout。
- 与 evidence redaction policy：本 FR 冻结最小 sensitivity / redaction_state / redaction ref 要求；完整 redaction policy 由后续独立事项承接。
- 与 Syvert：该 contract 只属于 WebEnvoy provider/runtime evidence shared surface，不包含 Syvert normalized result 或 product workflow；integration gate 锚定 `#1111`，不引入 Syvert external dependency。

## GWT 验收场景

### 场景 1：selected provider 必须能回溯到 FR-0033 contract

Given 一个 `provider_evidence_record.selected_provider.provider_id=official-chrome-stable`
And `provider_contract_ref` 指向 `FR-0033.browser_provider_contract.v1`
When 后续 admission 消费该 evidence record
Then consumer 必须校验 provider id、contract version 与 provider mode 一致
And 不得只凭显示名称或 registry priority 判定 provider 已被证明

### 场景 2：Launch Envelope required evidence 缺失时阻断

Given `FR-0037.launch_envelope.evidence_requirements.required_evidence_kinds` 包含 `launch_config_snapshot`
And provider evidence record 缺少对应 `launch_config_snapshot` evidence ref
When closeout plan 计算 coverage
Then `coverage_status` 必须为 `missing_required` 或 `blocked`
And `closeout_decision` 必须为 `deny`

### 场景 3：profile ref 不得泄露账号 secret

Given provider evidence record 需要记录 `profile_ref`
When evidence refs 被写入 artifact 或 PR summary
Then `profile_ref` 只能是 redacted locator
And 不得包含 Cookie、token、LocalStorage、账号敏感字段或未脱敏私有路径

### 场景 4：extension disconnected 不等于 ready

Given 目标 capability 要求 extension binding
And `extension_runtime_status=disconnected`
When provider evidence record 被用于 runtime admission
Then admission 必须进入 recover / defer / deny 路径
And 不得把 disconnected 当作 ready 或 runtime_attested

### 场景 5：Native Messaging bootstrap ack 不等于 live evidence

Given `native_messaging_runtime_status=ready`
And evidence refs 只包含 `runtime_bootstrap_ref`
When closeout plan 要求 `live_evidence_attested`
Then record 必须输出 `live_evidence_required`
And 不得把 bootstrap ack 当作真实页面交互成功

### 场景 6：版本证据 unknown 在命中目标能力时阻断

Given 目标 capability 要求 Google Chrome stable version attestation
And `version_evidence.browser_version=unknown`
When closeout plan 计算 required evidence coverage
Then `blocking_reasons` 必须包含 `version_evidence_missing`
And `closeout_decision` 必须为 `deny`

### 场景 7：historical evidence 不能满足 current launch freshness

Given required evidence freshness 是 `current_launch`
And matching evidence ref 的 freshness 是 `historical_background`
When provider evidence record 被用于当前 launch closeout
Then record 必须输出 `evidence_freshness_stale`
And 不得复用历史 artifact 作为当前 launch proof

### 场景 8：redaction policy 缺失时不得放行 required evidence

Given required evidence ref 的 sensitivity 是 `sensitive`
And `redaction_state=policy_missing`
When closeout plan 计算 coverage
Then record 必须输出 `redaction_policy_missing`
And 不得把该 evidence ref 写成 closeout complete

## 异常与边界场景

- provider evidence record 缺少 `provider_evidence_contract_version` 或 `run_id` 时，必须视为无效 record。
- `selected_provider.provider_id` 与 referenced provider contract 不一致时，必须阻断。
- `launch_envelope_ref` 缺失但 closeout plan 需要 launch evidence 时，必须阻断。
- `profile_lock_status=unknown|blocked` 命中 required profile binding 时，必须阻断。
- `extension_installation_status=dev_unpacked` 不得被写成 official Chrome persistent profile extension 主路径证据。
- `native_host_manifest_ref` 指向不可追溯 locator 时，必须输出 `native_messaging_binding_missing` 或 `evidence_ref_invalid`。
- `source_conflict` 出现时必须取更保守结论；不得按数组顺序选一个来源。
- `manual_review` 可以确认证据引用一致性，但不得单独把 record 提升到 runtime 或 live evidence attested。
- `provider_health_ref` 缺失不得阻断所有场景；只有 closeout plan 或目标 capability 明确要求 doctor / health evidence 时才阻断。
- 本 FR 的 sample 或 PR metadata 不得包含真实 profile、secret、account、browser history、cookie、token、proxy credential 或 provider private patch payload。

## 验收标准

1. `provider_evidence_record` 的字段、枚举、ownership、evidence refs、redaction 状态、freshness 与 fail-closed 规则已冻结。
2. selected provider、version evidence、launch arguments、profile reference、extension status 与 Native Messaging status 均有明确 evidence section。
3. closeout plan 覆盖 required evidence kinds、freshness、minimum attestation level、coverage status、blocking reasons、missing evidence、redaction gaps 与 decision。
4. 本 suite 明确消费 `FR-0033` 与 `FR-0037`，并与 `FR-0035`、`FR-0036`、`FR-0016` 和后续 redaction policy 分清 ownership。
5. GWT 覆盖 provider contract 回溯、launch evidence 缺失、profile redaction、extension disconnected、Native Messaging bootstrap、version unknown、freshness stale 与 redaction policy missing。
6. 套件不实现 runtime evidence kernel、CLI、browser launch、doctor、extension、Native Messaging、Playwright 或 live/runtime 行为。
