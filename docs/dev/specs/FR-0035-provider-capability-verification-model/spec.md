# FR-0035 Provider Capability Verification Model

Canonical Issue: #1124

## 背景

`#1124` 属于 M2 `provider-runtime-pr2-3-contracts`，依赖已经合入 main 的 `FR-0033 Browser Provider Contract`。`FR-0033` 已冻结 `browser_provider_contract.capabilities[*].verification_level`、provider-level verification 与 limitations，但尚未单独冻结“一个 capability 如何从声明、静态检查、健康检查、runtime attestation 和 runtime-observed evidence 被判定为可用、部分可用或阻断”的验证模型。

本 FR 的职责是冻结 Provider Capability Verification Model，使后续 provider registry、provider doctor、selection、evidence kernel 或 adapter implementation 可以引用同一套 support state、verification source、evidence record 与 fail-closed 判定规则。

`#1124` 的 issue meta 声明 `Close Semantics: fr-complete`，scope 是 “Define support states and verification sources such as declared, build-time, health-check and runtime-observed capability evidence”。因此本 PR 的 `Fixes #1124` 只关闭 capability verification model 的 formal spec freeze；runtime/provider registry、doctor 命令、evidence kernel、provider implementation、Syvert normalized result 与 live/runtime behavior 不属于 `#1124` 自身关闭条件。

## 目标

1. 冻结 capability support state 的最小枚举与语义。
2. 冻结 declared、build-time/static、health-check/doctor、runtime-attested、runtime-observed 与 live-evidence-attested 的 verification source 语义。
3. 冻结 capability verification evidence record 的最小对象边界，供后续实现引用。
4. 冻结 verification source 到 support decision 的 decision policy 与 fail-closed 判定规则。
5. 明确本模型与 `FR-0033 Browser Provider Contract`、provider registry、doctor、runtime evidence kernel、FR-0016 live evidence gate 和 Syvert consuming layer 的 ownership。

## 非目标

- 不实现 runtime/provider registry、provider selection、doctor 命令、evidence kernel、CLI 行为、adapter implementation 或 runtime 状态推进器。
- 不修改 extension、native host、Playwright、runtime bootstrap、runtime status、live evidence 或任何外部可见执行行为。
- 不触碰 `#1125/#1126/#1127/#1128/#1130` 的实现范围。
- 不修改 `FR-0033` 已冻结的 `browser_provider_contract` shape；本 FR 只定义如何消费和判定其中的 capability verification。
- 不冻结 Syvert normalized result、Syvert business schema、Syvert provider adapter 或跨仓业务映射。
- 不把 CloakBrowser 或其他 provider 的私有 stealth patch、driver 内部状态、浏览器 patch 细节写成 WebEnvoy core contract。
- 不把 provider doctor success、runtime ping、stub/fake host 成功或历史 artifact 提升为真实 live evidence。
- 不重定义 `FR-0015` runtime readiness、`FR-0016` PR 级 live evidence gate 或 `FR-0020` anti-detection validation baseline。

## 功能需求

### 1. Model 定位与 ownership

- 系统必须冻结一个稳定的 `provider_capability_verification_model`。
- 该模型属于 WebEnvoy core provider/runtime formal boundary。
- 该模型只表达如何把 `FR-0033` 中的 provider capability declaration 和外部验证事实转化为 capability support decision。
- 该模型不得被解释为：
  - provider registry row
  - provider selection policy
  - provider doctor report schema
  - runtime status row
  - live evidence record
  - Syvert normalized mapping schema
  - CloakBrowser 私有 patch manifest
- 后续实现若需要持久化 verification records、执行 doctor 或选择 provider，必须在独立 issue / FR 中定义存储、命令与 selection 语义，不能反向扩大本模型职责。

### 2. Capability support state

`provider_capability_verification_model.support_state` 必须至少支持：

- `unsupported`
- `declared`
- `statically_verified`
- `health_checked`
- `runtime_attested`
- `runtime_observed`
- `live_evidence_attested`
- `blocked`

