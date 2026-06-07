# FR-0038 Provider Health / Doctor Contract

Canonical Issue: #1127

## 背景

`#1127` 属于 M2 `Provider Runtime Foundation`，目标是在实现 provider doctor 或运行时健康检查前，冻结 WebEnvoy 可消费的 provider health / doctor contract。

上游 `FR-0033 Browser Provider Contract` 已冻结 `browser_provider_contract`、capability declaration、verification level 与 limitation 的基础对象，并明确 doctor / health / evidence inspection 是后续事项。本 FR 只承接 doctor / health 的共享诊断契约：它定义哪些健康检查必须被表达、doctor report 如何机器可读、如何把 provider 自报推进到 `doctor_checked`，以及哪些失败必须 fail-closed。

本 FR 不实现 doctor 命令，不执行真实 runtime 检查，不修改 extension、native messaging、profile、Playwright、CLI 或任何外部可见行为。`#1127` 的 issue meta 已声明 `Close Semantics: fr-complete`，因此本 formal suite 合入后只关闭 Provider Health / Doctor Contract 的规约冻结事项，不关闭 `#1124/#1125/#1126/#1128/#1130` 的实现或相邻契约。

## 目标

1. 冻结 `provider_doctor_report` 的最小共享对象边界。
2. 冻结 binary、version、extension load、native messaging、display/headless mode、profile persistence 与 capability-specific readiness 的健康检查分类。
3. 冻结 doctor result、severity、blocking status、evidence refs 与 fail-closed 规则。
4. 明确 doctor contract 与 `FR-0033` verification level 的关系：doctor 可把对应 provider/capability 推进到 `doctor_checked`，但不能自证 runtime ready 或 live evidence ready。
5. 为后续 doctor command、provider registry、provider selection、capability verification 和 evidence kernel 提供 formal 输入。

## 非目标

- 不实现 `webenvoy provider doctor`、`doctor` CLI 子命令、runtime status 或任何健康检查执行代码。
- 不修改 Chrome extension、Native Messaging host、Playwright launcher、profile lock、browser launch envelope 或外部可见 runtime 行为。
- 不触碰 `#1124/#1125/#1126/#1128/#1130` 的实现范围。
- 不重定义 `FR-0033` 的 provider identity、mode、browser engine、automation transport、capability declaration、verification level 或 limitation 枚举。
- 不把 doctor pass 写成 `runtime_attested`、`live_evidence_attested`、真实页面交互成功或账号安全通过。
- 不冻结 Syvert normalized result、Syvert business schema、provider-specific private patch schema 或 CloakBrowser 内部 driver 状态。

## 功能需求

### 1. Contract 定位与 ownership

- 系统必须冻结一个稳定的 `provider_doctor_report` 对象。
- `provider_doctor_report` 的 ownership 属于 WebEnvoy core provider/runtime diagnostics contract。
- 该对象只表达一次 provider health / doctor 评估的机器可读结果。
- 该对象不得被解释为：
  - provider registry row
  - runtime instance status
  - launch envelope
  - live evidence record
  - Syvert normalized result
  - anti-detection baseline record
- 后续实现若需要存储、展示或消费 doctor report，必须保持本对象的 fail-closed 语义，不得用私有字段绕过阻断结果。

### 2. Report identity

`provider_doctor_report.identity` 必须至少冻结以下字段：

- `doctor_report_id`
- `doctor_contract_version`
- `provider_id`
- `provider_contract_version`
- `provider_version`
- `generated_at`
- `scope`

约束：

- `doctor_contract_version` 当前冻结为 `v1`。
- `provider_id`、`provider_contract_version`、`provider_version` 必须来自 `FR-0033.browser_provider_contract.provider_identity`，不得使用显示名称、profile 名称或 browser channel 临时代替。
- `scope` 至少支持：
  - `static`
  - `local_runtime`
  - `attach_target`
  - `capability`
- `generated_at` 只能表达 doctor report 生成时间；不能被用作 runtime readiness 或 live evidence 采集时间。

### 3. Health check categories

`provider_doctor_report.checks[*].category` 必须至少支持：

- `binary`
- `version`
- `extension_load`
- `native_messaging`
- `display_mode`
- `profile_persistence`
- `capability_readiness`

约束：

