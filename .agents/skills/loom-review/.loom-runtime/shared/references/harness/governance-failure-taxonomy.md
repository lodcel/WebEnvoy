# Governance Failure Taxonomy

本文件冻结 Loom strong governance 默认使用的统一失败分类。

它回答的不是“某个入口如何显示错误文案”，而是“同一类治理失败在所有 gate、状态面和宿主适配里使用什么语义”。

## 1. 目标

统一 taxonomy 至少要覆盖：

- `spec gate`
- `review gate`
- `merge gate`
- `GitHub controlled merge`
- `closeout`
- `reconciliation audit`
- 统一状态控制面

任何入口都不得为同类失败再发明私有状态名。

## 2. 顶层分类

Loom 当前只冻结三组顶层分类：

- `stale`
  - 既有结论仍存在，但已不再绑定当前受审对象
- `drift`
  - 两个本应一致的 truth surface 已经分叉
- `gate_failure`
  - 当前 gate 的必需前置、必需判断或必需校验没有通过

这三类可以同时出现，但输出时必须分开列示。

## 3. `stale` 子类

### 3.1 `spec_stale`

表示 formal spec 或 `spec_review` 结论不再覆盖当前准备进入实现的范围。

最小触发条件至少包括其一：

- `Work Item` 的目标、范围或关联 `FR` 已变化
- formal spec 已 reopen / rollback
- `spec_review` 结论对应的 spec 版本不再是当前版本

默认影响：

- 阻断 `review gate`
- 阻断 `merge gate`
- 状态面必须把前序 gate 标成不可继续消费

### 3.2 `review_stale`

表示 implementation review 结论不再绑定当前受审实现。

最小触发条件至少包括其一：

- `reviewed_head` 与当前受审 `head_sha` 不一致
- `reviewed_validation_summary` 与当前恢复主入口摘要不一致
- review 之后新增了超出 Loom carrier 更新范围的实现漂移

默认影响：

- 阻断 `merge gate`
- 阻断 `GitHub controlled merge`

### 3.3 `status_stale`

表示统一状态控制面展示的某个 gate 结论已过时，不能继续作为放行输入。

它是派生结论，不能独立 authored。

## 4. `drift` 子类

### 4.1 `head_drift`

当前 `Work Item` 绑定的 branch / PR / `head_sha` 与受审对象不一致。

### 4.2 `host_signal_drift`

宿主控制面信号之间互相冲突，或与 Loom 必需绑定链不一致。

典型例子：

- PR 指向的 issue 与当前 `Work Item` 不一致
- merge commit 无法回链当前 PR
- required checks / mergeability / branch protection 读取结果互相冲突

### 4.3 `reconciliation_drift`

closeout 阶段发现的控制面对齐漂移。

固定子类：

- `absorbed_but_open`
- `parent_drift`
- `project_drift`
- `merge_signal_drift`

其中 `merge_signal_drift` 表示 merge 后主干、PR、issue、project 对同一事项的收口结论不一致。

## 5. `gate_failure` 子类

### 5.1 `missing_prerequisite_gate`

缺少前序 gate，或前序 gate 仍未达到可消费状态。

典型例子：

- formal spec 路径缺 `spec_review`
- `merge gate` 缺 implementation review
- `closeout` 缺 merge / reconciliation basis

### 5.2 `binding_failure`

必需绑定链缺失、冲突或无法证明。

### 5.3 `host_gate_failure`

宿主 merge 控制面未达线。

## 6. Execution Failure Evidence

Loom 允许在 runtime evidence 中记录最近一次执行失败分类，作为 status / recovery / review 风险输入。

- `stall`
- `timeout`
- `retry_exhaustion`

这些分类不是新的顶层 taxonomy，不替代 `stale` / `drift` / `gate_failure`，也不得声明 scheduler state。retry evidence 只说明 attempt chain 已发生什么，不说明下一次何时执行。

典型例子：

- PR 仍是 draft
- required checks 未全部通过
- branch protection / merge method 不满足当前 profile

### 5.4 `evidence_failure`

验证证据、回滚边界或 closeout basis 缺失到无法继续放行。

最小触发条件至少包括其一：

- behavior evidence 缺失，且当前事项没有有效 `not_applicable`
- test evidence 缺失，且 plan / recovery 没有说明等价验证路径
- 最近验证不绑定当前 `HEAD`、当前范围或当前恢复摘要
- 证据只存在于未整合的 subagent 输出、会话文本或 engine raw output 中
- review disposition 的 accepted / rejected / deferred 结论缺少可审查依据

默认影响：

- 阻断 review 对应 finding 的关闭
- 阻断 `merge-ready`
- 阻断 closeout 对 `absorbed` / `closed_out` 的证明

### 5.5 `repeated_blocker`

同类阻断跨多轮、跨同一 gate 或跨多个 subagent 输出重复出现，说明当前处理方式没有解决 root cause。

最小触发条件至少包括其一：

- 同一测试、检查或行为场景连续失败
- 同类 review block finding 在 disposition 后再次出现
- 同一 evidence gap 在 build / review / merge-ready 中重复阻断
- 多个 subagent 独立报告同一类范围、设计或验证缺口

默认影响：

- 当前 gate 必须 `block` 或 `fallback`
- 状态面必须暴露 root-cause/repeated-blocker 信号
- 后续处理必须回到计划、实现路径、验证设计或 ownership 分配修正，不得继续只做局部表面修复

## 6. 输出纪律

每条治理失败至少要暴露：

- `category`
- `kind`
- `severity`
- `subject`
- `why_blocking`
- `fallback_to`
- `evidence`

约束：

- `category` 只允许 `stale` / `drift` / `gate_failure`
- `kind` 必须来自本文件冻结的子类
- `fallback_to` 只能指向已存在的前序 gate 或专门同步入口
- repeated blocker 必须带上 root-cause 假设、重复证据与下一步验证方式

## 7. 与统一状态控制面的关系

统一状态控制面至少要能同时暴露：

- 当前活跃 failures 列表
- 每个 failure 的 `category` / `kind`
- 它阻断了哪个 gate
- 它要求回退到哪里

状态面可以汇总，但不得把 taxonomy 压扁成单一字符串，例如“有点问题”或“需要处理”。

## 8. 非目标

- 不把宿主 API 的原始错误码直接提升为 Loom taxonomy
- 不为每个脚本单独维护失败枚举
- 不把 `warn` / `block` 混成 taxonomy 本身；二者只是 severity
