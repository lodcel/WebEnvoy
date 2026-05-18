# Truth And Sync Boundary

本文件定义 Loom `v0.3.0` 当前稳定的真相分层、派生面与同步边界。

本文件当前承接：

- `#158`

## 1. 文档定位

本文件回答：

- 哪些对象承接 authored 真相
- 哪些对象只能承接 host control truth
- 哪些对象只是派生读面或运行证据
- Loom 如何同步，而不是复制第二套真相

字段级事实链仍以 [../harness/fact-chain-contract.md](../harness/fact-chain-contract.md) 为准。

## 2. 四层真相模型

Loom 当前固定四层：

- repo execution truth
  - 仓内 authored 执行真相
- host control truth
  - 宿主平台的控制面真相
- derived read surfaces
  - 从前两层派生的读面
- runtime / review evidence
  - 被消费的运行或审查证据

## 3. Repo Execution Truth

以下对象进入 repo execution truth：

- `work item`
  - 静态执行真相
- recovery 主入口
  - 动态执行真相
- review record
  - 正式 review 真相

这些对象的 authored 字段只能在仓内主载体中维护。

它们回答的问题分别是：

- `work item`
  - 做什么、范围是什么、通过什么入口推进
- recovery 主入口
  - 现在停在哪、下一步是什么、有什么阻断
- review record
  - 正式 review 给出的结论、权威 findings、rebuttal 与 disposition 是什么

## 4. Host Control Truth

以下对象进入 host control truth：

- issue
  - 当前治理事项在宿主平台中的控制面状态
- project item
  - 计划、优先级、状态展示等控制面字段
- PR
  - 实现载体与 merge 相关控制面
- branch protection / required checks / ruleset
  - host merge 前硬门禁

它们回答的问题是：

- 这项工作在 GitHub 上处于什么控制面状态
- 当前实现载体是否存在、是否可被合并
- host 平台是否允许进入下一步

它们不是 repo execution truth 的替代品。

## 5. Derived Read Surfaces

以下对象只允许派生读取：

- status control plane
- merge-ready 摘要
- closeout 摘要
- `init-result` 中的统一读取入口

这些对象可以汇总信息，但不得反向覆盖 authored 真相。

## 6. Runtime / Review Evidence

以下对象进入证据层：

- CI run
- guardian / reviewer 输出
- 日志、trace、诊断信息
- PR 评论中的临时讨论

这些对象可以被 Loom 消费，但默认不是长期 authored 真相。

若其中某项需要成为长期真相，必须回写到稳定主载体：

- review 结论
  - 回写到 review record
- review findings / disposition
  - 仍回写到同一 review record，不新增第二 authored truth object 或状态机
- 动态停点与下一步
  - 回写到 recovery 主入口

## 7. 同步的定义

Loom 所说的 `sync`，不是把所有信息复制两份。

Loom 当前只允许以下同步：

- repo execution truth -> host control truth
  - 例如 closeout 时把应关闭的 issue / project 状态推进到一致结果
- repo execution truth -> derived read surfaces
- 例如从 `Work Item` 与 recovery 主入口重渲染 `status control plane`、resume 摘要或其他统一读取面
- host control truth -> derived read surfaces
  - 例如把 PR / checks 状态汇总到 merge-ready 或 closeout 读面

不允许以下同步：

- 用 issue body 反向覆盖 `work item`
- 用 PR body 反向覆盖 review record
- 用 project status 反向覆盖 recovery 主入口

## 8. 冲突处理

当 repo execution truth 与 host control truth 冲突时：

- 先保留两边原值
- 明确报出 drift
- 通过专门 sync 入口修复

当前执行面上：

- drift 审计由 `reconciliation audit` 承接
- control-plane 对齐由后续专门 sync 入口承接

不允许：

- 静默选择其中一边
- 在派生读面里偷偷掩盖冲突

## 9. 最小责任矩阵

| 对象 | 层级 | 默认职责 |
| --- | --- | --- |
| `work item` | repo execution truth | 静态执行真相 |
| recovery 主入口 | repo execution truth | 动态执行真相 |
| review record | repo execution truth | 正式 review 真相 |
| issue | host control truth | 治理事项控制面 |
| project item | host control truth | 计划与状态展示控制面 |
| PR | host control truth | 实现载体与 merge 控制面 |
| status control plane | derived read surface | 执行摘要读面 |
| merge-ready 摘要 | derived read surface | 放行前汇总读面 |
| closeout 摘要 | derived read surface | 收口前汇总读面 |
| CI / guardian / reviewer 输出 | runtime / review evidence | 可消费证据 |

## 10. 一句话结论

Loom 的同步目标是让不同层的真相保持一致，不是把同一个 authored 事实复制到所有载体里。
