# Task Carrier Contract

本文件定义 Loom 的 task carrier 合同。

Task carrier 是 execution breakdown unit 的承接载体。它可以来自 GitHub issue、sub-issue、Project item、checklist、repo-local `tasks.md`、external tracker 或 `not_applicable` rationale，但它不是 `Work Item`、不是 recovery 主入口，也不是 review、merge-ready 或 closeout truth。

Execution breakdown 语义见 [../templates/execution-breakdown.md](../templates/execution-breakdown.md)。

## 1. 目标

Task carrier 解决两个问题：

- 让 `plan.md` 拆出的执行单元可以被人和工具稳定定位。
- 让不同宿主或项目习惯可以承接任务组织，而不把宿主状态提升为 Loom truth。

它不解决：

- 谁可以进入正式执行链。
- 当前 `Work Item` 是否完成。
- 行为证据、测试证据、review、merge-ready 或 closeout 是否充分。

这些判断仍由 `Work Item`、recovery、review record、merge checkpoint、closeout basis 和 evidence-map 等正式载体承接。

## 2. 类型

Loom 默认识别以下 task carrier 类型：

- `github_issue`
  - GitHub issue 或 sub-issue，可承接 execution breakdown unit 的讨论、scope 和局部状态。
- `github_project_item`
  - GitHub Project item，只承接视图、排序、筛选和看板状态。
- `checklist_item`
  - Issue、PR 或文档中的 checklist item，适合轻量追踪局部步骤。
- `repo_tasks_md`
  - repo-local `tasks.md` 或等价任务文件中的条目。
- `external_tracker`
  - Jira、Linear、Asana、Notion、spreadsheet 或其他外部 tracker 的条目。
- `not_applicable`
  - 当前 unit 不需要 carrier，或 minimal path 合法跳过 carrier。

项目可以通过 repo companion 或 interop 声明额外 carrier locator，但额外类型仍必须遵守本文件的 truth boundary。

## 3. 状态

Task carrier 状态至少使用以下词表：

- `pending`: carrier 已存在，但执行尚未开始。
- `in_progress`: carrier 正在承接执行或协调。
- `done`: carrier 条目已完成或被勾选；它不等于 evidence present、review pass、merge-ready pass 或 closeout。
- `blocked`: carrier 记录了阻断；必须回链 blocker locator 或 recovery entry。
- `deferred`: carrier 对应事项推迟；必须有激活条件，且不得当作 completed。
- `not_applicable`: carrier 不适用于当前 unit；必须有 rationale。

若宿主只有其他状态词，Loom consumer 必须映射到上述词表，并记录 source value。例如 GitHub Project `Done` 只能映射为 carrier `done`，不能映射为 Loom completed truth。

## 4. Locator 与 Provenance

每个 task carrier 必须记录：

- `carrier_type`
- `carrier_locator`
- `source_value`
- `normalized_status`
- `relationship`: `primary`、`mirror`、`evidence_locator` 或 `not_applicable`
- `work_item_locator`
- `breakdown_unit_locator`
- `spec_scenario_locator` 或 `not_applicable`
- `plan_phase_locator`
- `validation_strategy_locator`
- `provenance`: 创建或同步来源、时间、操作者或 host event locator
- `freshness_rule`

缺少 locator 或 provenance 的 carrier 只能作为临时 conversation note，不能被 review、merge-ready、closeout 或 #1018 consistency-analysis 当作稳定输入。

## 5. Carrier Relationship

一个 execution breakdown unit 可以有多个 carrier，但必须区分关系：

- `primary`: 当前 unit 的主要追踪载体。一个 unit 同一时间最多一个 primary carrier。
- `mirror`: 宿主视图或同步结果，只能辅助读取，不得覆盖 primary 或 Loom truth。
- `evidence_locator`: 指向验证运行、review note 或人工检查记录；它只提供 locator，不 authored 证据结论。
- `not_applicable`: 明确说明不需要 carrier。

当 primary 与 mirror 冲突时，消费者必须回到 `Work Item`、execution breakdown、recovery 和 host binding 检查；不得用 mirror 覆盖 authored truth。

## 6. 默认承接边界

