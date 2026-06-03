# Execution Breakdown

本文件定义 Loom 的 execution breakdown 合同。

Execution breakdown 是 `plan.md` 与可追踪执行单元之间的语义层。它把当前 `Work Item` 的 plan phase、validation strategy、spec scenario 和后续 task carrier 连接起来，但不成为新的执行入口。

## 1. 适用场景

当 `plan.md` 出现以下任一信号时，应使用 execution breakdown：

- 一个 `Work Item` 的实现需要多个可独立追踪的执行单元。
- `plan.md` 的 phase、validation strategy 或风险项需要被 issue、checklist、`tasks.md`、Project item 或外部 tracker 承接。
- 后续 evidence-map、consistency-analysis、review 或 closeout 需要读取某个执行单元的 locator 与 provenance。
- 多个 subagent 或多个工作 lane 需要明确 ownership、输入和验收边界。

以下情况可声明 `not_applicable`：

- 当前 `Work Item` 是单步文档或机械修正，`plan.md` 已足够表达执行与验证。
- task carrier 不存在，且 review / merge-ready / closeout 不需要逐单元追踪。
- minimal path 明确不需要附加 breakdown，并已在 `plan.md` 或 `Work Item` 中记录理由。

## 2. 输入

Execution breakdown 必须消费当前 `Work Item` 的正式 locator，至少包括：

- `work_item_locator`: 当前 `Work Item` issue、repo-local work item 或等价唯一执行入口。
- `spec_locator`: 当前 `spec.md`，或 minimal path 的 `not_applicable` rationale。
- `plan_locator`: 当前 `plan.md`。
- `plan_phase_locator`: 被拆解的 `plan.md` phase、section 或 line-level locator。
- `validation_strategy_locator`: `plan.md` 中对应测试策略、人工验证、runtime evidence 或 `not_applicable` rationale。
- `upstream_planning_locator`: delivery planning、issue-tree plan、PR slicing 或 GitHub mapping locator，若本执行单元来自上游规划。

输入来自会话判断时，只能暂记为 `conversation locator`。正式执行、review 或 merge-ready 前，必须落到 issue、PR、doc、repo-local carrier 或明确 `not_applicable`。

## 3. 输出字段

Execution breakdown 输出至少包含：

- `schema_marker`: `loom-execution-breakdown/v1`。
- `work_item_locator`: 所属 `Work Item`。
- `plan_locator`: 被拆解的 `plan.md`。
- `unit_id`: 当前 `Work Item` 内稳定的执行单元 id。
- `unit_title`: 执行单元标题。
- `unit_goal`: 该单元要产生的可检查结果。
- `unit_scope`: 该单元允许修改或验证的范围。
- `non_goals`: 该单元明确不处理的事项。
- `source_mapping`: 回链到 spec scenario、plan phase、validation strategy 和上游 planning locator。
- `carrier_mapping`: 承接该单元的 task carrier locator，或 `not_applicable` rationale。
- `owner_expectation`: 主执行者或 subagent ownership 约束。
- `status`: `pending`、`in_progress`、`done`、`blocked`、`deferred` 或 `not_applicable`。
- `provenance`: 拆分依据、创建者、创建时间或 source locator。
- `freshness_rule`: 何时必须重新核对该单元。
- `consumer_contract`: evidence-map、consistency-analysis、review、merge-ready、closeout 和 #1020 skills/GitHub profile 接入应如何消费。

## 4. 状态语义

Execution breakdown 的状态只描述执行单元的计划与追踪状态，不描述验证或 gate 结论。

- `pending`: 单元已定义，但尚未进入执行。
- `in_progress`: 单元已有 owner、现场或 carrier 活动。
- `done`: 单元声明的局部产物已完成，并回链到验证 locator；它不等于 behavior evidence 或 test evidence 已充分。
- `blocked`: 单元因缺输入、依赖、权限、设计决定或验证失败而暂停，必须有 blocker locator。
- `deferred`: 单元仍可能属于目标，但当前不执行；必须有激活条件，且不得当作 completed。
- `not_applicable`: 单元不属于当前 `Work Item` 或 minimal path 合法跳过；必须有 rationale 与重新判断条件。

`done` 只能表示 breakdown unit 已完成其局部任务。review、merge-ready、closeout、behavior evidence、test evidence、fresh verification evidence 仍由各自 truth carrier 判断。

## 5. 权威边界

Execution breakdown 允许表达：

- `plan.md` 如何拆成可追踪执行单元。
- 每个执行单元回链到哪个 `Work Item`、spec scenario、plan phase 和 validation strategy。
- 每个执行单元由哪些 task carrier 承接。
- 哪些执行单元 deferred 或 not_applicable。
- 哪些 locator 可被 #1018 evidence-map / consistency-analysis 和 #1020 skills 接入消费。

Execution breakdown 禁止表达：

- 当前对象可以绕过 `Work Item` 进入执行。
- review、merge-ready 或 closeout 已通过。
- task carrier `done`、Project `Done`、checklist checked、issue closed 或 PR merged 等于完成真相。
- recovery 动态字段，例如 `next_step`、`blockers`、`latest_validation_summary` 或 `current_stop`。
- PR slicing 的最终合并策略；它只能引用 PR slicing 合同。

## 6. 与 `plan.md` 的关系

`plan.md` 仍是当前 `Work Item` 的执行计划入口。Execution breakdown 只消费 `plan.md`，不能反向改写 `plan.md` 的目标、约束或验证策略。

推荐映射：

| `plan.md` 字段 | breakdown 消费方式 |
| --- | --- |
| Implementation Goal | 作为所有 unit 的共同 goal boundary |
| Phases | 拆成 `plan_phase_locator` 与 unit grouping |
| Constraints | 进入每个 unit 的 scope / non-goals / owner expectation |
| Validation | 进入 `validation_strategy_locator` |
| Test Strategy | 进入 behavior / test evidence 的预期 locator |
| Subagent Output Integration | 进入 owner expectation 与 integration consumer contract |
| Dependencies | 进入 blocked / deferred / freshness rule |
| Ready For Implementation | 进入 execution readiness，不替代 admission checkpoint |

## 7. 与 task carrier 的关系

Task carrier 是 execution breakdown unit 的宿主或 repo-local承接方式。一个 unit 可以有零个、一个或多个 carrier，但必须有明确关系：

- `primary`: 主要承接该 unit 的 carrier。
- `mirror`: 只反映状态或视图的 carrier。
- `evidence_locator`: 指向验证记录，但不 authored 验证结论。
- `not_applicable`: 当前 unit 不需要 carrier。

Task carrier 的类型、状态、provenance 与 forbidden use 见 [../harness/task-carrier-contract.md](../harness/task-carrier-contract.md)。

## 8. 最小验证

完成 execution breakdown 合同时，至少验证：

- 每个 unit 都能回链 `Work Item`、spec scenario、plan phase 和 validation strategy，或声明 `not_applicable`。
- 每个 carrier 都有 locator、provenance 和 relationship。
- `done` / `deferred` / `not_applicable` 不被写成 closeout truth。
- recovery 动态字段仍由 recovery 主入口维护。
- 后续 #1018 可读取 unit locator，#1020 可读取 carrier mapping，但二者不需要重新定义本合同。
