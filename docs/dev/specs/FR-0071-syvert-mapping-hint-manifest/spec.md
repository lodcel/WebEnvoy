# FR-0071 Syvert Mapping Hint Manifest

Canonical Issue: #1199

## 背景

`#1199 Syvert Mapping Hint Manifest` 属于 `#1120 Optional Syvert Integration`。上游 `docs/dev/architecture/system-design/boundary.md` 已冻结 WebEnvoy / Syvert / Provider 依赖方向：

- WebEnvoy core 提供 CLI-first 的网页执行、结构化输出、错误、诊断与证据索引。
- Syvert 是可选上层消费者，在 Syvert 自身边界内完成 normalized result mapping、产品语义聚合和 workflow。
- Provider 是执行能力或浏览器适配承载边界，不等于 WebEnvoy core，也不等于 Syvert mapping layer。

当前缺口是：后续 Syvert 或其他上层消费者需要一个 WebEnvoy-owned 的 mapping hint manifest，帮助它们识别 WebEnvoy 输出中的 route、raw payload、operational context、evidence refs 与 non-proof signals。这个 manifest 只能提供 hint 和 handoff，不得把 Syvert normalized result、Syvert resource taxonomy、Syvert error taxonomy 或跨仓 shared output contract 写进 WebEnvoy core。

本 FR 只冻结 `syvert_mapping_hint_manifest` formal suite。它不实现 CLI / JSON-RPC wrapper，不修改 runtime output，不执行 browser/profile/account/live 操作，不定义 Syvert normalized result，不创建 provider adapter，也不要求 integration project joint acceptance。

本 suite 是 #1199 的 formal spec review carrier。当前 PR 必须使用 `Refs #1199`，等待 scheduler-owned spec review / gate；不得执行 guardian、formal review、controlled merge 或 issue closeout。

## 目标

1. 冻结 `syvert_mapping_hint_manifest` 的 owner、版本、适用范围与 local-only integration 判断。
2. 定义 WebEnvoy-owned mapping hint classes，用于下游消费者识别 WebEnvoy output/evidence 中可参考的定位、来源、质量、风险和后续 gate 输入。
3. 明确 hint manifest 是 downstream handoff metadata，不是 Syvert normalized result、resource taxonomy、error taxonomy 或 product workflow。
4. 明确 manifest 只引用 WebEnvoy-owned contract refs、opaque refs、redacted locators 和 synthetic examples，不内联敏感 payload。
5. 为 #1200/#1201/#1203/#1204 等后续事项提供可消费输入，但不实现这些事项。

## 非目标

- 不实现 Syvert CLI wrapper、JSON-RPC method、provider adapter、runtime output writer、parser、tests、fixtures、scripts、workflows、guardian、formal review、controlled merge 或 issue closeout。
- 不定义 Syvert normalized result、Syvert resource taxonomy、Syvert error taxonomy、Syvert business schema、Syvert workflow 或 Syvert project state。
- 不改变 WebEnvoy CLI stdout、JSON-RPC envelope、error code、`raw` / `normalized` / `diagnostics` / `observability` 共享语义、`task_id` / `request_id` / `run_id` 生成或消费规则。
- 不修改 provider contract、provider runtime、browser patch、CloakBrowser-as-core、default `live_write_commit`、evidence passthrough implementation 或 live evidence closeout。
- 不执行 real browser、profile、extension、Native Messaging、account、network、page interaction、live read/write 或 external-visible actions。
- 不把未来 Syvert 可能消费这个 manifest 申报为 active integration gate。

## 功能需求

### 1. Manifest ownership

系统必须冻结一个稳定的 `syvert_mapping_hint_manifest`。

约束：

- ownership 属于 #1199 / FR-0071。
- 该 manifest 只表达 WebEnvoy-owned hints and handoff metadata。
- 该 manifest 不得被解释为：
  - Syvert normalized result
  - Syvert resource taxonomy
  - Syvert error taxonomy
  - Syvert workflow
  - provider adapter contract
  - WebEnvoy CLI / JSON-RPC output implementation
  - live evidence record
  - read/write gate decision
