# Host Lifecycle Boundary

本文件定义 Loom 与宿主平台在 `workspace`、branch、PR、git worktree 之间的生命周期边界。

宿主动作入口、结果词表与 `fallback_to` 纪律的统一主落点见 [host-action-contract.md](./host-action-contract.md)。

稳定命名与对象分类见 [../governance/host-object-taxonomy.md](../governance/host-object-taxonomy.md)。
`active issue` 与 branch / `git worktree` / PR / merge commit 的绑定消费见 [host-issue-binding.md](./host-issue-binding.md)。

## 1. 结论

- `workspace`
  - 属于 Loom execution object，进入 Loom 执行层
- branch
  - 属于 host control object，保留给宿主平台
- PR
  - 属于 host control object，保留给宿主平台
- git worktree
  - 属于 host control object，保留给宿主平台

## 2. Loom 承接什么

Loom 固定承接：

- `workspace_entry` 对应的执行现场语义
- 对 `active issue -> branch / git worktree / PR / merge commit` 绑定关系的读取与校验
- recovery 与 checkpoint 对执行现场的绑定
- branch / PR / worktree 是否已经影响执行正确性的边界检查结果
- merge 前对 host merge 的统一放行判断
- host merge 后实现是否已被 `absorbed` 的可证明结论

## 3. Loom 不承接什么

Loom 当前不提供以下原生命令：

- branch create / rename / retire
- PR create / update / merge / close
- git worktree create / remove
- worker daemon run / stop / remove

这些动作继续留给 Git / GitHub 或其他宿主平台。

## 4. 边界读取入口

- `python3 tools/loom_flow.py host-lifecycle --target <repo> [--item <id>]`
- `python3 tools/loom_flow.py workspace create|locate|attach|cleanup|retire --target <repo> [--item <id>]`
- `python3 tools/loom_flow.py purity-check --target <repo> [--item <id>]`

更广的 host-facing actions，例如 `checkpoint merge`、`flow merge-ready`、`reconciliation audit|sync`、`closeout check|sync`，统一由 [host-action-contract.md](./host-action-contract.md) 索引。

## 5. 边界约束

- branch / PR purity 可以被 Loom 报告和消费，但不意味着 Loom 接管其生命周期
- `workspace` 是执行现场抽象，不等于 git worktree
- `workspace attach` 只定位并绑定既有现场，不创建、不删除、不接管宿主对象
- `run` / `stop` 只属于 execution-boundary 读面或事件语义，不是 Loom core worker lifecycle 命令
- `remove` 不进入 Loom core；目录、git worktree 或 worker 删除继续由宿主平台拥有
- Loom 只消费 `active issue` 与宿主对象的绑定，不在这里主定义 `active issue`
- 宿主对象的 UI、命名、按钮与策略不进入 Loom 默认内核
- `host-lifecycle` 正常只读边界，不把宿主动作缺口伪装成 `fallback`；回退纪律由 [host-action-contract.md](./host-action-contract.md) 统一承接