约束：

- `unsupported` 表示 provider contract 未声明目标 capability，或声明内容与目标 capability 不匹配。
- `declared` 表示 capability 只来自 provider 自报，不足以进入默认业务执行选择。
- `statically_verified` 表示 contract shape、枚举、必填字段、本地引用和明显 limitation 冲突已通过静态检查。
- `health_checked` 表示 provider doctor 或等价健康检查证明 provider / capability 的检查项通过，但不等于 runtime ready 或真实页面闭环成功。
- `runtime_attested` 表示 runtime attach、bootstrap、profile/extension/native messaging 等对应 runtime contract 事实已证明满足 capability 前置。
- `runtime_observed` 表示在当前 runtime 执行面观察到 capability 所需的关键行为或 artifact 产出，但尚未满足适用 live evidence gate。
- `live_evidence_attested` 表示 capability 已引用符合适用 FR / PR / issue 门禁的 latest-head live evidence。
- `blocked` 表示任一 fail-closed 条件命中；blocked 必须优先于所有非阻断 support state。

### 3. Verification source

`provider_capability_verification_model.verification_source` 必须至少支持：

- `provider_declaration`
- `static_contract_check`
- `build_time_check`
- `provider_health_check`
- `runtime_attestation`
- `runtime_observation`
- `live_evidence_gate`
- `manual_review_attestation`

约束：

- `provider_declaration` 只能来自 `FR-0033 browser_provider_contract.capabilities` 及其 top-level support fields。
- `static_contract_check` 只能证明字段、枚举、required arrays、capability id 匹配、limitation 冲突和 canonical labels 等 contract-level 事实。
- `build_time_check` 只能证明本地构建产物、adapter package、manifest、schema fixture 或 bundled metadata 存在并匹配，不证明 runtime 可连接。
- `provider_health_check` 只能证明 doctor / health 语义通过，不证明真实页面交互或 latest-head live closeout。
- `runtime_attestation` 必须来自对应 runtime contract 的 attach/bootstrap/readiness/profile/extension/native messaging 事实。
- `runtime_observation` 必须来自当前 runtime 执行面的 observation、artifact identity、diagnostic event 或 equivalent run evidence；它不得绕过浏览器内执行原则直接对目标站点发 HTTP 请求。
- `live_evidence_gate` 必须引用 `FR-0016` 或后续适用 gate 要求的 latest-head run / artifact / PR metadata。
- `manual_review_attestation` 只能作为 reviewer 对 contract 与 evidence 引用一致性的判定，不得单独把 capability 提升到 runtime 或 live evidence 状态。

### 4. Capability verification record

本 FR 必须冻结 `provider_capability_verification_record` 的最小共享对象语义，至少包含：

- `provider_id`
- `contract_version`
- `capability_id`
- `requested_capability_ref`
- `required_actions`
- `required_execution_layers`
- `required_runtime_requirements`
- `declared_capability_ref`
- `verification_sources`
- `support_state`
- `decision`
- `blocking_reasons`
- `evidence_refs`
- `verified_at`

约束：