- Consumer 遇到未知 manifest version、未知 hint class、缺失 required ref、scope drift 或 forbidden field 时必须 fail closed 或进入 explicit downstream-owned mapping path。

### 2. Manifest identity

`syvert_mapping_hint_manifest.identity` 必须至少冻结：

- `manifest_id`
- `manifest_version`
- `owner_ref`
- `canonical_issue_ref`
- `integration_mode`
- `producer_boundary`
- `consumer_boundary`
- `manifest_ref`

约束：

- `manifest_version` 当前固定为 `v1`。
- `owner_ref` 固定为 `FR-0071.syvert_mapping_hint_manifest.v1`。
- `canonical_issue_ref` 固定为 `#1199`。
- `integration_mode` 固定为 `local_only`。
- `producer_boundary` 固定表达 `webenvoy_core_hint_manifest`。
- `consumer_boundary` 可声明 `syvert_optional_consumer` 或 `generic_downstream_consumer`，但不得声明 Syvert-owned schema 已被冻结。

### 3. Hint classes

Manifest 至少支持以下 hint classes：

| hint class | 语义 | 是否可直接作为 Syvert normalized result |
|---|---|---|
| `ability_hint` | WebEnvoy ability / command / driver scope locator。 | 否 |
| `route_hint` | WebEnvoy route bucket 或 target page class locator。 | 否 |
| `raw_payload_hint` | raw payload ref、kind、capture source 与 redaction state。 | 否 |
| `operational_hint` | run / operation / status / error boundary / downstream slice refs。 | 否 |
| `evidence_hint` | evidence refs、freshness、artifact identity 与 non-proof signals。 | 否 |
| `risk_hint` | WebEnvoy-owned risk evidence refs 或 blockers 的 locator。 | 否 |
| `provider_hint` | provider capability / limitation / evidence boundary refs。 | 否 |
| `mapping_gap_hint` | 下游 normalization 所需但 WebEnvoy 不拥有的字段缺口。 | 否 |
| `consumer_action_hint` | 下游应执行的 normalization、taxonomy mapping 或 manual review action。 | 否 |

约束：

- Hint class presence 只表示 WebEnvoy 提供了下游映射参考，不表示 downstream mapping 成功。
- Hint 值必须是 string enum、opaque ref、redacted locator、checksum、contract ref 或 synthetic sample；不得内联 secret、Cookie、token、account identifier、browser profile path、private path、credential-bearing header、full page content 或 raw private URL。
- `mapping_gap_hint` 必须表达 WebEnvoy 不拥有的 downstream mapping responsibility，不能用 WebEnvoy defaults 自动补齐 Syvert result。
- `consumer_action_hint` 只能声明 downstream owner action，例如 `syvert_normalization_required`、`resource_taxonomy_required`、`error_taxonomy_required`、`manual_mapping_review_required`；不得声明这些 action 已完成。

### 4. Hint source binding

每个 hint item 必须绑定来源：

- `source_contract_ref`
- `source_section`
- `source_ref`
- `source_owner`
- `scope`
- `freshness`
- `redaction_state`

约束：

