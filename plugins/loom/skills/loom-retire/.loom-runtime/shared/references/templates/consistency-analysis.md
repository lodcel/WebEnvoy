# Consistency Analysis

本文件定义 Loom formal spec path 中的 `consistency-analysis` 合同。

本文件当前承接：

- `#1018`
- `#1042`
- `#1044`

## 1. 能力定位

`consistency-analysis` 是 Loom 版 analyze。它检查 Work Item、suite inputs、spec、plan、execution breakdown / task carrier candidate、evidence-map、review、`HEAD`、PR 和 host state 是否仍一致。

它输出可消费结论和 remediation direction，不直接修文件，不替代 review、merge-ready、closeout、reconciliation audit 或 gate-chain。

## 2. 输入合同

每次 analysis 必须声明输入快照。

| 输入 | Requirement | Freshness 绑定 |
| --- | --- | --- |
| Work Item / FR locator | required | item id、scope、branch、workspace、PR |
| `spec.md` | required | scenario / acceptance locators |
| `plan.md` | required | validation / test strategy locators |
| suite path decision | consumed from [spec-suite.md](./spec-suite.md) | suite-index locator 或 minimal path `not_applicable` rationale |
| conditional full suite artifacts | optional / conditional per [spec-suite.md](./spec-suite.md) | research / contracts / readiness locators 或 not_applicable |
| execution breakdown / task carrier | candidate until #1017 stabilizes | candidate / optional / deferred / not_applicable locators only |
| evidence-map | required for this analysis | evidence rows、source locators、freshness rules |
| review record | required after review exists | reviewed head、validation summary、decision、consumed inputs |
| current `HEAD` / PR head | required when branch / PR exists | current head, reviewed head, PR head, merge commit |
| host state | required when host objects exist | issue state、PR state、checks、Project、merge status |

未稳定输入不得被升级成 required truth。#1016 suite 输入只能通过 [spec-suite.md](./spec-suite.md) 的 locator 和适用性判断消费；#1017 task carrier 输入在稳定前只能作为 candidate / optional / deferred / not_applicable。若当前事项需要未稳定输入，analysis 输出 `candidate_input_gap` 或 `deferred_input`，并把接入需求记录给 #1020 或对应 owning FR。

## 3. 输出 Envelope

`consistency-analysis` 输出至少包含：

- `schema_version`: `loom-consistency-analysis/v1`
- `item_id`
- `scope`
- `head_sha`
- `pr`
- `suite_path`
- `analysis_time`
- `input_snapshot`
- `summary`
- `result`
  - `pass`
  - `block`
  - `advisory`
  - `not_applicable`
- `findings`
- `blocking_consistency_gaps`
- `advisory_consistency_gaps`
- `not_applicable_gaps`
- `remediation_summary`
- `consumer_boundary`

`result = block` 表示至少存在一个 blocking consistency gap。`result = advisory` 表示没有 blocking gap，但存在 review / merge-ready / closeout 应展示的风险。`result = not_applicable` 只能用于当前目标没有 formal spec / evidence consistency surface，且必须保留 rationale 与 recheck condition。

## 4. Finding 字段

每条 finding 至少包含：

- `id`
- `classification`
  - `blocking`
  - `advisory`
  - `stale`
  - `missing`
  - `conflict`
  - `not_applicable`
- `gap_kind`
- `surface`
  - `spec`
  - `plan`
  - `suite`
  - `task_carrier_candidate`
  - `evidence_map`
  - `review`
  - `merge_ready`
  - `closeout`
  - `host_state`
  - `status_surface`
- `source_locator`
- `conflicting_locator`
- `freshness`
- `provenance`
- `binding`
  - `work_item`
  - `scope`
  - `head_sha`
  - `reviewed_head`
  - `pr`
  - `host_state_locator`
- `consumer_impact`
  - `review`
  - `merge_ready`
  - `closeout`
  - `status_surface`
  - `#1019_gate_chain`
- `remediation_direction`
- `fallback_to`

`remediation_direction` 只表达修复方向。它可以指向回到 spec mapping、在当前 `HEAD` 重新验证、修复 host binding，或把 deferred item 移出 completed summary，但不得执行修复。

## 5. 分类语义

`classification` describes how a consumer should treat the finding:

- `blocking`
  - 当前路径的必需一致性缺口。Review 或 merge-ready 不得放行，closeout 不得视为 closed_out basis。
- `advisory`
  - 风险或改进项。必须展示给 review / merge-ready / closeout，但不得单独阻断。
