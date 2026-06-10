# FR-0061 XHS Driver Contract

Canonical Issue: #1158

## 背景

`#1158` 属于 `#1115 XHS Driver Boundary` 的 contract lane。上游 WebEnvoy 已分别冻结 XHS request-shape、detail / user_home command surface、route evidence、browser provider contract、provider capability verification、provider evidence kernel 与 evidence redaction policy。当前缺口是：后续 XHS driver 的实现、adapter 化、证据收集和分片工作需要先共享同一份窄合同，明确 driver 输出到底是什么，以及它和 Syvert、provider runtime、live-write、JSON-RPC 扩展的边界。

本 FR 只冻结 WebEnvoy XHS Driver Contract 的 formal suite。它定义 XHS driver 输出分为 `raw`、`operational`、`evidence` 三类，冻结 runtime binding、provider requirement ownership、downstream slicing inputs 与 evidence/output 边界。它不实现 read path、不执行浏览器/profile/account/live 操作、不启用 live write、不扩展 JSON-RPC，也不定义 Syvert normalized result、Syvert resource taxonomy 或 Syvert error taxonomy。

`#1158` 的 issue scope 是 “Define WebEnvoy XHS driver outputs as raw, operational and evidence, explicitly excluding Syvert normalized result and Syvert resource/error taxonomy”。因此本 PR 是 formal spec review carrier，合入后只冻结 `FR-0061` suite 与 #1158 sync-map；PR metadata 必须使用 `Refs #1158`，不得自动关闭 #1158。

## 目标

1. 冻结 `xhs_driver_contract` 的 ownership、对象边界与版本。
2. 冻结 XHS driver 输出三分法：`raw`、`operational`、`evidence`。
3. 冻结 runtime binding 的输入定位语义，但不把它升级为 runtime readiness、target tab readiness 或 live evidence。
4. 冻结 provider requirement ownership：XHS driver 只能声明和消费 provider requirements，不能重写 provider capability、health、evidence 或 redaction 合同。
5. 冻结 downstream slicing inputs，供 #1159/#1160/#1161/#1163/#1164/#1165 后续实现分片消费。
6. 明确排除 Syvert normalized result、Syvert resource/error taxonomy、read-path implementation、live-write enablement、JSON-RPC 扩展和浏览器/account/live 操作。

## 非目标

- 不实现 `xhs.search`、`xhs.detail`、`xhs.user_home` 或任何 XHS read path。
- 不新增 CLI command、JSON-RPC method、Native Messaging message、browser extension behavior、Content Script behavior、provider adapter code、fixtures、tests 或 artifacts writer。
- 不定义 Syvert normalized result、Syvert resource taxonomy、Syvert error taxonomy、Syvert workflow、Syvert provider adapter 或 cross-repo joint acceptance。
- 不定义 default `live_write_commit`、creator write、upload、submit、publish、cleanup/rollback、live-write evidence 或 #1174+ live-write lane。
- 不执行 browser/profile/account/live/external-visible 动作，不声明 fresh live evidence。
- 不修改 `FR-0024`、`FR-0025`、`FR-0030`、`FR-0033`、`FR-0035`、`FR-0040`、`FR-0041` 的字段 shape 或 ownership。

## 功能需求

### 1. Contract 定位与 ownership

系统必须冻结一个稳定的 `xhs_driver_contract` 对象。

约束：

- ownership 属于 `#1158` / `FR-0061`，这是 WebEnvoy-local XHS driver contract surface。
- 该 contract 只表达 WebEnvoy XHS driver 对外可消费的输出边界、runtime binding refs、provider requirement refs 与 evidence refs。
- 该 contract 不得被解释为：
  - XHS read implementation
  - Syvert normalized result
  - Syvert resource taxonomy
  - Syvert error taxonomy
  - provider registry row
  - provider health result
  - runtime status
  - live evidence record
  - live-write admission 或 commit policy
  - JSON-RPC extension contract
- 后续 consumer 必须保持本 FR 的 raw / operational / evidence 分层与 non-proof 语义，不得通过私有字段把 driver contract 升级为 normalized product result、runtime/live proof 或 write enablement。

### 2. Driver identity

`xhs_driver_contract.identity` 必须至少冻结：

- `driver_contract_id`
- `driver_contract_version`
- `platform`
- `driver_namespace`
- `supported_abilities`
- `contract_ref`
- `canonical_issue_ref`

约束：

- `driver_contract_version` 当前冻结为 `v1`。
- `platform` 固定为 `xhs`。
- `driver_namespace` 固定使用 WebEnvoy-local namespace，例如 `webenvoy.xhs.driver`。
- `supported_abilities` 只允许声明当前合同覆盖的 XHS driver ability id，例如 `xhs.search`、`xhs.detail`、`xhs.user_home`；它不等于这些 ability 已实现。
- `contract_ref` 必须指向 `FR-0061.xhs_driver_contract.v1` 或等价 formal locator。
- `canonical_issue_ref` 必须指向 `#1158`。