| Carrier | 可承接 | 不可承接 |
| --- | --- | --- |
| GitHub issue / sub-issue | unit scope、讨论、阻断、局部状态、回链 | 替代 `Work Item`、review、merge-ready、closeout |
| Project item | 视图、排序、筛选、看板 status | completed truth、执行入口、review verdict |
| checklist item | 轻量步骤追踪、局部勾选、人工确认 locator | behavior evidence、test evidence、closeout |
| `tasks.md` | repo-local 任务列表、unit 到 carrier mapping | core 必选工件、恢复主入口、gate truth |
| external tracker | 外部组织系统中的任务承接 | Loom-authored truth、host binding truth |
| `not_applicable` | minimal path 或无 carrier 的合法说明 | missing carrier 的静默替代 |

## 7. `tasks.md` 替代关系

`tasks.md` 是 `repo_tasks_md` carrier 的一种实现，不是 Loom core 必选工件。

允许：

- 用 `tasks.md` 表达 execution breakdown unit 列表。
- 在 `tasks.md` 中回链 `Work Item`、spec scenario、plan phase、validation strategy 和验证 locator。
- 用 `tasks.md` 辅助 subagent ownership、局部 checklist 和 external tracker 对照。

禁止：

- 要求所有 Loom 项目必须存在 `tasks.md`。
- 用 `tasks.md` 替代 `Work Item`、`plan.md`、recovery、review record、merge-ready 或 closeout。
- 把 `tasks.md` 的 checked / done 当成 behavior evidence 或 test evidence。
- 在 `tasks.md` authored `next_step`、`blockers`、`latest_validation_summary` 或 closeout result。

## 8. GitHub / Project / Checklist 边界

GitHub issue、sub-issue、Project item 和 checklist 都可以承接 task carrier，但宿主状态只提供 carrier state 或 host mirror。

必须保持：

- `Phase -> FR -> Work Item` 层级仍优先由 GitHub native parent/sub-issue 表达。
- 执行依赖仍优先由 native `blocked-by/blocks` 表达。
- Project item 只提供视图和排序。
- checklist checked 只表示 checklist carrier `done`。
- issue closed 只表示该 host issue closed；若该 issue 是 `Work Item`，仍需 closeout evidence 才能视为完成。
- PR merged 只进入 PR / merge commit locator，不替代 `Work Item` closeout。

Project `Done`、task `done`、checklist checked、external tracker `Done` 都不等于 behavior evidence、test evidence、review pass、merge-ready pass 或 closeout。

## 9. Work Item Truth 保护

正式执行仍必须从 `Work Item` 进入。Task carrier 可以被 `Work Item`、execution breakdown、evidence-map 或 status surface 读取，但不得反向创建或覆盖：

- `Work Item` goal、scope、execution path、workspace entry、recovery entry、validation entry 或 closing condition。
- recovery 主入口的 `current_stop`、`next_step`、`blockers`、`latest_validation_summary`。
- review record、merge checkpoint、controlled merge result 或 closeout basis。

若 task carrier 与这些 truth carriers 冲突，Loom consumer 必须标记 `stale`、`drift` 或 `blocking consistency gap`，并回到 truth carrier 修复。

## 10. #1020 接入需求

#1020 在接入 skills / GitHub profile / generated skills surface 时，应消费本合同并补齐：

- agent-facing skills 如何读取 execution breakdown unit 与 task carrier mapping。
- GitHub task carrier profile 如何展示 issue、sub-issue、Project item、checklist 与 `tasks.md` 的 normalized status。
- source skills 与 generated skills surface 如何保持同一份 carrier 语义。
- installer / skills checks 如何发现 carrier reference drift。

本 FR 只定义合同，不修改 skills routing 或 generated runtime surface。

## 11. 最小验证

完成 task carrier 合同时，至少验证：

- carrier 类型覆盖 GitHub issue/sub-issue、Project item、checklist、`tasks.md`、external tracker 和 `not_applicable`。
- 状态覆盖 `pending`、`in_progress`、`done`、`blocked`、`deferred`、`not_applicable`。
- 每个 carrier 能回链 `Work Item`、execution breakdown unit、spec scenario、plan phase 和 validation strategy。
- `deferred` 不等于 completed。
- carrier done / Project Done / checklist checked 不等于 evidence present 或 gate pass。
