# FR-0063 Target Binding State Machine

Canonical Issue: #1161

## 背景

`#1161` 属于 `#1115 XHS Driver Boundary` 的 contract lane。`FR-0061 XHS Driver Contract` 已冻结 XHS driver output 的 `raw` / `operational` / `evidence` 三分法，并把 `xhs_runtime_binding` 明确为 locator / expected binding boundary，而不是 runtime ready、target tab ready、page interaction success 或 live evidence accepted。

当前缺口是：后续 XHS read-path、page ready/runtime ready、signed continuity 与 evidence gate 需要消费同一套 Target Binding State Machine，才能稳定判断一个候选 tab/page 是否已经完成 target binding，何时必须 fail closed，何时只能交给下游 owner 继续判定。

本 FR 只冻结 Target Binding State Machine formal suite。它定义 `unbound`、`candidate_found`、`url_matched`、`dom_ready`、`runtime_state_detected`、`extension_bridge_confirmed`、`bound`、`stale`、`lost` 状态、状态转移、fail-closed 语义、证据边界与下游 #1162/#1171 可消费输入。它不实现 read path、不执行 browser/profile/account/live 操作、不启用 live write、不定义 Syvert normalized result、不把 CloakBrowser 变成 core、不做 browser patching、不启用 default `live_write_commit`，也不进入 #835 recovery。

`#1161` 的 issue scope 是 “Define unbound, candidate_found, url_matched, dom_ready, runtime_state_detected, extension_bridge_confirmed, bound, stale and lost target binding states”。因此本 PR 是 formal spec review carrier，合入后只冻结 `FR-0063` suite 与 #1161 sync-map；PR metadata 必须使用 `Refs #1161`，不得自动关闭 #1161。

## 目标

1. 冻结 `target_binding_state_machine` 的 ownership、版本与消费边界。
2. 冻结九个状态的规范语义、进入条件、退出条件与 non-proof 语义。
3. 冻结允许的状态转移、刷新规则、stale/lost 处理与 reset 规则。
4. 冻结 transition evidence、binding snapshot、redaction 与 freshness 边界。
5. 冻结 fail-closed 规则，避免 stale / partial / mismatched binding 被静默提升为可读、可写或 live evidence。
6. 冻结 #1162 Page Ready / Runtime Ready Contract 与 #1171 Signed Continuity Binding 可消费输入。
7. 明确排除 read path implementation、live-write enablement、browser/account/live 操作、Syvert normalized result、CloakBrowser-as-core、browser patching、default `live_write_commit` 与 #835 recovery。

## 非目标

- 不实现 target resolver、tab discovery、content script probe、Native Messaging bridge、runtime attestation、read path、CLI command、JSON-RPC method、fixtures、tests 或 artifact writer。
- 不证明 page ready、runtime ready、content script ready、runtime bootstrap ready、signed continuity、provider capability allowed、route evidence accepted 或 live evidence accepted。
- 不执行 browser/profile/account/live/external-visible 动作，不声明 fresh live evidence。
- 不启用 write / publish / upload / submit / cleanup / rollback / default `live_write_commit`。
- 不定义 Syvert normalized result、Syvert resource taxonomy、Syvert error taxonomy、Syvert workflow 或 cross-repo joint acceptance。
- 不把 CloakBrowser provider、provider private patch schema、browser patching 或 provider-specific stealth details 提升为 WebEnvoy core contract。
- 不修改 `FR-0061`、`FR-0062`、provider/evidence/redaction contracts 或 live evidence governance 的字段 shape。
- 不关闭 #1162、#1171、#835 或 parent #1115。

## 功能需求

### 1. Contract 定位与 ownership

系统必须冻结一个稳定的 `target_binding_state_machine`。

约束：

- ownership 属于 `#1161` / `FR-0063`。
- 该 contract 只表达 target binding state、transition、snapshot、evidence boundary 与 downstream handoff。
- 该 contract 消费 `FR-0061.xhs_runtime_binding` 的 locator / expected binding 边界，并进一步细化 target binding 生命周期。
- 该 contract 不得被解释为：
  - XHS read implementation
  - page ready / runtime ready proof
  - signed continuity proof
  - provider capability allow
  - route evidence evaluator pass
  - live evidence accepted
  - live-write admission 或 commit policy
  - Syvert normalized result

