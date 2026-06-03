---
name: loom-retire
description: 负责清理并退休当前事项现场。Use when Codex needs to clean up Loom-owned residue and retire a workspace without discarding user changes.
---

# Loom Retire

这个 skill 承接 cleanup / retire 场景。

优先入口：

- `python3 scripts/loom-retire.py purity-check --target <repo> [--item <id>]`
- `python3 scripts/loom-retire.py workspace cleanup --target <repo> --item <id>`
- `python3 scripts/loom-retire.py workspace retire --target <repo> --item <id>`

执行要求：

- 默认先解释 retire 前置条件，再按 `purity-check -> workspace cleanup -> workspace retire` 顺序执行
- 若当前事项刚完成 host merge 后 closeout，先确认 `reconciliation audit|sync` 与 `closeout check|sync` 已消费完主干 / issue / PR / project 事实，再退休现场
- 不自动丢弃用户改动，不默认删除现场目录
- `workspace retire` 是 post-merge local cleanup / runtime evidence，不写 `.loom/progress/**` 或 `.loom/status/current.md` 这类版本化 carrier
- 版本化 closeout truth 必须在 merge 前由 closeout / reconciliation 路径形成，并在 merge 后由 closeout check / sync 消费；不能由本地 retire 追加生成

输入信号与输出合同见：

- [references/input-signals.md](./references/input-signals.md)
- [references/output-contract.md](./references/output-contract.md)
