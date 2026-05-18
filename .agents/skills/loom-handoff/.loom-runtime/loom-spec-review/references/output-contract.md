# Loom Spec Review Output Contract

输出固定为 spec review 摘要 JSON，至少需要给出：

- `item`
  - 当前事项编号、目标、范围、执行路径
- `result`
  - `pass`、`block` 或 `fallback`
- `summary`
  - formal spec 是否已通过 spec review 的单句结论
- `missing_inputs`
  - 当前阻断 `spec gate` 的缺口列表
- `fallback_to`
  - 若当前不能继续，应回退到哪个 gate；无回退时为 `null`
- `runtime_state`
  - 当前 Loom 入口自己的 scene / carrier 判定，以及 fail-closed 原因
- `state_check`
  - `state-check` 的结果、摘要、阻断项与检查分项
- `runtime_evidence`
  - 5 项运行时证据对象，保留 `present` 与 `not_applicable`
- `build_checkpoint`
  - `checkpoint build` 的结果、摘要、阻断项与回退去向
- `gate_chain`
  - `spec_gate`、`build_gate` 的当前可消费状态
- `spec_review`
  - formal spec 路径、spec review record、head 绑定、stale 语义与当前 gate 结论
- `current_checkpoint`
  - 当前 recovery checkpoint 的原始值与归一化值
- `steps`
  - 固定按 `runtime-state -> fact-chain -> state-check -> runtime-evidence -> checkpoint-build -> spec-review-entry` 顺序列出

这个 skill 只给出 `spec gate`，不替代 implementation review，也不替代 merge-ready。
