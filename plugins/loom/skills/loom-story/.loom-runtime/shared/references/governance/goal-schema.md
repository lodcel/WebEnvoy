# Goal Schema

本文件冻结 Loom 可读取、可校验、可恢复的 goal 语义 schema。

它是 `#821` 的主落点。它覆盖 Project goal、Phase goal、FR goal、Work Item goal、主 `/goal` execution contract 与 delegated goal。

## 1. 目标与边界

goal schema 用于说明不同治理层级“要完成什么、范围是什么、如何验收、缺失时如何阻断”。

它不替代：

- backlog schema
- Work Item 文件格式
- GitHub issue schema
- Project item schema
- review record
- merge checkpoint
- closeout basis

任何 goal 都不得记录 review verdict、merge result、closeout final state 或 runtime progress。

## 2. Goal 层级

| Goal | 作用 | 权威边界 |
| --- | --- | --- |
| Project goal | 说明 Project view 服务的总体交付目标和 backlog 管理边界 | 不是唯一真相源，不替代 Phase / FR / Work Item |
| Phase goal | 说明阶段要收口的能力方向、成功信号和非目标 | 约束阶段范围，不直接进入 implementation |
| FR goal | 说明能力合同要让谁完成什么任务、达到什么可验收结果 | 约束 requirement，不替代 Work Item |
| Work Item goal | 说明本次执行回合要完成的最小可合并结果，以及如何验证 | 正式执行默认从 Work Item 派生 |
| `/goal` command contract | 从 Work Item goal 派生，绑定当前会话 execution contract | 不是 governance truth，不替代 Work Item |
| delegated goal | 从 Work Item goal 或主 `/goal` 派生，绑定局部任务 | 不是新的 Work Item，完成声明必须回到主执行链验证 |

## 3. 通用字段

每个 repo-authored goal 至少包含：

| Field | Type | Required | Source | Missing semantics |
| --- | --- | --- | --- | --- |
| `schema_version` | string | yes | goal carrier | 缺失为 `missing` |
| `goal_type` | enum | yes | goal carrier | 缺失或不合法为 `missing` |
| `id` | string | yes | host object 或 repo carrier | 缺失为 `missing` |
| `title` | string | yes | host object 或 repo carrier | 缺失为 `missing` |
| `objective` | string | yes | repo-authored truth | 缺失为 `missing` |
| `scope` | array[string] | yes | repo-authored truth | 缺失为 `missing`；与下游执行不一致为 `scope_mismatch` |
| `non_goals` | array[string] | yes | repo-authored truth | 缺失为 `missing` |
| `success_signals` | array[string] | yes | repo-authored truth | 缺失为 `missing` |
| `validation` | array[string] | yes | repo-authored truth | 缺失或无法执行为 `unverifiable_validation` |
| `source_locators` | array[locator] | yes | repo / host / companion locator | 缺失、不可读或越界为 `missing` |
| `parent_locators` | array[locator] | conditional | 上位 goal 或 requirement | 上下游不一致为 `scope_mismatch` |
| `host_mirrors` | array[locator] | optional | GitHub issue / Project / PR 等 | stale mirror 为 `stale` |
| `updated_at` | string | recommended | carrier timestamp 或 host mirror | 旧于绑定对象且无法解释时为 `stale` |

`goal_type` 只允许：

- `project`
- `phase`
- `fr`
- `work_item`
- `execution`
- `delegated`

## 4. Project Goal

Project goal 描述 Project view 的总体交付目标与 backlog 管理边界。

额外字段：

| Field | Type | Required | Source | Missing semantics |
| --- | --- | --- | --- | --- |
| `project_locator` | locator | yes | host Project 或 repo carrier | 缺失为 `missing` |
| `backlog_boundary` | string | yes | Project / repo-authored truth | 缺失为 `missing` |
| `phase_locators` | array[locator] | recommended | host / repo | 缺失不阻断单个 Work Item，但阻断 Project-level closeout |

Project goal 不得成为唯一真相源。它只能作为 Project view 与 Phase / FR / Work Item 的组织入口。

## 5. Phase Goal

Phase goal 描述阶段要收口的能力方向、成功信号与非目标。

额外字段：

| Field | Type | Required | Source | Missing semantics |
| --- | --- | --- | --- | --- |
| `phase_locator` | locator | yes | Phase issue 或 repo carrier | 缺失为 `missing` |
| `fr_locators` | array[locator] | yes | Phase issue / repo carrier | 缺失为 `missing` |
| `completion_boundary` | string | yes | repo-authored truth | 缺失为 `missing` |

Phase goal 不能直接进入 implementation。正式执行仍必须拆到 Work Item。

## 6. FR Goal

FR goal 描述能力合同要让谁完成什么任务，以及达到什么可验收结果。

额外字段：

| Field | Type | Required | Source | Missing semantics |
| --- | --- | --- | --- | --- |
| `fr_locator` | locator | yes | FR issue 或 repo carrier | 缺失为 `missing` |
| `requirement_boundary` | string | yes | FR truth | 缺失为 `missing` |
| `work_item_locators` | array[locator] | yes | FR issue / repo carrier | 缺失为 `missing` |
| `acceptance_summary` | array[string] | yes | FR truth / story locator | 缺失为 `missing` |

FR goal 可以为 Work Item 提供 requirement 边界，但不能替代 Work Item 执行入口。

## 7. Work Item Goal

Work Item goal 描述本次执行回合的最小可合并结果。

额外字段：

