---
name: loom-handoff
description: 负责交接当前事项。Use when Codex needs to prepare a handoff package before ending the current execution round.
---

# Loom Handoff

这个 skill 承接 handoff 场景。

优先入口：

- `python3 .agents/skills/loom-handoff/scripts/loom-handoff.py flow handoff --target <repo> [--item <id>]`

执行要求：

- 只读取现有事实链、状态检查和现场定位结果
- 只输出 handoff 所需的最小回写清单与载体定位
- 不直接写 recovery entry、status control plane 或其他 authored 载体

输入信号与输出合同见：

- [references/input-signals.md](./references/input-signals.md)
- [references/output-contract.md](./references/output-contract.md)
