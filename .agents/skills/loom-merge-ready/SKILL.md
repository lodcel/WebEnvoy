---
name: loom-merge-ready
description: 仅在用户显式要求 Loom merge-ready，或当前事项已有 Loom-admitted Work Item/review record 时使用；不要用于 WebEnvoy controlled merge、guardian merge gate 或普通 PR merge readiness。
---

# Loom Merge Ready

这个 skill 承接 merge-ready 场景，也就是 gate chain 里的 `merge gate` 汇总层。

优先入口：

- `python3 .agents/skills/loom-merge-ready/scripts/loom-merge-ready.py flow merge-ready --target <repo> [--item <id>]`

执行要求：

- 固定按 `runtime-state -> fact-chain -> state-check -> runtime-evidence -> checkpoint build -> checkpoint merge` 编排
- 只输出进入 `GitHub controlled merge` 前的统一放行摘要，不替代宿主平台 merge 动作
- PR 合并前的宿主硬门禁由 `pr-gate check` 和 `controlled-merge check|merge` 承接；它们只能消费 authored Loom review record，不能把 raw review/shadow evidence 当作 approval
- 不新建 authored 真相源，也不直接执行平台合并

输入信号与输出合同见：

- [references/input-signals.md](./references/input-signals.md)
- [references/output-contract.md](./references/output-contract.md)
- [../shared/references/harness/pr-merge-gate.md](.loom-runtime/shared/references/harness/pr-merge-gate.md)
