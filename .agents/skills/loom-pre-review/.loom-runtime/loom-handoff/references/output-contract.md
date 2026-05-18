# Loom Handoff Output Contract

输出固定为 handoff 摘要 JSON，至少需要给出：

- `item`
  - 当前事项编号、目标、范围、执行路径
- `result`
  - `pass` 或 `block`
- `summary`
  - 对当前 handoff 可移交状态的单句结论
- `missing_inputs`
  - 当前仍需补齐的阻断项；无阻断时为空数组
- `fallback_to`
  - 若当前状态不适合直接移交，应回退到哪个 gate；无回退时为 `null`
- `runtime_state`
  - 当前 Loom 入口自己的 scene / carrier 判定，以及 fail-closed 原因
- `workspace`
  - `workspace_entry`、解析后的现场路径、现场是否存在
- `checkpoint`
  - 原始 checkpoint 文本与归一化后的 checkpoint
- `state_check`
  - `state-check` 的结果、摘要、阻断项与检查分项
- `recovery_entry`
  - 当前 recovery entry 的定位字符串
- `status_surface`
  - 当前 `status control plane` 的定位字符串
- `current_stop`
  - 当前执行停点，供交接前回写
- `next_step`
  - 下一个执行动作，供交接前回写
- `blockers`
  - 当前阻断项，供交接前回写
- `latest_validation_summary`
  - 最近验证摘要，供交接前回写
- `execution_ledger`
  - 当前 recovery-bound ledger 的 completeness、freshness、plan / acceptance / validation / handoff locator
  - 若 handoff notes 仍为 `not_applicable`，handoff 输出只能指出需要回写的 locator，不得创建第二份恢复状态
- `lifecycle_expectations`
  - 与 resume / workspace lifecycle 输出同源，说明当前 handoff 只消费 workspace、recovery 与 ledger contract
  - 必须保留 recovery entry，不得另建第二份停点、下一步、阻断项或最近验证摘要
- `fallback_target`
  - 若当前未准备好移交，应优先回退到的目标；无回退时为 `null`
- `writeback_fields`
  - 固定为 `current_stop`、`next_step`、`blockers`、`latest_validation_summary`
- `steps`
  - 固定按 `runtime-state -> fact-chain -> state-check -> workspace-locate` 顺序列出

这个 skill 只生成回写清单和定位，不直接写文件，也不创建新的 authored 真相源。
