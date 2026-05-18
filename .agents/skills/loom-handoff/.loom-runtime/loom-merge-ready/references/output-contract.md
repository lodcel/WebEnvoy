# Loom Merge Ready Output Contract

输出固定为 merge-ready 摘要 JSON，至少需要给出：

- `item`
  - 当前事项编号、目标、范围、执行路径
- `result`
  - `pass`、`block` 或 `fallback`
- `summary`
  - 对进入 `GitHub controlled merge` 前统一放行状态的单句结论
- `missing_inputs`
  - 当前仍阻断放行的缺口列表
- `fallback_to`
  - 若当前必须回退，应回退到的 gate；无回退时为 `null`
- `runtime_state`
  - 当前 Loom 入口自己的 scene / carrier 判定，以及 fail-closed 原因
- `state_check`
  - `state-check` 的结果、摘要、阻断项与检查分项
- `runtime_evidence`
  - 5 项运行时证据对象，保留 `present` 与 `not_applicable`
- `execution_ledger`
  - recovery-bound ledger 的 completeness 与 freshness；缺失、stale、第二 locator 或 forbidden authored recovery fields 必须阻断
- `build_checkpoint`
  - `checkpoint build` 的结果、摘要、阻断项与回退去向
- `merge_checkpoint`
  - `checkpoint merge` 的结果、摘要、阻断项、回退去向，以及可读的 PR 模板检查结果
- `gate_chain`
  - `spec_gate`、`build_gate`、`review_gate`、`merge_gate` 的当前可消费状态
- `github_controlled_merge`
  - required checks、branch protection、merge method 与 host merge 前置状态
- `current_checkpoint`
  - 当前 recovery checkpoint 的原始值与归一化值
- `current_lane`
  - 当前 lane 定位
- `latest_validation_summary`
  - 最近可用验证摘要
- `steps`
  - 固定按 `runtime-state -> fact-chain -> state-check -> runtime-evidence -> checkpoint-build -> checkpoint-merge` 顺序列出

这个 skill 只给出 `merge gate` 摘要，不替代宿主平台 merge，也不直接执行平台动作。
