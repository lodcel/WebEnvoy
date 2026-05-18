---
name: loom-pre-review
description: 负责统一 review 前检查。Use when Codex needs a single pre-review gate before entering semantic review.
---

# Loom Pre Review

这个 skill 承接 review 前统一检查场景。

它只包裹既有 `flow pre-review`，不生成语义 review 结论，也不新增并行状态源。

## 1. 使用时机

当任务满足以下任一条件时，进入 `loom-pre-review`：

- 明确要求 review 前检查
- 明确要求进入 review 前先做统一预检
- 明确要求确认当前事项是否已经可 review
- 明确要求先看阻断项、运行时证据与 admission checkpoint 是否齐全

如果任务其实是在做初始化、恢复执行、handoff、retire 或 merge-ready，应回到 root route matrix，让 `loom-init` 路由到对应场景：

- [../route-matrix.md](../route-matrix.md)

## 2. 固定入口

统一入口固定为：

- `python3 scripts/loom-pre-review.py flow pre-review --target <repo> [--item <id>]`

## 3. 固定编排

`flow pre-review` 固定只编排以下读取链路：

1. `fact-chain`
2. `state-check`
3. `runtime-evidence`
4. `checkpoint admission`
5. `workspace locate`

这个 skill 不做以下事情：

- 不替代 reviewer 的语义判断
- 不直接执行 merge
- 不回写事实链、恢复入口或状态面

## 4. 输出要求

输出必须是统一的 pre-review 摘要 JSON，至少要让执行者能读出：

- 当前事项是什么
- 当前是否可进入 review
- 哪一步阻断了继续进入 review
- 若阻断，应回退到哪里
- 当前 steps 的机械结果是什么

## 5. 完成标准

只有当以下条件同时满足时，`loom-pre-review` 才算完成：

- 显式调用 `loom-pre-review` 与 root 隐式路由都能稳定命中
- `flow pre-review` 的步骤顺序稳定为 `runtime-state -> fact-chain -> state-check -> runtime-evidence -> checkpoint-admission -> workspace-locate`
- 输出 JSON 能直接支撑“是否进入 review 前语义审查”的判断
- skill 自身不复制治理真相，也不冒充 reviewer 结论

输入信号与输出合同见：

- [references/input-signals.md](./references/input-signals.md)
- [references/output-contract.md](./references/output-contract.md)
