# Recovery Model

本文件定义 Loom 当前最小恢复模型。

本文件当前承接：

- `EXT-0003`
- `EXT-0013`
- `EXT-0038` 的每轮回写部分

完整执行顺序见 [execution-chain.md](./execution-chain.md)。

## 1. 能力定位

恢复模型用于让长任务在多轮执行后仍有唯一可读主入口。

它负责：

- `checkpoint`
- `resume`
- `handoff`
- 每轮结束后的状态回写

字段归属见 [fact-chain-contract.md](./fact-chain-contract.md)。

## 2. 唯一恢复主入口

每个正式事项必须有唯一恢复主入口。

默认要求：

- 继续执行前，先回到该入口
- 其他工件只能补充，不得并行充当主入口
- 恢复主入口必须与当前事项直接绑定
- merge checkpoint 消费最近恢复事实，但不替代该入口

## 3. 最小恢复事实集

恢复主入口至少应能回答：

- 当前事项是什么
- 当前停点在哪里
- 下一步是什么
- 当前 checkpoint 阶段是什么
- 已验证了什么
- 当前阻断项是什么
- 最近一次稳定提交点或等价回退边界是什么
- 当前 lane 是什么
- execution ledger 等价载体如何绑定到本恢复入口

`handoff` 还应额外指明：

- 接手所需上下文入口
- 当前主要风险或待确认点

## 4. 每轮回写最小事实集

正式执行轮次结束后，默认回写：

- 当前 `progress` / `checkpoint`
- 本轮完成的单一推进单元
- 新的下一步
- 本轮新增验证事实或验证摘要
- 仍未解除的阻断项
- 在需要时形成明确提交点或等价可恢复边界
- 更新或确认 execution ledger 的 locator / evidence freshness

当前稳定回写入口为：

- `python3 tools/loom_flow.py recovery writeback --target <repo> [--item <id>] ...`

边界固定如下：

- `resume` / `handoff` 只读，不得隐式写 recovery authored 字段
- `recovery writeback` 只写恢复主入口，再同步重渲染状态面
- 状态面不接受独立 authored 修改

## 5. Execution ledger 等价载体

Loom v0.7 把 execution ledger 定义为恢复主入口内的 locator / evidence 读面，或等价绑定到恢复主入口的 carrier。它不是第二份恢复状态。

最小字段为：

- `ledger_binding`
  - 必须指向 `recovery_entry` 或当前恢复主入口 locator
- `plan_locator`
  - 指向 plan、执行计划或 `not_applicable`
- `acceptance_locator`
  - 指向 spec、acceptance criteria、checkpoint 验收记录或 `not_applicable`
- `validation_evidence_locator`
  - 指向验证命令、验证记录、review evidence 或 `not_applicable`
- `handoff_notes_locator`
  - 指向 handoff notes 或 `not_applicable`
- `evidence_freshness`
  - `current` 或 `not_applicable`

execution ledger 只允许映射 plan、acceptance、validation evidence 与 handoff notes 的 locator / evidence。它不得 authored `next_step`、`blockers`、`latest_validation_summary`，也不得覆盖 recovery 主入口中的任何动态事实。

`resume`、`handoff` 与 `merge-ready` 必须消费同一个 fact-chain / recovery contract 暴露的 ledger completeness 与 freshness。缺少 ledger、ledger stale、ledger 绑定到第二 locator，或 ledger authored forbidden recovery fields 时，入口必须 fail closed 并回退到 admission 修复。

## 6. `checkpoint-lite` 与标准恢复形态

Loom 默认承认两种恢复形态：

- `checkpoint-lite`
  - 停点、下一步、阻断项寄存在 issue / PR 等现有载体
  - 仅适用于低复杂度、低恢复成本、且已有单一稳定宿主载体的场景
  - 若作为 ledger-equivalent carrier，仍必须声明唯一动态事实承载面，且不得同时维护第二份 ledger
- 标准恢复形态
  - 使用明确恢复工件承接 `checkpoint`、`resume`、`handoff`
  - 必须有唯一恢复主入口

一旦出现以下任一信号，应从 `checkpoint-lite` 升级到标准恢复形态：

- 事项经常跨多轮推进
- 中断恢复成本明显升高
- 出现多个入口并行记录
- merge checkpoint 已需要稳定消费风险、验证摘要与回退边界
- 不存在单一稳定宿主载体，或当前仓库同时存在多个运行 / 状态入口

## 7. 边界约束

- 不得只依赖聊天记录、分支名或个人记忆恢复
- 不得在多个文档中并行维护“下一步”
- 恢复主入口是动态执行真相的唯一主入口；状态面与 merge checkpoint 只允许派生消费
- `exec-plan` 或等价恢复工件只承接执行与恢复，不替代正式需求真相
- 本文件不重复定义回写后如何进入验证汇总与放行；该顺序由 [execution-chain.md](./execution-chain.md) 与 [merge-checkpoint.md](./merge-checkpoint.md) 承接