### 2. State machine identity

`target_binding_state_machine.identity` 必须至少冻结：

- `state_machine_id`
- `state_machine_version`
- `platform`
- `owner_ref`
- `consumes_contract_ref`
- `canonical_issue_ref`

约束：

- `state_machine_version` 当前冻结为 `v1`。
- `platform` 固定为 `xhs`。
- `owner_ref` 固定为 `FR-0063.target_binding_state_machine.v1`。
- `consumes_contract_ref` 必须引用 `FR-0061.xhs_driver_contract.v1`。
- `canonical_issue_ref` 必须指向 `#1161`。

### 3. 状态定义

系统必须支持以下状态：

| state | 规范语义 | 允许作为 downstream pass |
|---|---|---|
| `unbound` | 没有当前可消费 target candidate；或状态机已 reset。 | 否 |
| `candidate_found` | 已发现一个 redacted target candidate，例如 tab/window/frame locator；尚未证明 URL 符合目标。 | 否 |
| `url_matched` | candidate 的 normalized URL / route class 与允许的 XHS target scope 匹配；尚未证明 DOM 可读。 | 否 |
| `dom_ready` | 当前 candidate 上已有同 run DOM readiness observation；不证明 page ready 或业务数据可读。 | 否 |
| `runtime_state_detected` | 当前 candidate 上检测到 page context namespace、runtime marker 或 FR-0061 runtime state ref；不证明 bridge 可达。 | 否 |
| `extension_bridge_confirmed` | WebEnvoy extension/content-script/native bridge 的 addressing evidence 与同一 target candidate 对齐；不证明 signed continuity 或 read success。 | 否，除非下游 owner 显式接受为非 pass handoff |
| `bound` | candidate、URL、DOM observation、runtime state 与 extension bridge evidence 在当前 freshness boundary 内一致；只表示 target binding 可交给下游 owner 消费。 | 仅可作为 target binding pass 输入，不等于 #1162/#1171 pass |
| `stale` | 曾经存在的 candidate/binding evidence 已过期、被导航、被新 run/head 取代或 freshness 不满足。 | 否 |
| `lost` | candidate 不可达、tab/frame 关闭、URL 离开目标范围、bridge/source owner mismatch 或 target identity 冲突。 | 否 |

约束：

- `bound` 是本 FR 的最高状态，但它仍是 non-proof boundary。
- `extension_bridge_confirmed` 不能替代 `bound`，除非后续 owner 明确接受它作为 blocked / diagnostic handoff。
- `dom_ready` 不能替代 #1162 Page Ready。
- `runtime_state_detected` 不能替代 #1162 Runtime Ready。
- `bound` 不能替代 #1171 Signed Continuity Binding。
- `stale` 和 `lost` 必须阻断 required target binding consumer。

### 4. State observation inputs

状态机输入必须至少能表达：

- `target_candidate_ref`
- `target_domain`
- `target_page_class`
- `normalized_url_ref`
- `route_bucket`
- `dom_observation_ref`
- `runtime_state_ref`
- `extension_bridge_ref`
- `provider_runtime_ref`
- `run_id`
- `operation_id`
- `freshness_scope`
- `redaction_state`

约束：

- 所有 refs 都必须是 redacted locator、artifact ref、checksum 或 opaque handle。
- 不得内联 Cookie、token、account identifier、browser profile path、private path、credential-bearing header、full page content 或 raw private URL。
- `target_page_class` 只能表达 expected page class，例如 `search_tab`、`explore_detail_tab`、`profile_tab`、`unknown`；不证明页面业务就绪。
- `route_bucket` 只能表达 WebEnvoy-local route grouping，不定义 Syvert resource taxonomy。
- `freshness_scope=current_run` 是进入 `bound` 的最低 freshness 要求；`historical_background` 只能作为背景证据。

### 5. 允许状态转移

系统必须冻结以下基本转移：