- `binary` 检查表达浏览器/provider 可执行文件、入口或 adapter binary 是否存在、可访问、来源可解释。
- `version` 检查表达 browser version、provider version 与 declared version range 是否匹配。
- `extension_load` 检查表达 extension binding 是否可验证，包括 extension id/source/profile 绑定事实；不替代 `FR-0015` 的 persistent extension identity contract。
- `native_messaging` 检查表达 Native Messaging host、allowed origin、manifest locator 与 transport 可达性；不替代 runtime bootstrap 或真实消息闭环。
- `display_mode` 检查表达 headed/headless/display availability 与 `FR-0033.browser_engine.headless_policy` 的匹配情况。
- `profile_persistence` 检查表达 named profile、profile path、lock/persistence 与 declared requirement 的匹配情况；不替代 `FR-0003` profile lock runtime state。
- `capability_readiness` 检查表达某个 `capability_id` 的 runtime requirements 是否被 doctor 层满足到可进入下一阶段 admission 的程度。

### 4. Check result 与 severity

每条 `provider_doctor_report.checks[*]` 必须至少包含：

- `check_id`
- `category`
- `status`
- `severity`
- `blocking`
- `capability_id`
- `summary`
- `diagnostics`
- `evidence_refs`

`status` 至少支持：

- `pass`
- `warn`
- `fail`
- `not_applicable`
- `unknown`

`severity` 至少支持：

- `info`
- `warning`
- `error`
- `fatal`

`blocking` 至少支持：

- `none`
- `capability_blocking`
- `provider_blocking`

约束：

- `status=unknown` 在影响目标 provider 或 capability admission 时必须 fail-closed。
- `severity=fatal` 必须对应 `blocking=provider_blocking`，除非该检查被明确标记为 `not_applicable`。
- `status=fail` 不得对应 `blocking=none`，除非该失败只影响未请求的 optional capability，并且 `capability_id` 指向该 optional capability。
- `capability_id` 对 provider-level 检查可为 `N/A`；对 capability-specific readiness 必须精确匹配 `FR-0033.capabilities[*].capability_id`。
- `diagnostics` 必须机器可读，至少能表达 failure code、observed value、expected value 与 remediation hint；不得只写自由文本。

### 5. Required checks 与 declared requirements 对齐

doctor consumer 必须把 `FR-0033.browser_provider_contract` 中的声明映射为 required checks：

- `provider_identity` 指向的 browser/provider executable、launcher entry 或 adapter binary 要求 `binary` 检查；该检查是 provider-level required check。
- `browser_engine.browser_version_range` 要求 `version` 检查。
- `browser_engine.extension_binding_support=required` 或 capability runtime requirement 包含 `extension_binding` 时，要求 `extension_load` 检查。
- `automation_transport.native_messaging_support=required` 或 capability runtime requirement 包含 `native_messaging` 时，要求 `native_messaging` 检查。
- `browser_engine.headless_policy=forbidden` 或 capability runtime requirement 包含 `headless_forbidden` / `real_browser` 时，要求 `display_mode` 检查。
- `browser_engine.profile_binding_support=required` 或 capability runtime requirement 包含 `profile_binding` 时，要求 `profile_persistence` 检查。
- 每个被请求 capability 必须有对应 `capability_readiness` 检查。

约束：

- required check 缺失时，doctor report 对受影响 provider 或 capability 必须 fail-closed。
- optional support 字段不得被解释为 readiness 已通过；它只能减少 required check 的最低集合。
- doctor report 可以包含额外检查，但额外检查不得覆盖 required check 的失败结果。

### 6. Capability-specific readiness

`capability_readiness` 检查必须至少表达：

- `capability_id`
- `required_runtime_requirements`
- `satisfied_runtime_requirements`
- `unsatisfied_runtime_requirements`
- `minimum_next_verification_level`

约束：

- `required_runtime_requirements` 必须来自 `FR-0033.capabilities[*].runtime_requirements`。
- `satisfied_runtime_requirements` 只能表达 doctor 层能证明的本地/attach 前置事实。
- `provider_doctor_passed` 是 doctor 层可满足的 runtime requirement：只有当该 capability 的所有 required doctor checks 均为 `pass|not_applicable`、无 `capability_blocking`，且 provider-level required checks 无 `provider_blocking` 时，才能进入 `satisfied_runtime_requirements`。
- 若 capability 声明了 `provider_doctor_passed`，但任一 required doctor check 缺失、`fail`、`unknown` 或 blocking，`provider_doctor_passed` 必须进入 `unsatisfied_runtime_requirements`，且该 capability 必须 fail-closed。
- `target_tab` 不能由 doctor report 直接满足；doctor report 不拥有目标 tab 绑定、tab id 或页面上下文的新鲜 runtime evidence。声明了 `target_tab` 的 capability 必须把它保留在 `unsatisfied_runtime_requirements`，并通过后续 `runtime_attestation` gate fail-closed。
- `runtime_bootstrap_ready` 不能由 doctor report 直接满足；只能标记为需要后续 runtime gate。`runtime_attested` 与 `live_evidence_attested` 是 verification level，不得被当作 runtime requirement 写入 `satisfied_runtime_requirements`。
- `minimum_next_verification_level` 至少支持：
  - `runtime_attested`
  - `live_evidence_attested`
  - `not_applicable`
