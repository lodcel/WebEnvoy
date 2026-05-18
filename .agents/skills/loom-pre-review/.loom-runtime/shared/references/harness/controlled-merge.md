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

## 6. merge 后交接

merge 成功后，`GitHub controlled merge` 必须输出最小交接 basis 给 `closeout`：

- 当前 `Work Item`
- PR 编号与 URL
- merged `head_sha`
- merge commit SHA
- 目标主干分支
- merge 时间

`closeout` 与 `reconciliation` 只消费这组 basis，不重新发明另一套 merge 证明方式。

## 7. merge signal drift

若 merge 后出现以下冲突，应归类为 `merge_signal_drift`：

- PR 已 merged，但 merge commit 无法定位
- merge commit 已进入主干，但 issue / project 仍显示未吸收
- merge method 与 profile 声明不一致
- 宿主返回的 mergeability、checks、branch protection 结论互相冲突

## 8. 非目标

- 不在 Loom 文档内冻结 GitHub UI 操作步骤
- 不接管宿主 branch protection 的底层实现
- 不把 `GitHub controlled merge` 简化成“PR 绿了就能合”