- `source_contract_ref` 可以引用 WebEnvoy formal contracts，例如 `FR-0061.xhs_driver_contract.v1`、`FR-0063.target_binding_state_machine.v1`、`FR-0070.webenvoy_owned_risk_evidence_boundary.v1` 或 later compatible refs。
- Consumable hint 必须设置 `source_binding_state=bound`，并提供非空 `source_ref`、可机器核查的 `source_contract_ref`、明确的 WebEnvoy-owned `source_section` 与 `source_owner`。
- `source_section` 只能指向 WebEnvoy-owned section，例如 `raw`、`operational`、`evidence`、`runtime_binding`、`risk_evidence`、`provider_boundary`；consumable hint 不得使用 `unknown` 或 `null`。
- `source_owner` 必须是 WebEnvoy-owned owner 或 provider-owned boundary ref；consumable hint 不得写成 Syvert-owned normalized schema owner、`unknown` 或 `downstream_owner_required`。
- `source_ref` 缺失、未知或不可追踪时，hint 必须设置 `source_binding_state=untraceable`，`allowed_effect=blocker_explanation`，并提供 fail-closed blocker；这类 hint 不得作为 `downstream_mapping_input`。
- `freshness=historical_background` 或 `unknown` 只能用于 context，不得驱动 current downstream accepted mapping。
- `redaction_state=redaction_required|policy_missing|invalid` 命中 required hint 时必须 block downstream consumption。

### 5. Mapping intent and gap semantics

Manifest 必须区分 `mapping_intent` 与 `mapping_gap`。

约束：

- `mapping_intent` 只表达 WebEnvoy 认为某个 output section 可能帮助下游 mapping。
- `mapping_gap` 表达 WebEnvoy 不拥有且需要 downstream consumer 解决的 normalized field、resource taxonomy、error taxonomy 或 product workflow 缺口。
- WebEnvoy 不得在 gap 中提供 synthetic default normalized value。
- Consumer 不得把 `mapping_intent.status=available` 解释为 Syvert mapping complete。

### 6. Non-proof signals

Manifest 必须显式列出 non-proof signals：

- `not_syvert_normalized_result`
- `not_syvert_resource_taxonomy`
- `not_syvert_error_taxonomy`
- `not_provider_adapter`
- `not_cli_jsonrpc_wrapper`
- `not_live_evidence`
- `not_read_write_gate_allow`
- `not_integration_gate`

约束：

- v1 manifest 的 `non_proofs` 必须包含以上全部值。
- 任一 consumer 需要跳过这些 non-proof 约束时，必须进入新的 formal spec 或 Syvert-owned contract，不得在 #1199 scope 内放宽。

### 7. Forbidden fields

Manifest v1 不得包含以下字段：

- `normalized`
- `syvert_normalized_result`
- `syvert_resource_type`
- `syvert_error_code`
- `syvert_workflow_state`
- `syvert_project_state`
- `jsonrpc_method`
- `provider_adapter`
- `live_write_commit`
- raw Cookie、token、account identifier、private absolute path、credential-bearing header、full page content、browser profile path 或 provider private patch payload

命中 forbidden field 必须视为 contract violation，并阻断当前 manifest 被作为 downstream input 消费。

### 8. Integration classification

本 FR 的默认 integration classification 必须保持：

```yaml
integration_applicable: no
integration_touchpoint: none
integration_ref: none
shared_contract_changed: no
external_dependency: none
merge_gate: local_only
contract_surface: none
joint_acceptance_needed: no
```

约束：

- 仅因 Syvert 未来可能消费该 manifest，不得升级为 integration-gated。
- 若后续 PR 开始冻结 Syvert-owned normalized result、跨仓 shared input/output、provider adapter、JSON-RPC wrapper、joint acceptance 或 active integration metadata，必须停止使用本 FR 的 local-only 判断，并另行请求 scheduler / integration decision。

## 异常与边界场景

