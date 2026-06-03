# Host Issue Binding

本文件定义 Loom 当前消费 host issue 与 `Work Item`、宿主 branch、`git worktree`、PR、merge commit 之间绑定关系的最小合同。

host issue 的主定义不在本文件。
本文件只承接 Loom 为了执行、定位、放行与收口而必须消费的绑定事实。

## 1. 能力定位

本文件回答：

- Loom 在执行侧最少需要读取哪些 host 绑定关系
- 哪些绑定关系可用于判断实现是否已被 host merge 吸收
- 单个 host PR 吸收多个 issue 时最少要能表达什么
- 哪些结论仍不能直接等同于 `closed_out`

## 2. 最小绑定对象

当某正式事项进入实现与收口链路时，Loom 只消费以下绑定关系：

- `Work Item -> host issue`
- `Work Item -> host branch`
- `Work Item -> git worktree`
- `Work Item -> host PR`
- `host PR -> merge commit`

这些绑定关系都属于 host control truth 或其派生读取结果。
Loom 可以读取、校验、汇总并据此阻断，但不在仓内 authored 第二套主定义。

## 3. 最小消费规则

Loom 至少消费这些绑定关系用于以下动作：

- `workspace locate` / recovery
  - 判断当前执行现场是否仍服务同一正式事项
- `merge-ready` / closeout check
  - 判断实现载体、合并结果与主干事实是否一致
- cleanup / retire
  - 判断某 host branch 或 `git worktree` 是否仍被正式事项占用

若绑定关系缺失、指向冲突或无法证明当前实现属于同一事项，结果必须返回 `block` 或显式 drift。

## 4. 单 PR 吸收多事项

单个 host PR 可以吸收多个 issue，但前提是这些 issue 的实现缺口确实都被该 PR 对应的 merge 结果覆盖。

Loom 最少需要能机械回答两件事：

- 这个 host PR 吸收了哪些 issue / `Work Item`
- 哪些相关 issue 仍保留独立剩余缺口，不能被一起判定为 `absorbed`

因此：

- PR body、closing rationale、merge commit 或等价宿主证据中，至少要有一处能稳定表达 issue / `Work Item` 与 merged work 的对应关系
- 若同一 PR 同时涉及 parent / child issue，默认只吸收被明确证明已覆盖的 issue，不得把整棵 tree 一并视为已吸收

## 5. `absorbed`

`absorbed` 是 Loom 在 harness 层定义的实现吸收结论。

它只表示：

- 某正式事项对应的实现已经通过 host merge 进入主干
- 这一结论可以被宿主事实证明，而不是凭口头判断

最小证明面至少包括：

- 对应 host PR 已 merged
- 对应 merge commit 可定位
- merge commit 已被目标主干吸收

`absorbed` 不等于：

- `closed_out`
- issue 已关闭
- project 状态已同步完成
- 恢复主入口或现场已清理完毕

在 issue tree 中：

- child issue
  - 可以因自身缺口已被其他 merged work 覆盖而形成 `absorbed`
- parent issue
  - 可以消费 child 的 `absorbed` 结果，但不得仅因某个 child 被吸收就自动视为自身已 `closed_out`

## 6. 边界约束

- 本文件不主定义 host issue 的语义、生命周期或 authored 字段
- 本文件不把 `workspace` 写成 `git worktree`
- 本文件不要求每个宿主都必须暴露同名字段；只要求绑定关系可被稳定证明
- 本文件不接管 branch、PR、`git worktree` 或 merge 的宿主生命周期动作
- `Work Item` 仍是唯一执行入口；host issue 只作为宿主控制面绑定对象被消费