- `provider_id` 与 `contract_version` 必须与 `FR-0033` contract 中的 identity 精确匹配。
- `capability_id` 表示当前 consumer / command / admission 请求的目标 capability id；当 provider 未声明该 capability 时，record 仍必须保留请求值。
- `requested_capability_ref` 必须定位到 consumer / command / admission 的目标 capability 要求，供 unsupported / `capability_not_declared` 路径解释请求目标。
- `declared_capability_ref` 仅在存在 matching `FR-0033 capabilities[*].capability_id` 时为必填非空 string；没有 matching declaration 时必须为 `null` 或等价 absent/null 表达，不得伪造相邻 capability locator。
- `required_actions` 与 `required_execution_layers` 是本次判定的目标要求，不得被误写成 provider 全量能力。
- `required_runtime_requirements` 必须来自目标 capability / command / admission 需求，且与 `FR-0033` 的 runtime requirements 交叉判定。
- `verification_sources` 必须是结构化数组，记录 source type、status、scope、timestamp 与 evidence ref。
- `support_state` 必须由 verification sources 和 fail-closed 规则推导，不能由 provider 自报。
- `decision` 至少支持 `allow`, `deny`, `defer`。
- `allow` 只表示满足当前目标 capability 的最低验证要求，不表示全局 provider 可用。
- `deny` 表示存在明确阻断或 unsupported。
- `defer` 表示当前 record 尚未进入目标 admission，或 consumer 明确允许继续补证；业务执行不得把 `defer` 当作 `allow`。
- `blocking_reasons` 必须可机器读取；不得只写自由文本；一旦非空，最终 `support_state` 必须为 `blocked` 且 `decision` 必须为 `deny`。
- `evidence_refs` 只能引用证据载体，不内联敏感日志、完整页面内容、Cookie、Token 或 provider 私有 patch 细节。
- `verified_at` 如存在，必须是该 verification decision 所消费证据的判定时间，不是 spec 文件写入时间。
- 同类 required ref 规则：source 或 evidence 不存在时不得为了满足 schema 伪造 locator；`CapabilityVerificationSource.evidence_ref` 只在存在可追溯 source evidence 时填写，`evidence_refs[*].ref` 只在该 evidence ref 对象存在时必填。

### 5. Source aggregation 与状态提升

support state 必须按以下最低规则提升：

| 最低已满足 source | 可提升到的最高 support state |
|---|---|
| 无 matching declaration | `unsupported` |
| `provider_declaration` | `declared` |
| `static_contract_check` 或 `build_time_check` | `statically_verified` |
| `provider_health_check` | `health_checked` |
| `runtime_attestation` | `runtime_attested` |
| `runtime_observation` | `runtime_observed` |
| `live_evidence_gate` | `live_evidence_attested` |

约束：

- 任一 blocking reason 命中时，最终 `support_state` 必须为 `blocked` 且 `decision` 必须为 `deny`，即使存在更高等级 source。
- `manual_review_attestation` 不得单独提升 support state；它只能确认已有 source 与 decision 的一致性。
- 同一 record 中若不同 source 对同一 capability 结论冲突，必须取更保守结论；若已经进入目标 admission，必须写入 `blocking_reasons` 并输出 `blocked/deny`，否则可以用 `defer` 等待补证。
- capability-level evidence 可以高于 provider-level evidence，但必须有 capability-specific evidence ref；否则不得超过 provider-level 可证明等级。
- 历史 evidence 可以作为背景引用，但不能替代当前 latest-head gate 或 current runtime attestation。

### 6. 最低验证要求

本 FR 只冻结最低要求表达方式，不实现 selection policy。后续 consumer 必须能为目标 capability 声明：

- `minimum_support_state`
- `required_sources`
- `required_runtime_requirements`
- `required_evidence_freshness`
- `allowed_degraded_states`

约束：

- 默认业务 `read/write/download` 不得接受 `declared` 作为 `allow`。
- 需要 extension / native messaging / profile / target tab / real browser 的 capability，最低不得低于 `runtime_attested`。
- 需要证明当前页面行为或 artifact 产出的 capability，最低不得低于 `runtime_observed`。
- 需要真实 live closeout、真实页面交互或 latest-head evidence 的 capability，最低必须为 `live_evidence_attested`，且继续服从 `FR-0016` 或对应 gate。
- `diagnose` 可由后续 doctor policy 接受 `health_checked`，但不得因此允许业务 `read/write/download`。
- `allowed_degraded_states` 必须显式声明并可审查；没有声明时不得自动从高等级降级到低等级。

### 7. Blocking reason 与 fail-closed

`provider_capability_verification_model.blocking_reason` 必须至少支持：