- 未知 `manifest_version`、未知 `hint_class` 或缺失 required `source_ref`：必须 fail closed，并记录 `unknown_manifest_version`、`unknown_hint_class` 或 `missing_source_ref`。
- `source_section=unknown`、`source_owner=unknown|downstream_owner_required` 或 `source_ref=null`：只能出现在 `source_binding_state=untraceable` 的 blocker-only hint 中；若同时出现 `allowed_effect=downstream_mapping_input`，必须视为 contract violation。
- `freshness=historical_background|unknown` 被用于 current downstream accepted mapping：必须 fail closed，并记录 `historical_or_stale_source`。
- `redaction_state=redaction_required|policy_missing|invalid` 命中 required hint：必须 fail closed，并记录 `redaction_invalid`。
- Manifest、example、PR metadata 或 future artifact 出现 forbidden fields：必须 fail closed，并记录 `forbidden_field_present` 或 `syvert_boundary_violation`。
- Consumer 试图把 hint、mapping intent 或 route bucket 直接提升为 Syvert normalized result、resource taxonomy 或 error taxonomy：必须阻断，并交给 downstream-owned mapping contract。
- 当前 PR 或后续同 scope PR 开始实现 CLI / JSON-RPC wrapper、provider adapter、runtime output、shared I/O、joint acceptance 或 integration metadata：必须停止按 FR-0071 local-only carrier 推进，并请求 scheduler decision。

## GWT 验收场景

### 场景 1：manifest 提供 hint 而不是 normalized result

Given WebEnvoy 输出包含 `raw_payload_hint` 与 `route_hint`
When downstream consumer 读取 `syvert_mapping_hint_manifest`
Then consumer 只能获得 source refs 与 mapping intent
And 不得获得 `normalized` 顶层 section
And 不得把 manifest 视为 Syvert normalized result

### 场景 2：mapping gap 必须交给 downstream owner

Given manifest 声明 `mapping_gap_hint=resource_taxonomy_required`
When Syvert consumer 需要产品资源类型
Then Syvert 必须在 Syvert-owned contract 中完成 resource taxonomy mapping
And WebEnvoy 不得提供默认 Syvert resource type

### 场景 3：forbidden field 阻断消费

Given manifest item 包含 `syvert_error_code`
When contract parser 或 reviewer 检查 manifest
Then 必须判定为 contract violation
And 下游消费必须 fail closed

### 场景 4：历史或 redaction invalid hint 不可作为当前映射通过证据

Given hint item 的 `freshness=historical_background`
And `redaction_state=invalid`
When downstream consumer 要求 current accepted mapping input
Then 该 hint 必须被拒绝
And blocker 必须记录 stale 或 redaction invalid

### 场景 4a：未知来源 hint 只能作为 blocker

Given manifest item 的 `source_binding_state=untraceable`
And `source_ref=null`
When downstream consumer 要求 `allowed_effect=downstream_mapping_input`
Then 必须判定为 contract violation
And 该 hint 只能以 `allowed_effect=blocker_explanation` 暴露
And blocker 必须包含 `missing_source_ref` 或等价 fail-closed 原因

### 场景 5：local-only integration 元数据

Given #1199 只冻结 WebEnvoy-owned mapping hint manifest
When PR 描述填写 `integration_check`
Then `integration_applicable` 必须为 `no`
And `merge_gate` 必须为 `local_only`
And 不得声明 Syvert external dependency、joint acceptance 或 active integration_ref

### 场景 6：scope drift 到 wrapper 或 provider adapter

Given 当前 PR 新增 JSON-RPC method、Syvert CLI wrapper 或 provider adapter field
When reviewer 对照 #1199 scope
Then 必须判定为超出 #1199
And 当前 PR 不得继续按 FR-0071 formal carrier 推进

## 验收标准

1. `FR-0071` suite 明确 #1199 的 WebEnvoy-owned mapping hint manifest owner、schema、hint classes、gap semantics、non-proof signals 与 forbidden fields。
2. Suite 明确 Syvert normalized result、resource taxonomy、error taxonomy、provider adapter、CLI/JSON-RPC wrapper、live evidence 和 integration gate 均不属于本 FR。
3. `.github/spec-issue-sync-map.yml` 新增 `FR-0071 -> #1199` 映射。
4. PR metadata 使用 `Refs #1199`，不得使用 auto-closing keyword。
5. Docs/spec validation、sync-map validation、PR purity、diff check、closing scan 与 scope audit 通过。
6. Worker 停在 `waiting-scheduler-gate`，由 scheduler 执行 guardian / formal review / merge gate / issue closeout。
