# Loom Review Output Contract

输出固定为正式 review 摘要 JSON，至少需要给出：

- `item`
  - 当前事项编号、目标、范围、执行路径
- `result`
  - `pass`、`block` 或 `fallback`
- `summary`
  - 当前是否已具备正式 review 条件的单句结论
- `missing_inputs`
  - 当前阻断正式 review 的缺口；无阻断时为空数组
- `fallback_to`
  - 若当前不能继续正式 review，应回退到哪个 gate；无回退时为 `null`
- `runtime_state`
  - 当前 Loom 入口自己的 scene / carrier 判定，以及 fail-closed 原因
- `steps`
  - 固定按 `runtime-state -> fact-chain -> state-check -> runtime-evidence -> checkpoint-build -> review-entry` 顺序列出
- `state_check`
  - 活跃状态、checkpoint 完整性与范围信号
- `runtime_evidence`
  - 当前 review 可读的运行时证据入口
- `build_checkpoint`
  - build checkpoint 的结果、摘要、缺失输入与回退语义
- `gate_chain`
  - `spec_gate`、`build_gate`、`review_gate` 的当前可消费状态
- `review`
  - 唯一 `review_entry` review record 的定位、已记录结论，以及权威 findings / disposition 摘要
- `engine`
  - 默认 reviewer adapter、evidence 路径、运行结果与 fail-closed 原因
- `manual_review`
  - engine block 时如何继续写回同一 `review record`
- `current_checkpoint`
  - 当前 recovery checkpoint 的原始值与归一化值

`review` 段至少应让执行者读出：

- 读取的是哪一个 `review_entry`
- review record 中的 `decision`
- review record 中的权威 `findings`
- 每条 finding 的 `id`、`severity`、`rebuttal` 与 `disposition`
- `blocking_issues` / `follow_ups` 只是兼容字段，而不是第二份审查工件

`engine` 段至少应让执行者读出：

- 当前默认 engine 是什么
- 当前 adapter 标识是什么
- 当前结果是 `pass`、`block` 还是 `not_run`
- 若 fail-closed，稳定 failure reason 是什么
- raw result、normalized findings、prompt 与元数据 evidence 在哪里

`manual_review` 段至少应让执行者读出：

- engine block 时仍应写回哪一个 `review record`
- 推荐沿用哪个 `kind`
- 若已有 normalized findings，应从哪个 `findings_file` 继续
- 最小 `review record` 写回命令骨架是什么

这个 skill 负责正式 review 执行层，不替代 `loom-pre-review` 的机械预检，也不替代 `loom-merge-ready` 的 `merge gate` 聚合放行判断。
