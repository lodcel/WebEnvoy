# Evidence Map

本文件定义 Loom formal spec path 中的 `evidence-map` 合同。

本文件当前承接：

- `#1018`
- `#1041`

## 1. 能力定位

`evidence-map` 是证据索引与绑定合同。它把 `spec.md`、`plan.md`、当前 Work Item、当前范围、`HEAD`、PR 和宿主信号连接到可消费证据，但它不是证据本身。

它只回答：

- 哪个行为场景或验收标准由哪个 evidence locator 覆盖
- 该 evidence 是 `behavior evidence`、`test evidence` 还是 `fresh verification evidence` 的输入
- evidence 绑定哪个 Work Item、scope、`HEAD`、PR、reviewed head、merge commit 或 `not_applicable` rationale
- 证据在什么条件下 fresh、stale、missing、conflict 或 not_applicable
- 后续 review、merge-ready、closeout 和 status surface 应读取哪个 source locator

`evidence-map` 不得：

- 替代测试、检查、人工验证或运行记录
- 替代 review record、merge-ready、closeout 或 reconciliation truth
- authored 第二份当前状态
- 自动修复缺口

## 2. 输入合同

`evidence-map` 必须声明被消费输入和输入状态。

| 输入 | 状态 | 消费边界 |
| --- | --- | --- |
| Work Item / FR locator | required | 绑定目标、范围、分支、PR 和后续 closeout 回链 |
| `spec.md` | required | 提供 scenario / acceptance locator 与 behavior evidence expectation |
| `plan.md` | required | 提供 validation strategy / test strategy 与 fresh evidence expectation |
| suite path decision | consumed from [spec-suite.md](./spec-suite.md) | 若存在 `suite-index.md`，只消费 path decision、artifact inventory 和 not_applicable 表；若不存在，记录 minimal path 的 `not_applicable` rationale |
| `research.md` / `contracts.md` / `readiness-checklist.md` | optional / conditional per [spec-suite.md](./spec-suite.md) | 只在对应 locator 已存在且适用时消费；合法 `not_applicable` 不得当作 blocking missing |
| execution breakdown / task carrier locators | candidate until #1017 stabilizes | 只能记录 candidate locator、optional carrier 或 `not_applicable` rationale；不得定义 task carrier truth |
| review record | optional before review, required after review consumption | 只消费 reviewed head、validation summary、decision 与 consumed evidence locators |
| merge-ready attempt or retained merge checkpoint | optional before merge-ready, required for closeout consumption | 只消费 successful result、head binding 与 evidence freshness |
| host state | required when PR / issue / Project exists | 只消费 branch、PR、checks、Project、issue、merge commit 等 host mirror signals |

`evidence-map` 只消费 #1016 已稳定的 suite path locator 和适用性判断，不反向定义 full suite 工件列表。未稳定的 #1017 输入必须写成 `candidate`、`optional`、`deferred` 或 `not_applicable`，不得定义 task carrier truth。后续 skills / generated surface / GitHub profile 接入需求记录给 #1020。

## 3. Evidence 类型

`evidence-map` 必须区分三类证据。

| 类型 | 证明内容 | 常见 source locator | Fresh 条件 |
| --- | --- | --- | --- |
| `behavior_evidence` | `spec.md` 的可观察场景或验收标准已经成立 | test result、manual validation、review consumed input、host check、example output、docs structural check | 绑定当前 Work Item、scope、scenario / acceptance locator、当前 `HEAD` 或 reviewed head |
| `test_evidence` | `plan.md` 承诺的 automated / manual / structural 验证已执行 | test command output、CI check、manual run note、structural `rg` / script check、review consumed input | 绑定当前 validation strategy、当前 `HEAD`、当前恢复摘要或 validation summary |
| `fresh_verification_evidence` | behavior / test evidence 仍覆盖当前放行对象 | evidence-map 派生字段，不能单独 authored | 所有被消费 evidence 均为 present，且绑定当前 `HEAD`、scope、PR head 或 merge commit 包含关系 |

同一个 source locator 可以同时支持 behavior 和 test evidence，但每个消费语义必须分行声明。

## 4. 最小字段

每条 evidence row 至少包含：

- `evidence_id`
- `evidence_type`
  - `behavior_evidence`
  - `test_evidence`
  - `fresh_verification_input`
- `source_locator`
- `source_kind`
  - `repo_file`
  - `review_record`
  - `runtime_attempt`
  - `ci_check`
  - `host_signal`
  - `manual_validation`
  - `structural_check`
  - `not_applicable_rationale`
- `consumes`
  - `spec_scenario_locator`
  - `spec_acceptance_locator`
  - `plan_validation_locator`
  - `plan_test_strategy_locator`
  - `task_carrier_locator` as `candidate | optional | deferred | not_applicable` until #1017 stabilizes
- `binding`
  - `work_item`
  - `scope`
  - `head_sha`
  - `reviewed_head`
  - `pr`
  - `merge_commit`
  - `host_state_locator`
- `freshness`
  - `present`
  - `stale`
  - `missing`
  - `conflict`
  - `not_applicable`
- `freshness_rule`
- `provenance`
- `consumer_boundary`
- `remediation_direction`

## 5. 状态词表

`freshness` 只允许以下值：

- `present`
  - source locator 可读，绑定当前 Work Item、scope 和当前受审对象。
- `stale`
  - source locator 可读，但绑定旧 `HEAD`、旧 scope、旧 validation summary、旧 PR head 或未整合的 subagent 输出。
- `missing`
  - 当前路径和风险要求该 evidence，但没有 locator 或 locator 不可读。
- `conflict`
  - source locator 与 Work Item、spec、plan、review、PR、host state 或 closeout basis 互相冲突。
- `not_applicable`
  - 当前目标不需要该 evidence，并有 rationale、consumer boundary 和 recheck condition。

`not_applicable` 不等于 `missing`。`deferred` 也不等于 `not_applicable`：deferred 仍可能属于目标，只是当前批次不消费，必须记录激活条件和不得当作 completed 的声明。

## 6. Consumer Contract

### Review

Review 消费 `evidence-map` 时，只能读取 source locator、scenario / validation mapping、freshness 和 provenance。正式 review 结论仍写入单一 review record。

Full path 下，缺少 scenario -> behavior evidence 或 acceptance -> test evidence mapping 默认是 blocking consistency gap。Minimal path 下，只有带 rationale、consumer boundary 和 recheck condition 的 `not_applicable` 才能跳过。

### Merge-ready

Merge-ready 消费 `evidence-map` 时，必须验证 evidence 覆盖当前 `HEAD`、scope、reviewed head、PR head 和当前 validation summary。旧验证、未整合 subagent 输出或 PR head drift 必须显示为 `stale` 或 `conflict`，不得作为 fresh verification evidence。

### Closeout

Closeout 消费 `evidence-map` 时，不重新执行 BDD/TDD 判断，只校验证据能从 review record、merge-ready basis、PR head、host required checks、merge commit、target branch 和 reconciliation audit 回链。

### Status surface

Status surface 只能展示 `evidence-map` 派生结论。它不得在状态面内 authored evidence，也不得用展示字段覆盖 source locator 中的 truth。

## 7. #1020 接入需求

#1020 后续接入 skills / GitHub profile / generated surface 时，至少需要消费：

- `evidence-map` scaffold locator
- evidence row 的固定字段和状态词表
- `not_applicable` 与 `deferred` 的区分
- status surface 只展示派生结论的边界
- source docs / generated skills surface 的引用同步和 drift check
