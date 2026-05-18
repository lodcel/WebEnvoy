# Merge Checkpoint

本文件定义 Loom 当前 `merge gate` 的执行侧合同。

本文件当前承接：

- `#27` 的稳定落点
- harness 侧放行承接语义

## 1. 能力定位

`merge gate` 是执行侧的最终放行层。

它只回答三类问题：

- 当前 head 是否仍在已批准范围内
- 当前执行材料是否已经完整到足以进入主干
- 当前自动检查、验证摘要、review 结论与宿主 merge 控制面是否共同支持 `GitHub controlled merge`
- 当前 behavior evidence / test evidence 是否仍是 fresh verification evidence

它不承担第一次高质量语义判断，也不替代 governance 的前置准入与 reviewer 的审查职责。
字段归属以 [fact-chain-contract.md](./fact-chain-contract.md) 为准。

## 2. 放行前必读输入

进入 `merge gate` 前，至少应能读取以下事实：

- 当前变更范围与目标
- 关联事项、规格或等价正式工件
- 自动检查结果
- 正式 review record
- 最近验证摘要
- behavior evidence
- test evidence
- fresh verification evidence 的 `head_sha` / 范围 / 恢复摘要绑定
- 运行时证据或 `not_applicable` 声明
- `budget_risk` 摘要
- 风险与回滚边界
- 未决阻断项
- 当前 head 是否仍在批准范围内
- GitHub required checks / branch protection / ruleset 的最小读面

这些事实通常分别来自：

- [work-item-contract.md](./work-item-contract.md)
- [recovery-model.md](./recovery-model.md)
- [status-surface.md](./status-surface.md)
- [review-execution.md](./review-execution.md)
- [automation-frontload.md](./automation-frontload.md)
- [host-action-contract.md](./host-action-contract.md)

其中：

- 范围、目标、执行路径、验证入口定位
  - 只能从 `Work Item` 读取
- 当前 checkpoint、停点、下一步、阻断项、最近验证摘要、回退边界
  - 只能从恢复主入口读取
- 正式 review 结论
  - 只能从 `work item.review_entry` 指向的 review record 读取
  - 其中 `findings` 是 review/disposition 的权威字段；`blocking_issues` / `follow_ups` 只作兼容投影
  - 即使 formal review 由默认 engine 产出，`merge gate` 也只消费回写后的 review record，不直接读取 engine raw output 或 evidence 文件
- behavior evidence / test evidence
  - 只能从 spec、plan、验证摘要、review record 与状态控制面的派生读面消费
  - 必须绑定当前 `HEAD`、当前范围与当前恢复摘要
  - 未整合的 subagent 输出不得作为 fresh verification evidence
- `status control plane`
  - 只允许作为派生汇总读面，不得替代上述主真相

## 3. 唯一允许结果

`merge gate` 只允许输出以下三类结果：

- `允许放行`
  - 执行材料完整，自动检查与验证结果足以承接进入宿主 merge 控制面
- `阻断待补`
  - 仍有未补齐材料，但不必回退到更早 gate 重做方向判断
- `退回前序 gate`
  - 当前 head 已超出批准范围，或关键事实缺失到必须回退到前序 gate 重新收口

不允许输出模糊结果，例如“基本可以”“先合再说”“口头同意”。

## 4. 回退承接

当 `merge gate` 给出非放行结果时，回退方向必须清晰：

- 缺自动检查、结构检查或基础状态一致性
  - 回到 [automation-frontload.md](./automation-frontload.md) 对应检查面
- 缺验证摘要、运行证据或 `not_applicable` 声明
  - 回到 [status-surface.md](./status-surface.md) 与实际验证入口
- 缺 behavior evidence、test evidence 或 fresh verification evidence
  - 回到 spec / plan / 验证入口补齐证据或声明 `not_applicable`
- 缺 formal review、review stale 或 reviewer 明确要求回退
  - 回到 [review-execution.md](./review-execution.md) 或 `build gate`
  - 若 review 之后只提交了 `review_entry`、recovery 主入口或状态面这类 Loom carrier 更新，不应误判成 stale
- review disposition 未处理、deferred 缺少后续承接，或 repeated blocker 尚未 root-cause 处理
  - 回到 review record / 前序 gate / ownership 分配修正点
- 缺停点、下一步、风险或回滚边界
  - 回到 [recovery-model.md](./recovery-model.md)
- head 已超出批准范围或事项边界失真
  - 退回前序 gate，重新做范围与方向收口
- GitHub controlled merge 的 required checks / protection / ruleset 不满足
  - 回到宿主控制面补齐强制条件；Loom 只阻断，不越权代做 merge

`budget_risk` 只作为 advisory evidence：

- 高风险 budget 可以进入 merge gate 摘要，提醒后续 controlled merge / closeout 消费
- 缺失或 unavailable budget 不得进入 `missing_inputs`
- advisory budget 不得单独把 merge gate 改成 block 或 fallback

## 5. 边界约束

- `merge gate` 消费 reviewer、自动检查和运行证据的结果，不重新发明第二套审查体系
- `merge gate` 只消费单一 review record，不为 findings / disposition 再引入第二 authored artifact
- `merge gate` 不直接消费 Codex output、prompt、logs 或其他 review evidence 文件
- `merge gate` 不把旧验证、未绑定当前 `HEAD` 的测试结果或未整合的 subagent 输出当作 fresh verification evidence
- `merge gate` 只回答“是否可进入 GitHub controlled merge”，进入主干后的 issue / project / main 收口由 [closeout-gate.md](./closeout-gate.md) 承接
- `merge gate` 不负责定义成熟度、关闭语义或事项是否值得做；这些属于 `governance/`
- `merge gate` 不得补读另一份 authored 状态摘要来替代恢复主入口
- 本文件不规定宿主平台的按钮、合并策略或 CI 产品，只定义 Loom 必须承接的最小放行语义