| Field | Type | Required | Source | Missing semantics |
| --- | --- | --- | --- | --- |
| `work_item_locator` | locator | yes | Work Item issue 或 repo carrier | 缺失为 `missing` |
| `branch` | string | conditional | Work Item / execution context | 已进入实现但缺失为 `unbound_workspace` |
| `formal_worktree` | locator | conditional | Work Item / workspace carrier | 已进入实现但缺失或不一致为 `unbound_workspace` |
| `pr_locator` | locator | conditional | host mirror | 已进入 review / merge-ready 但缺失为 `missing` |
| `head_sha` | string | conditional | Git / host mirror | 与 PR 或 worktree 不一致为 `stale` |
| `expected_validation` | array[string] | yes | Work Item truth | 缺失或不可执行为 `unverifiable_validation` |
| `stop_conditions` | array[string] | yes | Work Item truth | 缺失为 `missing` |

Work Item goal 是主 `/goal` execution contract 的默认来源。

## 8. `/goal` Command Contract

主 `/goal` 从 Work Item goal 派生，用于当前会话的 execution contract。

机器可读 schema 固定为 `loom-goal-execution-contract/v1`。校验输出固定为
`loom-goal-readiness/v1`，并由 `flow resume`、repo-local `loom_status`、`goal validate`
和 closeout 前置读面消费。

字段：

- `objective`
- `source_issue`，即 source issue locator
- `work_item`
- `scope`
- `non_goals`
- `source_locators`
- `branch`
- `formal_worktree`
- `pr`
- `head_sha`
- `expected_validation`
- `stop_conditions`
- `return_path`

稳定约束：

- `/goal` 不得成为 governance truth
- `/goal` 不得替代 Work Item 文件或 issue
- `/goal` 必须能回链到 Work Item goal
- branch、formal worktree、PR 与 head SHA 不一致时为 `unbound_workspace` 或 `stale`
- validation 缺失或不可复现时为 `unverifiable_validation`
- `/goal` 只能绑定当前执行现场，不得把“目标完成”写成完成真相

## 9. Delegated Goal

delegated goal 从 Work Item goal 或主 `/goal` 派生，绑定局部任务。

字段：

- `parent_goal`
- `delegated_goal_id`
- `task_goal`
- `scope`
- `context_locators`
- `read_scope`
- `write_ownership`
- `non_goals`
- `dependencies`
- `validation_expectation`
- `evidence_output`
- `output_format`
- `return_path`

稳定约束：

- delegated goal 接收方无关，可以分配给 subagent、人工 worker 或外部 orchestrator
- delegated goal 不是新的 Work Item
- write ownership 不得与其他 active delegation 重叠
- 完成声明必须回到主执行链，由主 executor 集成并验证
- 未集成 delegated evidence 不得作为 Work Item 完成、review 通过、merge-ready 或 closeout 的事实

delegated execution protocol 至少要证明：

- delegated scope 来自主 `/goal` 或 Work Item goal
- read scope 与 write ownership 已声明，且不与其他 active delegation 重叠
- 子执行返回 evidence locator、验证摘要与未集成风险
- 主 executor 已消费这些 evidence，并把最终判断写回 review / validation / merge-ready 或 closeout 可读载体

## 9.1 `/goal completion` evidence

`/goal completion` 可作为 closeout 的附加 evidence input，schema 固定为
`loom-goal-completion/v1`。

它至少绑定：

- `work_item` 或 `item_id`
- `head_sha`
- `expected_validation` 或 validation evidence locator
- completion summary

closeout 只能把 `/goal completion` 当作一致性证据读取：

- 缺失时不能单独证明未完成，除非调用方显式要求该 evidence
- mismatch 时必须阻断 closeout，并回到 closeout 修复路径
- valid 时也不代表事项已完成；最终仍以 PR、merge commit、target branch、issue、Project、review 与 validation evidence 的一致性为准

## 10. Locator 关系

GitHub issue、GitHub Project、PR 与 Project item 只是 host control mirror。

稳定关系：

- Project view 可以定位 Project goal，但不替代 repo-authored truth
- Phase issue 可以承载或定位 Phase goal
- FR issue 可以承载或定位 FR goal
- Work Item issue 可以承载或定位 Work Item goal
- story carrier 可以为 FR / Work Item 提供 acceptance scenario locator 与 Story Business Confirmation locator
- PR 可以作为 Work Item 的 implementation mirror，但不能反推替代 Work Item
- `/goal` 与 delegated goal 只能派生自上游 goal，不反向改写上游 truth

## 11. 校验失败分类

goal 校验必须区分：

- `missing`
  - 必填字段、locator 或上位关系缺失
- `stale`
  - host mirror、head SHA、PR 或 worktree 信息旧于当前绑定对象
- `scope_mismatch`
  - 下游 goal、branch、PR、delegation 或 validation 超出上游 scope
- `unbound_workspace`
  - 已进入执行但无法证明 Work Item、branch、formal worktree、PR 与 head SHA 一致
- `unverifiable_validation`
  - validation 缺失、不可执行、未绑定当前 scope，或无法提供 evidence

阻断输出至少包含：

- failing goal locator
- failure class
- missing or mismatched fields
- affected downstream surfaces
- required repair target

## 12. 与其他合同的关系

- [work-item-contract.md](../harness/work-item-contract.md)
  - 承接 Work Item 作为唯一默认执行入口与 enforcement 纪律
- [subagent-driven-execution.md](../harness/subagent-driven-execution.md)
  - 承接 delegated goal 在 subagent-driven execution 中的 ownership 与集成边界
- [github-delivery-funnel.md](./github-delivery-funnel.md)
  - 承接 GitHub profile 下 Project / Phase / FR / Work Item / PR 的默认对象关系
- [story-intake.md](./story-intake.md)
  - 承接 story carrier、acceptance scenario locator 与 Story Business Confirmation

本文件只定义 goal 语义 schema，不定义具体宿主 API、Project 字段或 Work Item 文件格式。
