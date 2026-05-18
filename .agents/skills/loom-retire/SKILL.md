---
name: loom-retire
description: 仅在用户显式要求 Loom retire，或当前事项已有 Loom-admitted workspace/recovery entry 时使用；不要用于普通 WebEnvoy worktree 清理、PR closeout 或 merge 收口。
---

# Loom Retire

这个 skill 承接 cleanup / retire 场景。

优先入口：

- `python3 .agents/skills/loom-retire/scripts/loom-retire.py purity-check --target <repo> [--item <id>]`
- `python3 .agents/skills/loom-retire/scripts/loom-retire.py workspace cleanup --target <repo> --item <id>`
- `python3 .agents/skills/loom-retire/scripts/loom-retire.py workspace retire --target <repo> --item <id>`

执行要求：

- 默认先解释 retire 前置条件，再按 `purity-check -> workspace cleanup -> workspace retire` 顺序执行
- 若当前事项刚完成 host merge 后 closeout，先确认 `reconciliation audit|sync` 与 `closeout check|sync` 已消费完主干 / issue / PR / project 事实，再退休现场
- 不自动丢弃用户改动，不默认删除现场目录
- 退休完成后，以 recovery 主入口的 `current_checkpoint: retired` 作为终态依据

输入信号与输出合同见：

- [references/input-signals.md](./references/input-signals.md)
- [references/output-contract.md](./references/output-contract.md)
