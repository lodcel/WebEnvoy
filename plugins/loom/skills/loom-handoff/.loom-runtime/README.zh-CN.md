# Skills

语言：中文 | [English version](./README.md)

`skills/` 是 Loom 源仓库生成且提交的 skills install surface。可编辑源码真相位于 `src/skills/`。

每个 `skills/<skill-id>` 也都是自包含 single-skill package。下游 Codex plugin 安装会把同一生成 payload 内嵌到 `plugins/loom/skills/`，而不是要求目标仓库顶层 `skills/`。方法论和架构文档位于这层之后，用户通常应该从 skills 进入，而不是先读内部治理文档。

默认从 `loom-init` 开始。它是 Loom 唯一的 root entry，负责两件事：

- 初始化 Loom，或把 Loom retrofit 进既有仓库
- 在没有显式指定场景 skill 时，根据任务信号把执行者导向正确场景

当前 `skills/` 层消费的是新的强治理控制面，固定约束如下：

- `Work Item` 是唯一正式执行入口
- delivery planning 可以在执行前输出 issue-tree plan，但不替代 `Work Item`、spec、review、merge-ready 或 closeout 真相
- 命中 formal spec 的事项，必须先通过 `spec gate`
- 执行放行链固定收敛为 `spec gate -> build gate -> review gate -> merge gate`
- `status control plane` 只读取并汇总事实链与宿主控制面，不新增 authored 真相
- profile maturity 按 `light -> standard -> strong` 升级；事项成熟度仍按治理状态机推进
- merge 由 GitHub 或等价宿主控制面受控执行；Loom 只消费并汇总 `GitHub controlled merge` 的前置条件

## Skills Library

Loom 暴露一个 root entry 和十个 scenario skills：

| Skill | 作用 |
| --- | --- |
| `loom-init` | Root entry；负责初始化和路由。 |
| `loom-adopt` | 初始化新仓库，或把 Loom retrofit 到既有仓库。 |
| `loom-resume` | 恢复上下文并继续执行。 |
| `loom-build` | 执行 bounded implementation/build 轮，并在 review 前校验委派输出已集成。 |
| `loom-story` | 将产品上下文收束为 User Story、Story Readiness 与业务语义确认点，供 spec / plan 消费。 |
| `loom-pre-review` | 在正式 review 前检查 readiness。 |
| `loom-spec-review` | 审查 formal spec 路径，并产出后续 gate 消费的 `spec gate`。 |
| `loom-review` | 执行正式 review 并记录输出。 |
| `loom-handoff` | 写出 handoff 点和下一步状态。 |
| `loom-retire` | 清理或退场当前工作现场。 |
| `loom-merge-ready` | 在 GitHub controlled merge 前执行最终 `merge gate` 汇总。 |

## Entry Model

Loom 支持两种入口模式：

- 显式入口：用户直接指定某个场景 skill。
- 路由入口：用户从 `loom-init` 开始，由 `loom-init` 根据任务信号选择场景。

如果任务信号不完整、存在冲突，或缺少稳定执行所需的最小输入，应回退到 `loom-init`，并要求补齐最小缺失信号。稳定路由规则见 [route-matrix.md](./route-matrix.md)。

路由只决定场景 skill，不替代稳定控制面：

- planning 输出只停留在 issue-tree plan / host carrier mapping，除非用户明确要求创建或更新宿主对象
- 执行入口仍然绑定在 `Work Item`
- gate 仍然绑定在共享 `gate chain`
- 状态读取仍然绑定在共享 `status control plane`
- merge 仍然由宿主平台控制面执行

## Install Model

主安装路径是根 `loom` CLI：

```bash
npm install -g @mc-and-his-agents/loom
loom host install --host codex --mode plugin --target . --apply --json
loom host verify --host codex --mode plugin --target . --json
loom skills check --target . --json
```

对下游 Codex plugin mode，`loom host install` 写入
`plugins/loom/.codex-plugin/plugin.json`、`plugins/loom/skills/` 和
`.loom/installed-state.json`。它默认不写入或要求下游顶层 `skills/`。

## Advanced / Compatibility

单 skill 安装保留为高级兼容路径，但不再是默认用户路径：

```bash
loom host install --host codex --mode skill --skill-id <skill-id> --target . --apply --json
```

历史兼容证据仍可引用
`npx @mc-and-his-agents/loom-installer add skill <skill-id>`，但该命令不是
primary install path，也不得替代根 `loom` CLI flow。

单独安装的 skill 只会向宿主暴露该 skill 本身。除非安装的就是 `loom-init`，否则它不会暴露完整的 `loom-init` 路由面，也不应被表述成完整的 Loom 体验。

每个生成 single-skill package 都包含 `loom-package.json`、包内 `.loom-runtime/`，以及从包内解析 runtime 的 launcher。

## Internal Contracts

以下文件属于 runtime contract，应保持稳定：

- [registry.json](./registry.json)
- [install-layout.json](./install-layout.json)
- [upgrade-contract.json](./upgrade-contract.json)
- [distribution-and-adapter-contract.md](./distribution-and-adapter-contract.md)

共享 runtime scripts、assets 和 references 位于 [shared/](./shared/)。它们会被 scenario skills 和 release tooling 一起消费，用来生成 plugin 或 single-skill payload。

生成表面检查：

```bash
python3 tools/skills_surface.py generate
make skills-check
```