### 3. Output envelope 三分法

XHS driver 的输出 envelope 必须分为：

- `raw`
- `operational`
- `evidence`

约束：

- 三个 section 都必须可独立判定存在、缺失或不适用。
- `raw` 只表达 XHS 页面/API/状态来源的原始或近原始 payload 边界。
- `operational` 只表达 WebEnvoy 执行、调度、runtime binding、request shape、route bucket、状态和错误的机器可读运行信息。
- `evidence` 只表达 provenance、artifact refs、redaction、freshness、provider/runtime evidence refs 与 non-proof conclusion。
- envelope 不得包含 `normalized` 顶层 section；如后续 Syvert 需要 normalized result，必须在 Syvert-owned contract 中消费本 envelope 后另行定义。
- envelope 不得把 `raw`、`operational` 或 `evidence` 任一 section 解释为 live evidence accepted、provider capability allowed、runtime ready 或 write allowed。

### 4. `raw` 输出边界

`xhs_driver_output.raw` 必须至少冻结：

- `raw_payload_ref`
- `raw_payload_kind`
- `source_route`
- `source_capture_kind`
- `source_freshness`
- `redaction_state`
- `raw_parse_status`

约束：

- `raw_payload_kind` 至少支持 `api_response`、`page_state`、`dom_state`、`request_template_observation`、`unknown`。
- `source_capture_kind` 至少支持 `browser_in_page_fetch`、`page_state_read`、`passive_observation`、`diagnostic_only`、`unknown`。
- `raw_payload_ref` 只能是 artifact ref、redacted locator、checksum 或 opaque handle；不得内联 Cookie、token、account identifier、private path、完整页面内容或 credential-bearing header。
- `raw_parse_status` 只表达 driver 是否能解析 raw payload；不得表达 Syvert normalization 是否成功。
- `raw` 可以保留平台字段、平台错误片段或 route-local payload shape，但不得把它们改写成 Syvert resource/error taxonomy。
- `raw` 缺失、partial、redaction invalid 或 source unknown 时，后续 consumer 必须 fail closed 或进入 explicit degraded path；不得静默生成 normalized result。

### 5. `operational` 输出边界

`xhs_driver_output.operational` 必须至少冻结：

- `ability_id`
- `operation_id`
- `run_id`
- `request_shape_ref`
- `route_bucket`
- `runtime_binding_ref`
- `provider_requirement_refs`
- `status`
- `error_boundary`
- `downstream_slice_ref`

约束：

- `ability_id` 必须指向 WebEnvoy XHS ability / command id，不得指向 Syvert product resource type。
- `request_shape_ref` 可以引用 `FR-0024`、`FR-0025` 或后续 XHS request-context owner；本 FR 不重写 request-shape identity。
- `route_bucket` 只表达 search/detail/user_home 等 WebEnvoy route grouping，不定义 Syvert resource taxonomy。
- `runtime_binding_ref` 只引用本 FR 冻结的 runtime binding object 或后续实现产物，不证明 target tab ready、content script ready、runtime bootstrap ready 或 browser live success。
- `provider_requirement_refs` 只引用 provider requirement declarations；是否满足由 `FR-0033`、`FR-0035`、`FR-0040`、`FR-0041` 及后续 provider owners 判定。
- `status` 至少支持 `success`、`partial`、`blocked`、`failed`、`not_implemented`、`unknown`。
- `error_boundary` 只能表达 WebEnvoy driver-local error class 或 upstream contract ref；不得定义 Syvert error taxonomy。

### 6. `evidence` 输出边界

`xhs_driver_output.evidence` 必须至少冻结：

- `evidence_refs`
- `provider_evidence_ref`
- `runtime_binding_evidence_ref`
- `raw_payload_evidence_ref`
- `redaction_summary`
- `freshness_scope`
- `non_proofs`
- `blocking_reasons`
- `next_required_gates`

约束：

- `evidence_refs` 只引用证据载体，不内联敏感原文。
- provider evidence 必须消费 `FR-0040.provider_evidence_record` 与 `FR-0041.evidence_redaction_policy`；本 FR 不新增 provider evidence kernel 字段。
- `freshness_scope` 至少支持 `current_run`、`current_pr_head`、`historical_background`、`not_applicable`、`unknown`。
- `current_pr_head` 只能表达 PR/head-bound evidence freshness requirement；本 FR 不采集或声明 latest-head live evidence。
- `non_proofs` 必须至少能表达：driver contract does not prove runtime ready、target tab ready、live evidence accepted、provider capability allowed、Syvert normalized result complete、write enabled。
- `next_required_gates` 可以列出后续 `provider_capability_verification`、`runtime_attestation`、`route_evidence_evaluator`、`live_evidence_gate`、`syvert_normalization` 等 gate，但不得把这些 gate 写成已通过。

