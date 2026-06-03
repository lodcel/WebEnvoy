# State Machine

本文件定义 Loom `v0.3.0` 当前稳定的事项状态机与关闭语义。

本文件当前承接：

- `#157`

## 1. 文档定位

本文件只回答三件事：

- Loom 事项有哪些稳定成熟度状态
- 状态之间如何作为 `maturity upgrade` 推进、阻断与回退
- 什么条件下才允许关闭

字段载体与同步边界由 [truth-and-sync-boundary.md](./truth-and-sync-boundary.md) 承接。
执行侧 closeout 入口由 [../harness/closeout-gate.md](../harness/closeout-gate.md) 承接。
issue 类型与激活语义由 [issue-model.md](./issue-model.md) 承接。

## 2. 稳定状态

Loom 当前固定四个成熟度状态：

- `clarified`
  - 说明已清楚，可进入正式执行
- `implementing`
  - 实现进行中，正在持续产生执行证据
- `merge_ready`
  - 已达到进入 host merge 前的质量线
- `closed_out`
  - 结果已进入主干，且控制面与仓内状态已收口

这四个状态是语义状态，不要求宿主平台直接使用同名字段。
任何更细的项目显示名，都只能映射到这条 `maturity upgrade` 主链，不得并行再造另一条成熟度状态机。

## 3. 状态进入条件

### 3.1 `clarified`

至少同时满足：

- 目标、范围与关闭条件已明确
- 已有可消费的正式执行入口
- 准入前置条件与验证方式已写清

默认证据：

- `work item`
- 必要时附带 `spec.md` / `plan.md`

### 3.2 `implementing`

至少同时满足：

- 已从 `clarified` 进入正式执行
- 已存在恢复主入口或等价动态执行真相
- 当前轮次能够回写停点、下一步、阻断项与最近验证摘要

默认证据：

- `work item`
- recovery 主入口

### 3.3 `merge_ready`

至少同时满足：

- build 级结果已达线
- 正式 review 结论可消费
- merge gate 已能回答“可进入 GitHub controlled merge”

默认证据：

- review record
- merge-ready 摘要或等价执行输出
- merge gate 结果

### 3.4 `closed_out`

至少同时满足：

- 必要实现已进入主干
- closeout gate 已通过
- issue / project / PR / 主干状态已同步到一致结论

默认证据：

- 主干包含结果
- closeout gate 结果
- GitHub 控制面同步结果

## 4. 转移规则

允许的主路径转移只有：

- `clarified -> implementing`
- `implementing -> merge_ready`
- `merge_ready -> closed_out`

允许的回退只有：

- `implementing -> clarified`
  - 当范围、关闭条件或准入条件被推翻时
- `merge_ready -> implementing`
  - 当 review、验证或 checkpoint 结论要求回退时
- `merge_ready -> clarified`
  - 当晚暴露的问题已经回到 admission / 说明层，例如共享契约、运行模型或事项边界本身失真

不允许：

- 从 `clarified` 直接跳到 `merge_ready`
- 从 `implementing` 直接宣称 `closed_out`
- 在未进入主干前宣称 `closed_out`

## 5. 阻断与回退不是独立成熟度状态

以下语义会影响状态推进，但不是新的成熟度状态：

- `block`
  - 当前状态不能继续向后推进
- `fallback`
  - 必须退回前一成熟度状态或前一执行链路
- `retired`
  - 属于现场或恢复入口的终态，不等于事项已 `closed_out`
- `absorbed`
  - 属于 closeout 可消费结论，不等于事项成熟度状态

换句话说：

- `block` / `fallback` 是 `maturity upgrade` 的转移结果
- `retired` 是执行现场状态
- `absorbed` 是 closeout 可消费语义
- 事项成熟度仍只落在四个稳定状态中

## 6. 关闭语义

只有 `closed_out` 才表示事项可以关闭。

以下结论都不等于事项完成：

- `spec` 已通过
- PR 已创建
- `merge_ready`
- merge gate 已允许放行

关闭动作必须以 `closed_out` 为前提，而不是以“代码改完了”或“PR 绿了”为前提。

## 7. 与宿主字段的关系

宿主平台可以使用不同命名，但不得破坏以下语义映射：

- issue / project 的进行中状态
  - 不得冒充 `merge_ready` 或 `closed_out`
- PR open
  - 只表示实现载体存在，不表示已可关闭
- PR merged
  - 只表示结果进入主干，不自动表示已收口
- issue closed
  - 只能映射到 `closed_out`

## 8. 一句话结论

Loom 的状态机目标不是增加更多名词，而是让 `maturity upgrade` 的前进、回退与完成语义稳定可消费。