- `capability_not_declared`
- `unsupported_action`
- `unsupported_execution_layer`
- `runtime_requirement_missing`
- `provider_limitation_conflict`
- `capability_limitation_conflict`
- `unknown_limitation`
- `diagnostic_only`
- `transport_not_attachable`
- `headless_policy_conflict`
- `no_extension_binding`
- `no_profile_binding`
- `no_native_messaging`
- `no_real_browser_attestation`
- `verification_source_missing`
- `verification_source_stale`
- `evidence_ref_invalid`
- `live_evidence_required`
- `manual_review_required`
- `source_conflict`

fail-closed 规则：

- `FR-0033` top-level limitations 与 capability-level limitations 都必须参与判定。
- `unknown` limitation 影响目标 capability 时必须阻断。
- `diagnostic_only` provider 或 capability 不得被业务 `read/write/download` 选择。
- `transport_kind=none`、`attach_model=not_attachable` 或等价不可连接事实命中业务 capability 时必须阻断。
- 目标 capability 要求 extension / profile / native messaging 时，对应 support 为 `none|unknown` 必须阻断。
- 目标 capability 要求 real browser / latest-head live evidence 时，不得用 `provider_health_check`、`runtime.ping`、stub/fake host 或 provider 自报替代。
- evidence ref 缺失、不可追溯、过期或与当前 provider/capability/head 不匹配时，若命中当前最低要求必须 `blocked/deny`；若尚未进入目标 admission，可以 `defer`，但不得 `allow`。

### 8. Decision policy

`provider_capability_verification_model.decision_policy` 必须冻结最小机器契约：

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

- business `read/write/download` 的默认最低状态不得为 `declared`。
- runtime requirements 命中时最低必须为 `runtime_attested`。
- runtime observation 命中时最低必须为 `runtime_observed`。
- live evidence gate 命中时最低必须为 `live_evidence_attested`。
- `allow_declared_only_for_business=false` 与 `allow_defer_for_business=false` 是当前固定值。
- `fail_closed_on_blocking_reasons=true`、`fail_closed_on_unknown_limitation=true`、`fail_closed_on_invalid_or_stale_evidence_ref=true` 是当前固定值。
- `degraded_state_policy=explicit_only`；没有显式 `allowed_degraded_states` 时不得自动降级。
- `manual_review_policy=confirm_existing_evidence_only`；manual review 不得单独提升 support state。
- provider 私有 policy 不得放宽本 FR 的默认 decision policy。

### 9. Freshness 与 provenance

verification record 必须表达证据来源与新鲜度：

- `evidence_refs[*].kind`
- `evidence_refs[*].ref`
- `evidence_refs[*].source`
- `evidence_refs[*].collected_at`
- `evidence_refs[*].head_sha`
- `evidence_refs[*].run_id`
- `evidence_refs[*].scope`

约束：

- `head_sha` 只在证据受 PR/latest-head gate 约束时必填；不适用时必须允许 `N/A` 或省略。
- `runtime_attestation` 与 `runtime_observation` 必须能追溯到 run/session 或等价 runtime evidence。
- `build_time_check` 必须能追溯到本地构建、manifest、fixture 或 schema 版本。
- `live_evidence_gate` 必须能追溯到当前 latest head 的 fresh rerun；历史 artifact 不得直接作为当前放行证据。
- provenance 缺失时，consumer 必须降低 support state 或阻断，而不是猜测通过。

### 10. 与 FR-0033 的关系

本 FR 必须明确：

- `FR-0033` 冻结 provider contract shape、capability declarations、verification level 与 limitations 的字段边界。
- 本 FR 冻结如何消费这些字段并结合外部 source 生成 support decision。
- 本 FR 不修改 `FR-0033` 的枚举；如后续发现 `FR-0033` 字段不足，必须另开修订 PR。
- `FR-0033 verification_level` 可作为本 FR source aggregation 的输入，但不能替代本 FR 的 evidence provenance、minimum requirement 和 support decision。

### 11. 与其他边界的关系

本 FR 必须明确：