### 7. Runtime binding boundary

`xhs_runtime_binding` 必须至少冻结：

- `target_domain`
- `target_page`
- `target_tab_ref`
- `execution_mode`
- `page_context_namespace_ref`
- `runtime_provider_ref`
- `binding_freshness`
- `binding_status`

约束：

- `target_domain` 当前只允许 WebEnvoy XHS read scope 所需域名，例如 `www.xiaohongshu.com`；creator / write 域不在本 FR 中启用。
- `target_page` 只表达 expected page class，例如 `search_tab`、`explore_detail_tab`、`profile_tab`；不证明页面当前满足该 class。
- `target_tab_ref` 只能是 redacted tab locator 或 run-scoped ref；不得内联浏览器 profile、account 或页面敏感内容。
- `execution_mode` 只声明 requested / expected mode，不允许定义新的 JSON-RPC method 或 live-write commit behavior。
- `page_context_namespace_ref` 可引用 `FR-0024` 的 page-local namespace 语义；不得跨页面复用 request template。
- `binding_status=ready` 若后续实现需要使用，必须由 runtime owner 证明；本 FR 只冻结字段边界，不给出 ready 事实。

### 8. Provider requirement ownership

XHS driver 可以声明的 provider requirements 必须通过 `xhs_driver_provider_requirements` 表达。

最小字段：

- `required_runtime_requirements`
- `required_actions`
- `required_execution_layers`
- `minimum_support_state`
- `provider_contract_refs`
- `capability_verification_ref`
- `evidence_policy_refs`

约束：

- `required_runtime_requirements` 必须复用 `FR-0033.BrowserProviderRuntimeRequirement` 或后续正式 owner 的枚举；本 FR 不新增 provider requirement enum。
- `required_actions` 当前只能声明 `read` 或 `diagnose`；不得声明 write enablement。
- `required_execution_layers` 可声明 `L3`、`L2`、`L1` 的目标需求，但本 FR 不实现任何 execution layer。
- `minimum_support_state` 必须消费 `FR-0035` 的 verification model；不得接受 declared-only 作为业务 read 默认放行。
- provider requirement missing、unknown、stale evidence 或 redaction invalid 时，后续 consumer 必须 fail closed。
- XHS driver 不拥有 provider registry、provider health、capability matrix、provider evidence kernel 或 redaction policy 的字段 shape。

### 9. Downstream slicing inputs

本 FR 必须为后续分片冻结最小输入：

- `driver_contract_ref`
- `ability_scope`
- `allowed_output_sections`
- `runtime_binding_ref`
- `provider_requirement_refs`
- `raw_payload_boundary_ref`
- `evidence_boundary_ref`
- `non_goal_refs`

约束：

- `allowed_output_sections` 只能从 `raw`、`operational`、`evidence` 中选择。
- 后续 #1159/#1160/#1161/#1163/#1164/#1165 可消费这些 slicing inputs 来分别实现 read path、adapter、evidence、provider readiness 或 review/gate 工作，但不得在本 FR PR 中落地。
- `non_goal_refs` 必须显式保留 Syvert normalized result、Syvert taxonomy、read implementation、live-write、JSON-RPC extension 与 browser/account/live 操作排除项。
- downstream slice 不得把本 FR 的 spec 合入解释为 implementation-ready；implementation 必须等待 spec review 与对应 issue scope。

### 10. Syvert boundary

本 FR 必须明确：

- WebEnvoy XHS driver 输出不是 Syvert normalized result。
- `raw` 不等于 Syvert raw/normalized shared product contract。
- `operational.error_boundary` 不等于 Syvert error taxonomy。
- `route_bucket` 不等于 Syvert resource taxonomy。
- Syvert 如需消费 WebEnvoy XHS driver output，必须在 Syvert-owned contract 中定义 normalization、resource mapping、error mapping 与 product workflow。
- 当前 PR 是 WebEnvoy-local formal spec PR；不引入 Syvert external dependency，不需要 joint acceptance。

### 11. Fail-closed rules

以下情况必须 fail closed 或保持 explicit blocked / not_implemented：

- driver output 缺少 `raw`、`operational` 或 `evidence` 的 required section 且 consumer 需要该 section。
- `raw_payload_ref` redaction invalid、source unknown 或 freshness 不满足 consumer 要求。
- `runtime_binding_ref` 缺失、stale、unknown 或被误写成 runtime ready proof。
- provider requirement 无法映射到 `FR-0033` / `FR-0035` / `FR-0040` / `FR-0041` 的正式 evidence。
- evidence refs partial / unavailable / stale / redaction invalid，且没有后续 formal exception。
- driver output 包含 `normalized` section、Syvert resource type、Syvert error taxonomy 或 live-write commit field。
- driver output 声称 browser/profile/account/live action 已执行，但没有适用 owner 的 latest-head fresh live evidence gate。

