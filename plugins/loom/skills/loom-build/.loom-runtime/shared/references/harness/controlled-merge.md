# Controlled Merge

本文件定义 Loom strong governance 下的 `GitHub controlled merge` 合同。

## 1. 目标

`GitHub controlled merge` 负责把 `merge gate` 之后的宿主控制面读取、merge 方法约束、merge 后回链与 closeout 衔接收成一条正式链路。

它回答四件事：

- 当前 PR 是否满足宿主 merge 控制面
- 允许使用哪种 merge 方法
- merge 后如何回链 `Work Item -> PR -> merge commit -> main`
- merge 后如何把结果交给 `closeout` 与 `reconciliation`

## 2. 必需输入

进入 `GitHub controlled merge` 前，至少应能读取：

- `merge gate` 已通过
- 可选 retained `pr-gate` / `merge-gate` result locator
- 当前 `Work Item` 与 PR 绑定
- 当前 PR 的 `head_sha`
- required checks / branch protection / mergeability
- 允许的 merge method
- 目标基线分支

## 3. GitHub strong governance 默认值

GitHub profile 的 strong governance 默认要求：

- 禁止直推主干
- 必须通过 PR 合入
- PR 必须绑定单一当前 `Work Item`
- required checks 必须全部通过
- merge 前不得处于 draft
- 默认 merge method 为 `squash`
- merge 后必须能读取 merge commit

若仓库采用非默认 merge method，必须在 profile 中显式声明，不能靠口头默认值。

## 4. 绑定链

`GitHub controlled merge` 必须能稳定证明：

- `Work Item -> branch`
- `Work Item -> PR`
- `PR -> reviewed head`
- `PR -> merge commit`
- `merge commit -> target branch`

若其中任一关系缺失或冲突，必须返回 `binding_failure` 或 `host_signal_drift`。

## 5. merge 前阻断

以下情况至少要直接阻断：

- `merge gate` 未通过
- implementation review 或 `spec_review` 已 stale
- PR `head_sha` 与受审 `head_sha` 不一致
- required checks 未全绿
- merge method 与当前 profile 不一致
- branch protection 仍禁止当前 merge 行为
- host mergeability 为 `DIRTY` 或 `DRAFT`

## 6. retained result 与 drift-only 消费

`DIRTY` 与 `DRAFT` mergeability 是 hard-block host gate failure。GitHub `BLOCKED` 是粗粒度 host policy signal，不自动等价于 Loom semantic readiness 失败；当 authored review approval、`loom-pr-merge-gate`、required checks、PR head binding 与 branch protection / ruleset readback 均通过时，`GitHub controlled merge` 可以把它作为 drift-only evidence 继续委托 `gh pr merge`。

`GitHub controlled merge` 可以消费 fresh retained `pr-gate` / `merge-gate` result locator，但只把它们当作前序 gate result。retained `pr-gate` 必须是 `loom-pr-merge-gate/v1`、`result == pass`，并且 Work Item、PR number、PR head、authored review approval 与 validation summary 仍绑定当前 PR。retained `merge-gate` 必须来自 `flow merge-ready` 或 `checkpoint merge`，且 merge checkpoint 为 pass。

消费 retained result 后仍必须重新确认 current PR head、required checks、branch protection / ruleset、mergeability 与 merge method，并输出 drift-only readback。retained result 不能替代 host enforcement readback，也不能让 raw review / shadow evidence 成为 approval truth。

## 7. merge 后交接

merge 成功后，`GitHub controlled merge` 必须输出最小交接 basis 给 `closeout`：

- 当前 `Work Item`
- PR 编号与 URL
- merged `head_sha`
- merge commit SHA
- 目标主干分支
- merge 时间

`closeout` 与 `reconciliation` 只消费这组 basis，不重新发明另一套 merge 证明方式。

## 8. merge signal drift

若 merge 后出现以下冲突，应归类为 `merge_signal_drift`：

- PR 已 merged，但 merge commit 无法定位
- merge commit 已进入主干，但 issue / project 仍显示未吸收
- merge method 与 profile 声明不一致
- 宿主返回的 mergeability、checks、branch protection 结论互相冲突

## 9. 非目标

- 不在 Loom 文档内冻结 GitHub UI 操作步骤
- 不接管宿主 branch protection 的底层实现
- 不把 `GitHub controlled merge` 简化成“PR 绿了就能合”

## 9. Complex-existing wrapper consumption

成熟既有仓库可以保留 repo-owned merge wrapper，但 wrapper 必须降级为 host-action adapter。

稳定输出为 `loom-controlled-merge-consumption/v1`：

- `source_authority` 固定指向 Loom merge-ready result
- `wrapper_role` 固定为 `host_action_adapter`
- 必须校验 PR/head/base 未漂移
- 必须保留 required checks snapshot、review/spec record locators、retained host signal snapshot、merge commit 与 closeout basis

wrapper 不得继续自行聚合最终 merge readiness。Loom merge-ready allow result 缺失、stale、malformed，或 required checks readback 漂移时必须 fail closed。