- 与 WebEnvoy core：这是 provider/runtime capability verification 的 core formal model，不替代 CLI-first command contract、runtime bootstrap、execution strategy 或 provider selection policy。
- 与 Syvert：本模型不包含 Syvert normalized result、业务 schema、project state 或 product workflow；integration gate 只锚定 WebEnvoy provider-runtime foundation，不引入 Syvert external dependency。
- 与 provider registry：registry 可持有或索引 verification records，但 registry schema、lifecycle 和 persistence 不由本 FR 实现。
- 与 provider doctor：doctor 可产出 `provider_health_check` source，但 doctor command/report schema 不由本 FR 实现。
- 与 evidence kernel：evidence kernel 可产出、校验或索引 evidence refs，但 evidence storage、redaction 和 kernel implementation 不由本 FR 实现。
- 与 `FR-0015`：runtime readiness、persistent extension binding 和 official Chrome runtime migration 仍由 `FR-0015` 持有。
- 与 `FR-0016`：PR 级 live evidence gate 仍由 `FR-0016` 持有；本 FR 只能引用其 verdict / evidence ref。
- 与 `FR-0020`：anti-detection validation baseline 仍由 `FR-0020` 持有。

## GWT 验收场景

### 场景 1：只声明 capability 时不得默认执行业务命令

Given `FR-0033` provider contract 声明 capability 支持 `read` 和 `L3`
And verification source 只有 `provider_declaration`
When consumer 要求业务 `read` capability 的最低状态为 `runtime_attested`
Then verification decision 必须为 `deny` 或 `defer`
And support state 不得高于 `declared`
And 不得把 provider 自报当作 runtime ready

### 场景 2：静态和 build-time 通过不等于 runtime 可用

Given capability 的 contract shape、枚举和 build artifact 均检查通过
And 没有 runtime attestation evidence
When consumer 要求 profile、extension binding 与 native messaging 已满足
Then 已证明 source 层级最高只能到 `statically_verified`
And 若该 record 已进入目标 admission，最终 `support_state` 必须为 `blocked`
And decision 不得为 `allow`
And blocking reason 必须包含 `verification_source_missing` 或对应 runtime requirement 缺失

### 场景 3：doctor checked 不等于 live evidence

Given provider health check 通过
And capability 声明可产出 `live_evidence_ref`
When consumer 要求 latest-head live evidence
Then 若该 record 已进入目标 admission，最终 support state 必须为 `blocked`
And decision 必须为 `deny`
And blocking reason 必须包含 `live_evidence_required`

### 场景 4：runtime observation 可以证明当前执行面行为但不能替代 live gate

Given runtime observation 记录了当前执行面产出 artifact
And evidence ref 可追溯到当前 run
When consumer 只要求 runtime-observed artifact capability
Then support state 可以为 `runtime_observed`
And decision 可以为 `allow`
When consumer 进一步要求真实 live closeout
Then 必须继续要求 `live_evidence_gate`
And 不得把 `runtime_observed` 当作 `live_evidence_attested`

### 场景 5：unknown limitation 必须阻断受影响 capability

Given provider top-level limitation 包含 `unknown`
And 该 limitation 影响目标 `write` capability
When verification model 聚合 source
Then final support state 必须为 `blocked`
And decision 必须为 `deny`
And blocking reason 必须包含 `unknown_limitation`

### 场景 6：diagnostic-only capability 不得变成业务能力

Given `provider_mode=diagnostic_only`
And capability action 包含 `diagnose`
When 业务命令请求 `read` 或 `download`
Then verification decision 必须为 `deny`
And blocking reason 必须包含 `diagnostic_only`
And provider 只能被后续 doctor / health / evidence inspection 消费

### 场景 7：Syvert normalized mapping 不进入 verification model

Given Syvert 未来可能消费 WebEnvoy provider capability verdict
When reviewer 检查本 FR 的对象与字段
Then 不应出现 Syvert normalized result、业务 schema 或 product workflow 字段
And 不因“未来 Syvert 可能消费”引入 Syvert external dependency
And PR metadata 仍必须按 provider/shared-contract gate 标记 `contract_surface=execution_provider`

