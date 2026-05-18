---
name: loom-build
description: 仅在用户显式要求 Loom build，或当前事项已有 Loom-admitted Work Item 并进入 Loom build flow 时使用；不要用于普通 WebEnvoy 实现、测试、review 或 guardian 流程。
---

# Loom Build

`loom-build` 承接 resume 之后、pre-review 之前的执行/build 场景。

它不启动 worker daemon，也不把 subagent 输出当作新真相源。所有委派输出只有在主执行者集成到实现、验证证据、recovery/status 和后续 review 输入后，才可作为 build readiness 证据。

## 1. 使用时机

当任务满足以下任一条件时，进入 `loom-build`：

- 明确要求实现当前 Work Item
- 明确要求执行 build / implementation round
- 明确要求使用 subagent-driven execution mode
- 需要把委派输出集成回 Loom carriers 后再进入 review
- 需要判断 unintegrated subagent output 或 repeated blocker 是否阻断 readiness

如果任务只是恢复上下文，应回到 `loom-resume`。如果任务已经要求 review 前检查，应进入 `loom-pre-review`。

## 2. 固定入口

统一入口固定为：

- `python3 .agents/skills/loom-build/scripts/loom-build.py flow build --target <repo> [--item <id>] [--build-evidence <path>]`

## 3. Subagent-Driven Ownership Contract

subagent-driven mode 必须先声明以下字段：

- `task_goal`
- `context_locators`
- `read_scope`
- `write_ownership`
- `non_goals`
- `validation_expectation`
- `output_format`
- `integration_target`

主执行者仍然负责：

- 将委派输出集成到实现
- 记录验证证据
- 更新 recovery/status carriers
- 把已集成证据输入后续 review

## 4. 阻断语义

以下情况必须阻断 build readiness：

- subagent output 只存在于 session 输出中，尚未集成
- 多个委派声明重叠 `write_ownership`
- 多轮或多个委派报告同一 blocker signature
- 缺少 Work Item、spec、plan、recovery、validation baseline、workspace 或 ownership constraints

## 5. 完成标准

只有当 `flow build` 返回 pass，且 build evidence 证明所有委派输出已集成、无 ownership overlap、无 repeated blocker 时，才允许继续进入 pre-review / review。

输入信号与输出合同见：

- [references/input-signals.md](./references/input-signals.md)
- [references/output-contract.md](./references/output-contract.md)