- 对业务 `read/write/download` capability，doctor pass 只允许把 verification 提升到 `doctor_checked`，不得直接进入业务执行默认选择，除非后续 selection FR 明确允许某类低风险 diagnostic-only consumption。

### 7. Aggregate outcome

`provider_doctor_report.outcome` 必须至少包含：

- `overall_status`
- `provider_blocked`
- `blocked_capabilities`
- `doctor_verification_level`
- `next_required_gates`

`overall_status` 至少支持：

- `pass`
- `warn`
- `fail`
- `unknown`

约束：

- 任一 required provider-level check `fail|unknown` 且 `blocking=provider_blocking` 时，`overall_status` 必须为 `fail|unknown`，`provider_blocked=true`。
- 任一 requested capability check `fail|unknown` 且 `blocking=capability_blocking` 时，对应 capability 必须进入 `blocked_capabilities`。
- `doctor_verification_level` 只能为 `declared_only`、`static_checked` 或 `doctor_checked`，不得写 `runtime_attested` 或 `live_evidence_attested`。
- `next_required_gates` 用于列出仍需 runtime/evidence/selection gate 消费的事实，不表示这些 gate 已通过。

### 8. Evidence refs 与脱敏边界

doctor report 可以引用证据，但不得内嵌敏感 runtime 原文。`evidence_refs[*]` 必须至少表达：

- `kind`
- `ref`
- `status`
- `collected_at`
- `sensitivity`

约束：

- `kind` 至少支持：
  - `local_file_ref`
  - `command_output_ref`
  - `extension_state_ref`
  - `native_manifest_ref`
  - `profile_state_ref`
  - `doctor_artifact_ref`
- `status` 至少支持 `available`、`partial`、`unavailable`、`not_applicable`。
- `sensitivity` 至少支持 `public`、`internal`、`sensitive`、`secret`.
- `sensitivity=secret` 的值不得进入 PR body、stdout summary 或 unredacted report。
- doctor evidence refs 不等于 `FR-0016.live_evidence_record`，不得用于关闭真实 live evidence gate。

### 9. Fail-closed 规则

doctor consumer 必须按以下规则 fail-closed：

- required check 缺失。
- required check 为 `status=fail|unknown`。
- check category 不在 closed enum 内。
- `capability_id` 无法匹配 `FR-0033` capability。
- check 声称满足 `runtime_bootstrap_ready`、`runtime_attested` 或 `live_evidence_attested`。
- `display_mode` 与 `headless_policy=forbidden` 冲突。
- `extension_load` 无法证明 required extension binding。
- `native_messaging` 无法证明 required host / origin / manifest locator。
- `profile_persistence` 无法证明 required profile binding 或 persistence。
- evidence refs 缺失、不可用或 sensitivity 违反脱敏要求，且该证据是 required check 的唯一依据。

### 10. 明确边界关系

本 FR 必须明确：

- 与 `FR-0033`：doctor report 消费 `browser_provider_contract`，并可把 provider/capability verification 提升到 `doctor_checked`；不修改 `FR-0033` 字段和枚举。
- 与 `FR-0015`：persistent extension、runtime bootstrap 与 official Chrome readiness 仍由 `FR-0015` 持有；doctor 只能引用或检查其前置事实。
- 与 `FR-0003`：profile lock、profile lifecycle 与 runtime session persistence 仍由 `FR-0003` 持有；doctor 只表达 profile persistence readiness。
- 与 `FR-0016`：真实 live evidence gate 仍由 `FR-0016` 持有；doctor report 不构成 latest-head live evidence。
- 与 Syvert：该 contract 只属于 WebEnvoy provider/runtime diagnostics shared surface，不包含 Syvert normalized result 或 product workflow；integration gate 锚定 `#1111`，不引入 Syvert external dependency。

## GWT 验收场景

### 场景 1：required extension check 缺失时阻断 capability