| from | to | 最小条件 |
|---|---|---|
| `unbound` | `candidate_found` | 当前 run 发现 redacted target candidate。 |
| `candidate_found` | `url_matched` | candidate normalized URL / target domain / page class 命中允许 scope。 |
| `url_matched` | `dom_ready` | 同一 candidate 上采集到 current-run DOM readiness observation。 |
| `dom_ready` | `runtime_state_detected` | 同一 candidate 上采集到 runtime state / page namespace marker ref。 |
| `runtime_state_detected` | `extension_bridge_confirmed` | bridge addressing evidence 与同一 candidate、run_id、provider/runtime ref 对齐。 |
| `extension_bridge_confirmed` | `bound` | candidate、URL、DOM、runtime state、bridge evidence 全部 current-run fresh，且 redaction pass。 |
| any non-terminal state | `stale` | 已采集 evidence 过期、run/head/freshness 不满足、candidate 导航后无法证明仍为同一 target。 |
| any non-terminal state | `lost` | candidate 关闭、不可达、URL 离开目标范围、source owner mismatch 或 target identity conflict。 |
| `bound` | `stale` | 已 bound evidence 过期、导航、bridge freshness 失效或 downstream 要求更高 freshness。 |
| `bound` | `lost` | bound candidate 不可达、tab/frame 关闭、identity conflict 或 bridge owner mismatch。 |
| `stale` | `candidate_found` | 新 current-run discovery 发现新的 candidate；旧 evidence 不可复用。 |
| `lost` | `unbound` | reset / abandon lost candidate；后续必须重新 discovery。 |

约束：

- 不允许跳过前置状态直接进入 `bound`。
- 不允许从 `stale` 或 `lost` 原地恢复为 `bound`；必须重新采集 current-run evidence。
- 不允许使用 same-head historical artifact、旧 run、旧 bridge ack 或旧 DOM observation 满足当前 `bound`。
- 不允许通过手工 override、PR metadata 或 issue label 把 non-pass state 提升为 pass。

### 6. Binding snapshot

状态机必须输出 `target_binding_snapshot` 作为下游可消费输入。

最小字段：

- `snapshot_version`
- `state`
- `state_entered_at`
- `target_candidate_ref`
- `target_scope`
- `route_bucket`
- `run_id`
- `operation_id`
- `evidence_refs`
- `freshness_scope`
- `blocking_reasons`
- `non_proofs`
- `downstream_handoff`

约束：

- `state=bound` 时必须包含 candidate、url、dom、runtime_state、extension_bridge 五类 evidence ref。
- `state!=bound` 时必须提供 `blocking_reasons`，不能用空 reason 表达 soft pass。
- `non_proofs` 必须至少包含：`page_ready`、`runtime_ready`、`signed_continuity`、`read_success`、`live_evidence_accepted`、`provider_capability_allowed`、`write_enabled`。
- `downstream_handoff` 只能列出 #1162/#1171 或其他正式 owner 需要继续判定的 gates；不得把它们写成已通过。

### 7. Transition evidence

每次状态转移必须能生成或引用 `target_binding_transition_evidence`。

最小字段：

- `transition_id`
- `from_state`
- `to_state`
- `transition_reason`
- `observed_at`
- `run_id`
- `target_candidate_ref`
- `evidence_refs`
- `freshness_scope`
- `redaction_state`
- `source_owner`

约束：

- `transition_reason` 必须来自冻结枚举或后续正式 owner 扩展；unknown reason 必须 fail closed。
- `source_owner` 必须能区分 `target_binding_state_machine`、runtime owner、provider owner、manual_review 或 downstream owner。
- redaction invalid、source owner mismatch、evidence partial/unavailable 或 freshness unknown 时，转移不得进入 `bound`。

### 8. Fail-closed blocking reasons

系统必须至少冻结以下 blocking reasons：

- `unknown_state`
- `invalid_transition`
- `missing_candidate`
- `url_scope_mismatch`
- `dom_observation_missing`
- `runtime_state_missing`
- `extension_bridge_missing`
- `candidate_identity_conflict`
- `source_owner_mismatch`
- `redaction_invalid`
- `freshness_unknown`
- `historical_or_stale_evidence`
- `bridge_owner_mismatch`
- `forbidden_write_scope`
- `syvert_boundary_violation`
- `live_evidence_required_downstream`
- `signed_continuity_required_downstream`
- `page_runtime_ready_required_downstream`

