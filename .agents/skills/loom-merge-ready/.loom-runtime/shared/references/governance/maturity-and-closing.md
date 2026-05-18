# Maturity And Closing

本文件定义 Loom 治理内核中的稳定成熟度与关闭语义。

本文件当前承接：

- `EXT-0026`

## 1. 文档定位

`governance/maturity-and-closing.md` 负责定义：

- 事项从说明到收口的最小阶段
- 每个阶段的语义边界
- 事项何时可以关闭
- `maturity upgrade` 的纪律

稳定状态名与转移规则见 [state-machine.md](./state-machine.md)。
issue 类型、激活规则与 `absorbed` 的消费边界见 [issue-model.md](./issue-model.md)。

## 2. 成熟度先于关闭

关闭语义必须与事项成熟度一致，不得提前制造“已完成”状态。
任何状态推进都必须沿同一条 `maturity upgrade` 主链发生。

说明完成、实现完成、合并就绪、主干收口是不同语义。

## 3. 最小成熟度阶段

稳定状态名、进入条件、允许转移与回退路径，全部唯一落在 [state-machine.md](./state-machine.md)。

本文件不再并行重述四阶段名称，只保留总原则：

- 不得跳过“说明已清楚 -> 实现进行中 -> 合并就绪 -> 已进入主干并收口”的语义顺序
- 项目可以细化显示名，但不得破坏 [state-machine.md](./state-machine.md) 的稳定状态机语义
- 项目可以加辅助标签，但不得把 `spec_approved`、`in_review`、`merge gate passed` 之类局部 gate 结论伪装成新的成熟度主状态

## 4. 关闭一致性条件

关闭条件的稳定定义也唯一落在 [state-machine.md](./state-machine.md) 中的 `closed_out` 语义。

这里仅补充两个边界：

- 当前执行侧入口见 [../harness/closeout-gate.md](../harness/closeout-gate.md)
- GitHub 与仓内真相如何同步，见 [truth-and-sync-boundary.md](./truth-and-sync-boundary.md)
- parent / child issue 如何消费 closeout，见 [issue-model.md](./issue-model.md)

## 5. 规约完成与实现完成的分离语义

默认语义边界：

- 规约通过
  - 表示“可进入实现”，不表示“实现完成”
- PR 已开
  - 表示“实现已开始”，不表示“事项完成”
- merge-ready
  - 表示“可进入主干”，不表示“已收口”
- 进入主干并收口
  - 才表示事项完成
- `spec gate` / `review gate`
  - 表示局部放行结论，不等于成熟度主状态升级

## 6. 关闭反模式

禁止以下关闭方式：

- 把证据冻结写成实现完成
- 把规约通过写成事项完成
- 在未进入主干时宣称已收口
- 用局部结论替代整体完成判断

## 7. 一句话结论

成熟度模型的目标是让 `maturity upgrade` 可验证，而不是让关闭动作更快发生。