Given provider contract 的某个 capability 要求 `extension_binding`
And doctor report 没有 `extension_load` required check
When 后续 capability admission 消费 doctor report
Then 该 capability 必须 fail-closed
And 不得把 provider 自报 support 当作 extension loaded

### 场景 2：doctor pass 不等于 runtime attested

Given doctor report 的所有 required checks 都为 `pass`
When 后续 provider verification 更新状态
Then provider/capability 最高只能提升到 `doctor_checked`
And 不得写成 `runtime_attested` 或 `live_evidence_attested`

### 场景 3：headless policy 冲突时 provider 阻断

Given provider contract 的 `headless_policy=forbidden`
And doctor report 的 `display_mode` 发现当前执行面为 headless-only
When doctor outcome 聚合
Then `overall_status` 必须为 `fail`
And `provider_blocked=true`

### 场景 4：capability readiness 只影响目标 capability

Given provider 有 `read` 与 `download` 两个 capability
And doctor report 中 `download` 的 `capability_readiness` 为 `fail`
When selection 请求 `read` capability
Then `download` 必须进入 `blocked_capabilities`
And `read` 不因 unrelated optional failure 自动阻断
And provider-level required check 失败仍必须阻断全部 capability

### 场景 5：secret evidence 不得进入 report 摘要

Given native messaging manifest 检查需要引用本地路径或敏感配置
When doctor report 生成 evidence refs
Then secret 原文不得进入 stdout summary 或 PR body
And report 只能提供 redacted artifact ref 或 internal locator

### 场景 6：Syvert mapping 不进入 doctor contract

Given Syvert 未来可能消费 doctor diagnostics
When reviewer 检查 `provider_doctor_report`
Then 不应出现 Syvert normalized result、business schema 或 product workflow 字段
And PR metadata 仍以 `integration_ref=#1111` 锚定 WebEnvoy provider runtime foundation

## 异常与边界场景

- `doctor_contract_version` 缺失或不是 `v1`：视为 doctor report invalid。
- `provider_id` 无法匹配 `FR-0033.browser_provider_contract.provider_identity.provider_id`：视为不可消费。
- required check 缺失：受影响 provider/capability 必须 fail-closed。
- `status=unknown` 影响目标 capability：默认阻断。
- `severity=fatal` 却未阻断 provider：视为 report invalid。
- `capability_readiness` 引用不存在的 capability：视为 report invalid。
- doctor report 声称已完成 live evidence、runtime bootstrap 或真实页面交互：视为范围漂移。
- report 内嵌 secret、cookie、token、完整 manifest secret 或 profile 私密原文：视为脱敏违规。

## 验收标准

1. `provider_doctor_report` 的 identity、check category、check result、severity、blocking、capability readiness、aggregate outcome 与 evidence refs 已冻结。
2. 套件已覆盖 binary、version、extension load、native messaging、display/headless mode、profile persistence 与 capability-specific readiness。
3. 套件已明确 doctor report 只能达到 `doctor_checked`，不替代 runtime attestation、live evidence、profile lock 或 FR-0015 readiness。
4. 当前 PR 只承载 formal spec review，不混入 runtime/provider registry、doctor command、adapter implementation、external runtime behavior 或治理五文件修改。
5. PR metadata 使用 `Fixes #1127`，且仅关闭 `#1127` 的 Provider Health / Doctor Contract contract-freeze FR；不关闭 `#1124/#1125/#1126/#1128/#1130`。
6. PR metadata 声明 provider/shared-contract integration gate：
  - `integration_applicable=yes`
  - `integration_ref=#1111`
  - `shared_contract_changed=yes`
  - `external_dependency=none`
  - `merge_gate=integration_check_required`
  - `contract_surface=diagnostics_observability`
  - `joint_acceptance_needed=no`

## 依赖与前置条件

- GitHub 事项：
  - `#1127` Provider Health / Doctor Contract
  - `#1111` Provider Runtime Foundation
- 上游基线：
  - `FR-0033-browser-provider-contract`
  - `vision.md`
  - `docs/dev/roadmap.md`
  - `docs/dev/architecture/system-design.md`
  - `docs/dev/architecture/system-design/boundary.md`
  - `FR-0015-official-chrome-runtime-migration`
  - `FR-0016-live-evidence-governance-gate`
  - `FR-0003-min-session`
- 后续但不由本 FR 承接：
  - `#1124`
  - `#1125`
  - `#1126`
  - `#1128`
  - `#1130`