约束：

- 任一 blocking reason 命中 required target binding consumer 时，consumer 必须 `blocked` / `deny` / `defer`，不得 `allow`。
- Unknown state、unknown transition、unknown owner 或 unsupported enum 必须 fail closed。
- Forbidden write scope、Syvert boundary violation、redaction invalid 必须直接阻断，不进入 degraded pass。

### 9. Downstream #1162 输入

#1162 Page Ready / Runtime Ready Contract 可以消费：

- `target_binding_snapshot.state`
- `target_binding_snapshot.evidence_refs`
- `target_binding_snapshot.freshness_scope`
- `target_binding_snapshot.blocking_reasons`
- `target_binding_snapshot.non_proofs`
- `downstream_handoff.page_runtime_ready_required`

约束：

- #1162 可要求 `state=bound` 作为进入 page/runtime ready 判定的前置输入。
- 本 FR 不定义 #1162 的 page ready、runtime ready、ready timeout、recovery 或 retry 规则。
- `dom_ready`、`runtime_state_detected` 或 `extension_bridge_confirmed` 只能作为 #1162 diagnostic input，不能被本 FR 写成 #1162 pass。

### 10. Downstream #1171 输入

#1171 Signed Continuity Binding 可以消费：

- `target_binding_snapshot`
- `target_binding_transition_evidence[]`
- `transition_id`
- `state_entered_at`
- `run_id`
- `target_candidate_ref`
- evidence digest / redacted artifact refs

约束：

- 本 FR 不定义 signature algorithm、key ownership、continuity token、chain verification 或 signed artifact writer。
- `bound` 只能作为 signed continuity 的 unsigned input，不等于 signed continuity accepted。
- 任何缺少 transition chain、run identity、freshness 或 redaction 的 continuity consumer 必须 fail closed，除非 #1171 正式 contract 另行定义 degraded path。

### 11. Boundary with FR-0061 and FR-0062

本 FR 必须消费但不修改：

- `FR-0061.xhs_driver_contract.v1`
- `FR-0061.xhs_runtime_binding`
- `FR-0062.live_write_capability_taxonomy.v1`

约束：

- `FR-0061.runtime_binding.binding_status=ready` 仍必须由 runtime owner 证明；本 FR 只提供 target binding state。
- `FR-0062.live_write_commit` 保持默认 locked；`bound` 不得提高 requested/effective capability level。
- Target binding state 不得被写入 live-write admission、operator unlock、default commit lock release 或 #835 recovery evidence。

## 异常与边界场景

### 1. Candidate 缺失或 target identity 冲突

如果没有 `target_candidate_ref`，或同一 run 中出现多个无法区分的 candidate，状态必须保持 `unbound` 或进入 `lost`，并设置 `missing_candidate` 或 `candidate_identity_conflict`。

### 2. URL scope mismatch

如果 normalized URL、target domain 或 page class 离开 XHS read target scope，状态必须进入 `lost`，不得保留旧 `url_matched` 或 `bound`。

### 3. DOM / runtime / bridge evidence partial

如果 DOM observation、runtime state 或 extension bridge 任一 evidence partial、unavailable、unknown freshness 或 redaction invalid，状态不得进入 `bound`，并必须提供对应 blocking reason。

### 4. Navigation / refresh / same-head historical evidence

如果 candidate 导航、刷新、frame 重建、run/head freshness 不满足，或 consumer 只提供历史 artifact / 旧 run bridge ack / 旧 DOM observation，状态必须进入 `stale` 或保持 non-pass。

### 5. Downstream ready / continuity gate required

如果 consumer 需要 page ready、runtime ready 或 signed continuity，`target_binding_snapshot.state=bound` 只能作为输入，必须继续交给 #1162 或 #1171 判定。

### 6. Forbidden write / Syvert / live evidence claim