- `stale`
  - locator 存在但绑定旧 head、旧 scope、旧 validation summary、旧 PR 或未整合输出。是否 blocking 由 `gap_kind` 和 consumer surface 决定。
- `missing`
  - 当前路径需要的 locator、mapping 或 evidence 不存在。Full path 下通常 blocking；minimal path 可由有效 `not_applicable` 消解。
- `conflict`
  - 两个或多个 source locator 对同一事实给出互斥结论。Host state conflict、HEAD drift、reviewed head mismatch 默认 blocking。
- `not_applicable`
  - 当前目标不需要该 consistency check，且有 rationale、consumer boundary 和 recheck condition。

## 6. Blocking Consistency Gap 分类

以下 gap 在 full path 下默认 blocking；minimal path 只有在有效 `not_applicable` rationale 存在时才能降为 not_applicable。

| Gap kind | Blocking surface | 说明 | Remediation direction |
| --- | --- | --- | --- |
| `missing_scenario_mapping` | review, merge-ready | `spec.md` scenario 没有映射到 `plan.md` validation 或 evidence-map behavior evidence | 回到 spec / plan 映射，补 locator 或明确 not_applicable |
| `missing_acceptance_test_mapping` | review, merge-ready | acceptance 没有映射到 test / structural / manual evidence | 回到 plan test strategy 或 evidence-map |
| `stale_evidence` | review, merge-ready, closeout | evidence 绑定旧 `HEAD`、旧 scope、旧 validation summary 或未整合 subagent 输出 | 在当前 `HEAD` 重新验证并更新 evidence locator |
| `missing_fresh_verification_evidence` | merge-ready, closeout | behavior / test evidence 无法组合成当前对象的 fresh verification evidence | 刷新验证摘要，绑定当前 head / PR |
| `head_or_pr_drift` | merge-ready, closeout | current `HEAD`、reviewed head、PR head 或 merge commit 包含关系不一致 | 回到 review 或 host binding 修复 |
| `host_state_conflict` | merge-ready, closeout | issue、PR、Project、checks、branch 或 merge state 互相冲突 | 回到 host binding / reconciliation audit |
| `deferred_as_completed` | review, merge-ready, closeout | deferred item 被当作 completed / closed_out / done 消费 | 移出 completed summary，绑定 follow-up 或重新纳入 scope |
| `missing_source_locator` | review, merge-ready, status_surface | blocking 结论没有 source locator 或 provenance | 补 locator，或把结论降为不可消费 |
| `parallel_truth` | review, merge-ready, closeout | status surface、PR body、task carrier 或 Project status authored 第二份 truth | 回到 owning truth carrier，删除或重标派生字段 |
| `candidate_input_treated_as_required` | review, merge-ready | 未稳定输入被当成 required truth，例如 #1017 task carrier | 改成 candidate / optional / deferred / not_applicable，并记录给 owning FR 或 #1020 |

Advisory gap examples:

- optional full suite artifact absent with valid `not_applicable`
- budget, retry, or execution failure risk that existing harness rules define as advisory
- stale historical review evidence retained only as history, not current approval
- candidate task carrier locator missing while #1017 has not stabilized and current consumer does not require it

## 7. Freshness 规则

Analysis 不得把 evidence 或 finding 当成 fresh，除非它同时绑定：

- 当前 Work Item
- 当前 scope
- 当前 `HEAD` 或 reviewed head
- 当前 validation summary
- 当前 PR head when PR exists
- host state locator when host state is consumed

Closeout 场景还必须能证明 merge commit / target branch 包含被验证 PR head，且 issue / PR / Project / reconciliation audit 可以回链。

## 8. Status Surface 展示边界

Status surface 可以展示：

- `consistency_analysis.result`
- `blocking_consistency_gaps`
- `advisory_consistency_gaps`
- `not_applicable_gaps`
- 每条 finding 的 `source_locator`、`freshness`、`provenance` 和 `remediation_direction`

Status surface 不得：

- authored finding
- 修改 evidence-map
- 把 advisory gap 当作 blocking
- 把 missing gap 伪装成 not_applicable
- 用 status surface 展示替代 review、merge-ready、closeout 或 reconciliation truth

## 9. #1019 / #1020 消费边界

#1019 可以消费本文件的 output envelope、finding 分类和 blocking gap 表来定义 gate-chain consumption，但不应在 #1018 内实现 gate-chain。

#1020 后续负责把 `consistency-analysis` 暴露给 skills、GitHub profile 和 generated surface，并同步 source / generated 引用。#1018 只记录需求，不修改 skills routing 或 generated runtime surface。