### 场景 8：未声明 capability 的 record 不得伪造 declaration ref

Given consumer 请求 capability `download-current-page`
And `FR-0033` provider contract 没有 matching `capabilities[*].capability_id`
When verification model 生成 record
Then `capability_id` 必须保留请求值 `download-current-page`
And `requested_capability_ref` 必须定位到 consumer / command / admission 请求目标
And `declared_capability_ref` 必须为 `null` 或等价 absent/null 表达
And 若该 record 已进入目标 admission，最终 `support_state` 必须为 `blocked`
And `decision` 必须为 `deny`
And `blocking_reasons` 必须包含 `capability_not_declared`

## 异常与边界场景

- capability 未声明但 consumer 要求该 capability：必须保留 `requested_capability_ref` 并把 `declared_capability_ref` 置为 `null`；若已进入目标 admission，必须 `blocked/deny` 且记录 `capability_not_declared`，未进入目标 admission 时可以 `unsupported/deny` 但不得伪造 declaration ref 或进入业务执行。
- capability 声明了 action 但 execution layer 不匹配：若已进入目标 admission，必须 `blocked/deny`；若尚未进入目标 admission，可以 `defer`，但不得静默降级到其他 layer。
- provider-level evidence 与 capability-level evidence 冲突：取保守结论，并记录 `source_conflict`。
- capability-level evidence 缺少 evidence ref：不得把 state 提升到超过可追溯 source。
- evidence ref 指向旧 head、旧 run 或不同 provider/capability：不得作为当前 latest-head gate 证据。
- manual review 只确认已有 evidence 的一致性，不得单独提升到 `runtime_attested`、`runtime_observed` 或 `live_evidence_attested`。
- `defer` 不得携带 `blocking_reasons`，也不得被 provider selection 当作 `allow`；业务执行路径必须 fail-closed。
- verification model 出现 provider registry lifecycle、doctor command schema、runtime implementation、Syvert normalized 字段或 provider 私有 patch 参数：视为范围漂移。

## 验收标准

1. support state、verification source、verification record、decision policy、decision 与 blocking reason 已冻结。
2. source aggregation、minimum requirement、freshness / provenance 与 fail-closed 规则已明确。
3. 套件已明确它锚定 `FR-0033`，但不修改 `FR-0033` contract shape，也不实现 registry、doctor、selection、evidence kernel 或 runtime 行为。
4. 套件已明确与 `FR-0015`、`FR-0016`、`FR-0020` 和 M1 boundary document 的 ownership 关系。
5. 当前 PR 只承载 formal spec review，不混入 runtime/provider registry、doctor、evidence kernel、adapter implementation、external runtime behavior 或治理五文件修改。
6. PR metadata 使用 `Fixes #1124`，且仅关闭 `#1124` 的 Provider Capability Verification Model contract-freeze FR；不关闭 `#1125/#1126/#1127/#1128/#1130` 等 downstream implementation / consumer。
7. PR metadata 声明 provider/shared-contract integration gate：
  - `integration_applicable=yes`
  - `integration_ref=#1111`
  - `shared_contract_changed=yes`
  - `external_dependency=none`
  - `merge_gate=integration_check_required`
  - `contract_surface=execution_provider`
  - `joint_acceptance_needed=no`

## 依赖与前置条件

- GitHub 事项：
  - `#1124` Provider Capability Verification Model
  - `#1111` Provider Runtime Foundation
- 上游基线：
  - `vision.md`
  - `docs/dev/roadmap.md`
  - `docs/dev/architecture/system-design.md`
  - `docs/dev/architecture/system-design/boundary.md`
  - `FR-0033-browser-provider-contract`
  - `FR-0015-official-chrome-runtime-migration`
  - `FR-0016-live-evidence-governance-gate`
  - `FR-0020-anti-detection-validation-baseline`
- 后续但不由本 FR 承接：
  - `#1125`
  - `#1126`
  - `#1127`
  - `#1128`
  - `#1130`
