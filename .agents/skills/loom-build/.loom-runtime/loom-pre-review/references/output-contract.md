# Loom Pre Review Output Contract

输出固定为统一 pre-review 摘要 JSON，至少需要给出：

- `item`
  - 当前事项编号、目标、范围、执行路径
- `result`
  - `pass`、`block` 或 `fallback`
- `summary`
  - 当前是否可进入 review 的单句结论
- `missing_inputs`
  - 当前阻断需要补齐的信息；无阻断时为空数组
- `fallback_to`
  - 若当前不能继续进入 review，应回退到哪个 checkpoint；无回退时为 `null`
- `runtime_state`
  - 当前 Loom 入口自己的 scene / carrier 判定，以及 fail-closed 原因
- `steps`
  - 固定按 `runtime-state -> fact-chain -> state-check -> runtime-evidence -> checkpoint-admission -> workspace-locate` 顺序列出

这个 skill 不产生 reviewer 结论；它只提供进入 review 前的统一机械判断。
