# Loom Build Output Contract

输出固定为 build readiness JSON，至少需要给出：

- `item`
  - 当前事项编号、目标、范围、执行路径
- `result`
  - `pass` 或 `block`
- `summary`
  - 当前 build evidence 是否可进入 pre-review / review
- `missing_inputs`
  - 阻断 readiness 的缺口；无阻断时为空数组
- `fallback_to`
  - 阻断时固定回退到 `build`
- `runtime_state`
  - 当前 Loom 入口自己的 scene / carrier 判定
- `state_check`
  - 当前事项状态检查结果
- `runtime_evidence`
  - runtime evidence read surface
- `build_execution`
  - `schema_version: loom-build-execution/v1`
  - `required_inputs`
  - `ownership_contract`
  - `delegation_evidence`
  - `integration_evidence`
  - `ownership_conflicts`
  - `repeated_blocker_signal`
- `steps`
  - 固定按 `runtime-state -> fact-chain -> state-check -> runtime-evidence -> checkpoint-admission -> workspace-locate -> build-execution` 顺序列出

`loom-build` 不直接写 review 或 merge-ready records。它只证明 build/readiness evidence 是否已进入既有 Loom carriers。
