# Loom Adopt Output Contract

`loom-adopt` 不定义新的输出真相。

它必须直接复用：

- [../../loom-init/references/output-contract.md](plugins/loom/skills/loom-adopt/.loom-runtime/loom-init/references/output-contract.md)

对场景入口本身，最少还要让执行者能直接读出：

- `read_summary`
  - 已读取的根规则、验证入口、治理载体、companion / interop 现状与缺口
- `decision_prompt`
  - repo-specific 判断所需字段、source locator、writeback target 与 verification command
- 当前初始化场景判断
- `decision_reason`
  - 为什么选择当前 adoption path，以及哪些路径被延后
- 本轮启用能力
- 当前暂不启用能力与升级触发条件
- `write_plan`
  - dry-run / write 判定、write targets、intentionally absent targets、`.gitignore` repair policy 与 ownership
- `generated_companion_boundary`
  - 生成或更新的 `repo companion` locator；不得承载运行态真相
- `generated_interop_boundary`
  - 生成或更新的 `repo interop` locator；不得承载 host action result 的 authored truth
- 首批工件与首批事项
- 事实链入口
- 验证入口
- `verify_closure`
  - `verify` 与 `fact-chain` 是否能复读落盘结果，稳定 `.loom` carriers 是否未被 blanket ignore 隐藏，缺口是什么
- `resume_guidance`
  - adoption 后继续执行的入口、下一步或回退 checkpoint
- 是否已经实际落盘