## GWT 验收场景

### 场景 1：输出必须保持 raw / operational / evidence 三分法

Given 后续 XHS driver implementation 生成 driver output
When consumer 读取 output envelope
Then output 必须能明确区分 `raw`、`operational`、`evidence`
And 不得新增 `normalized` 顶层 section

### 场景 2：raw payload 不等于 Syvert normalized result

Given `raw.raw_payload_kind=api_response`
When downstream 需要产品级 normalized result
Then downstream 必须进入 Syvert-owned normalization contract
And 不得把 `raw` 直接当作 Syvert normalized result

### 场景 3：operational error 不定义 Syvert error taxonomy

Given `operational.error_boundary` 包含 driver-local error class
When Syvert consumer 需要 resource/error taxonomy
Then 该 taxonomy 必须由 Syvert-owned contract 定义
And 本 FR 不得提供 Syvert taxonomy fallback

### 场景 4：runtime binding 不证明 runtime ready

Given `runtime_binding_ref` 指向 XHS target tab locator
When consumer 需要 target tab ready 或 runtime attestation
Then 必须继续消费 runtime owner 的 evidence
And 不得把 binding locator 当作 ready proof

### 场景 5：provider requirement 只声明需求

Given XHS driver 声明 `native_messaging`、`extension_binding` 或 `real_browser` requirement
When provider selection / capability gate 判定是否允许执行
Then 必须消费 `FR-0033` / `FR-0035` / `FR-0040` / `FR-0041`
And 不得由 XHS driver 自证 provider capability

### 场景 6：evidence refs 不替代 live evidence gate

Given `evidence.evidence_refs` 包含 runtime 或 raw payload artifact ref
When PR 或 closeout 需要 fresh live evidence
Then 必须由适用 live evidence gate 接受 latest-head rerun
And 不得把 driver evidence ref 直接写成 live evidence accepted

### 场景 7：downstream slice 只能消费声明的 output section

Given downstream slice 只声明 `allowed_output_sections=[raw,evidence]`
When slice implementation 读取 XHS driver output
Then 它不得依赖未声明的 `operational` 字段作为关闭条件
And 如需新增消费面，必须更新对应 slice 的 formal scope

### 场景 8：live-write 字段必须阻断

Given driver output 或 downstream slice 输入出现 `live_write_commit`、`publish_result` 或 write enablement field
When 本 FR 的 contract validator 或 reviewer 评估 scope
Then 必须判定为超出 #1158
And 不得在本 PR 或本 contract 中接受该字段

### 场景 9：JSON-RPC 扩展不属于本 FR

Given implementation 需要新增 JSON-RPC method 来暴露 XHS driver
When review 对照 `FR-0061`
Then 必须要求独立 issue / formal owner
And 不得把本 FR 解释为 JSON-RPC 扩展授权

### 场景 10：Syvert local-only 边界

Given 当前 PR 只冻结 WebEnvoy XHS driver contract
When 填写 PR metadata
Then `integration_applicable` 必须为 `no`
And `merge_gate` 必须为 `local_only`
And 不得声明 Syvert external dependency 或 joint acceptance

## 异常与边界场景

- `raw` 来源是 page state fallback 时，必须保留 `source_capture_kind=page_state_read`，不得伪装成 primary API success。
- `raw_parse_status=partial` 时，consumer 不得静默补齐 normalized result。
- `runtime_binding.binding_status=unknown` 命中 required binding 时必须阻断。
- `provider_requirement_refs` 指向 unknown provider contract 时必须阻断。
- `evidence.redaction_summary` 发现 account、Cookie、token、private path 或 page content 泄露时必须输出 redaction blocker。
- `current_pr_head` freshness requirement 不得由 historical artifact 满足。
- 本 PR 的 `live_evidence_record` 必须为 `N/A`；任何 browser/profile/account/live evidence claim 都是 scope violation。

## 验收标准

1. Formal suite 明确 XHS driver output 的 `raw` / `operational` / `evidence` 三分法。
2. Formal suite 明确 runtime binding、provider requirement ownership 与 downstream slicing inputs。
3. Formal suite 明确 Syvert normalized result、Syvert resource/error taxonomy、read-path implementation、live-write、JSON-RPC 和 browser/account/live 操作均不属于本 FR。
4. Formal suite 提供 machine-consumable contract、data model、research、risks 与 TODO。
5. `.github/spec-issue-sync-map.yml` 新增 `FR-0061 -> #1158` 映射。
6. PR closing semantics 使用 `Refs #1158`，且 GitHub `closingIssuesReferences` 读回为空。
