---
name: loom-resume
description: 负责恢复当前事项的执行入口。Use when Codex needs to take over an active Loom item, rebuild context, and continue from the current checkpoint.
---

# Loom Resume

这个 skill 承接恢复上下文、接手当前事项与继续推进。

它只读取现有事实链、`state-check` 和 `workspace locate`，输出一个可继续执行的恢复摘要，不回写任何载体。

## 1. 使用时机

当任务满足以下任一条件时，进入 `loom-resume`：

- 明确要求接手当前事项
- 明确要求恢复上下文
- 明确要求问下一步
- 明确要求继续推进当前执行链
- 明确要求先确认当前 checkpoint、阻断项和现场入口

如果任务其实是在做初始化、review 前检查、handoff、retire 或 merge-ready，应回到 root route matrix，让 `loom-init` 把任务路由到对应场景：

- [../route-matrix.md](.loom-runtime/route-matrix.md)

## 2. 固定入口

它依赖统一恢复摘要入口：

- `python3 scripts/loom-resume.py flow resume --target <repo> [--item <id>]`

## 3. 固定编排

`flow resume` 固定只编排以下读取链路：

1. `fact-chain`
2. `state-check`
3. `workspace locate`
4. 从当前恢复入口读取 `next_step`、`blockers`、`latest_validation_summary`
5. 从事实链读取当前 checkpoint

如果上一轮入口是 `loom-adopt`，`flow resume` 只能把 adoption 输出当作 locator 与 control-plane context：

- adoption source
- companion locator
- interop locator
- adoption verify summary
- post-adoption next step

随后仍按固定读取链路恢复；不得把 adoption 输出当作新的事实源，也不得因为 adoption dry-run 自动猜测下一步。

这个 skill 不做以下事情：

- 不回写恢复入口
- 不修改状态面
- 不创建新的工作现场
- 不猜测额外事项或第二目标

## 4. 输出要求

输出必须是可直接继续执行的恢复摘要 JSON，至少要让执行者能读出：

- 当前事项是什么
- 现场入口和恢复入口在哪里
- 当前 checkpoint 是什么
- 下一步是什么
- 当前阻断项和最近验证摘要是什么
- 这份摘要是否允许继续执行，还是需要先回退到 admission

## 5. 完成标准

只有当以下条件同时满足时，`loom-resume` 才算完成：

- 显式调用 `loom-resume` 与 root 隐式路由都能稳定命中这个场景
- `flow resume` 的步骤顺序稳定为 `runtime-state -> fact-chain -> state-check -> workspace-locate`
- 输出 JSON 能直接支撑继续执行，不要求人工再拼装上下文
- 全链路没有回写新的事实载体或并行状态面

输入信号与输出合同见：

- [references/input-signals.md](./references/input-signals.md)
- [references/output-contract.md](./references/output-contract.md)