如果 payload 或 PR metadata 把 target binding 写成 Syvert normalized result、live evidence accepted、provider capability allowed、write enabled、default `live_write_commit` 或 #835 recovery evidence，必须视为 contract violation。

## GWT 验收场景

### 场景 1：状态必须按顺序进入 bound

Given 状态机处于 `unbound`
When 当前 run 依次采集 candidate、URL、DOM、runtime state 与 extension bridge evidence
Then 状态只能按 `candidate_found -> url_matched -> dom_ready -> runtime_state_detected -> extension_bridge_confirmed -> bound` 推进
And 不得跳过前置 evidence 直接进入 `bound`

### 场景 2：DOM ready 不等于 Page Ready

Given 状态机进入 `dom_ready`
When #1162 消费 target binding snapshot
Then #1162 只能把该状态视为 diagnostic input
And 不得把 `dom_ready` 当作 page ready pass

### 场景 3：runtime state 不等于 Runtime Ready

Given 状态机进入 `runtime_state_detected`
When downstream consumer 需要 runtime ready
Then consumer 必须等待 #1162 或 runtime owner 判定
And 不得把 runtime marker 当作 runtime ready proof

### 场景 4：extension bridge confirmed 不等于 bound

Given bridge addressing evidence 已对齐同一 candidate
When DOM 或 runtime state evidence 缺失、partial、stale 或 redaction invalid
Then 状态不得进入 `bound`
And blocking reasons 必须说明缺失项

### 场景 5：bound 仍不是 signed continuity

Given target binding snapshot state is `bound`
When #1171 需要 signed continuity
Then #1171 必须消费 transition chain 和自己的 signature/continuity evidence
And 不得把 `bound` 直接当作 signed continuity accepted

### 场景 6：导航后旧 evidence 必须 stale

Given 状态机曾进入 `bound`
When candidate 发生导航且无法证明仍为同一 target scope
Then 状态必须转为 `stale` 或 `lost`
And 旧 DOM/runtime/bridge evidence 不得复用为 current binding pass

### 场景 7：URL 离开目标 scope 必须 lost

Given candidate 已进入 `url_matched`
When normalized URL 离开允许 XHS read target scope
Then 状态必须转为 `lost`
And downstream read/page/runtime consumer 必须 fail closed

### 场景 8：历史 artifact 不得满足 current-run bound

Given 有同一 PR head 的历史 artifact 或旧 run bridge ack
When 当前 run 请求 `bound`
Then 状态机必须要求 current-run evidence
And historical evidence 只能进入 background refs 或 blocking reasons

### 场景 9：write scope 不得由 target binding 放行

Given `target_binding_snapshot.state=bound`
When downstream 请求 `live_write_commit`、publish、upload 或 submit
Then 本 FR 不得提升 write capability
And consumer 必须继续受 FR-0062 和后续 live-write owners 阻断

### 场景 10：Syvert boundary violation 必须阻断

Given snapshot 或 transition evidence 包含 Syvert normalized result、Syvert resource taxonomy 或 Syvert error taxonomy
When reviewer 或 consumer 校验 Target Binding State Machine
Then 该 payload 必须被视为 contract violation
And blocking reasons 必须包含 `syvert_boundary_violation`

## 验收标准

1. `spec.md` 冻结九个 target binding states、allowed transitions、fail-closed rules 与 downstream #1162/#1171 handoff。
2. `contracts/target-binding-state-machine.md` 提供 machine-consumable enums、snapshot shape、transition evidence shape 与 forbidden fields。
3. `data-model.md` 记录核心对象、生命周期、聚合规则、redaction 与 consumer 边界。
4. `research.md` 记录 FR-0061 consumption、local-only integration 判断和 live evidence N/A 判断。
5. `risks.md` 覆盖 stale evidence、page/runtime ready 混淆、signed continuity 混淆、write/live scope creep、Syvert boundary 与 sensitive locator 泄露。
6. `.github/spec-issue-sync-map.yml` 新增 `FR-0063 -> #1161` 映射。
7. PR metadata 使用 `Refs #1161`，不得使用 auto-closing keyword。
8. 本 PR 不修改 source runtime implementation、unrelated tests、scripts、workflows、Loom carrier 或其他 issue scope。
