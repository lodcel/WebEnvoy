---
name: loom-adopt
description: 负责把仓库接入 Loom 的初始化场景入口。Use when Codex needs to initialize a new repository with Loom or retrofit Loom into an existing repository.
---

# Loom Adopt

这个 skill 承接初始化与 retrofit 场景。

它只编排已有 root bootstrap 能力，不新增并行事实源，不创建第二套日常执行入口。

## 1. 使用时机

当任务满足以下任一条件时，进入 `loom-adopt`：

- 明确要求初始化新项目
- 明确要求把既有仓库接入 Loom
- 明确要求 retrofit Loom 入口、首批工件或初始化事实链
- 当前任务核心问题是“如何进入 Loom”，而不是“如何恢复、review、handoff、retire 或 merge-ready”

若任务其实是接手当前事项、review 前检查、交接、retire 或 merge-ready，应回到 root route matrix，转向对应场景 skill：

- [../route-matrix.md](plugins/loom/skills/loom-adopt/.loom-runtime/route-matrix.md)

## 2. 读取顺序

按以下顺序读取：

- 目标仓库中的 `AGENTS.md`、`README`、流程文档、模板、验证入口
- Loom 根级定位文档
  - `AGENTS.md`
  - `README.md`
- 初始化相关稳定规则
  - [../shared/references/adoption/zero-friction-adoption-contract.md](plugins/loom/skills/loom-adopt/.loom-runtime/shared/references/adoption/zero-friction-adoption-contract.md)
  - [../shared/references/adoption/lightweight-retrofit-default.md](plugins/loom/skills/loom-adopt/.loom-runtime/shared/references/adoption/lightweight-retrofit-default.md)
  - [../shared/references/adoption/routing-and-checkpoints.md](plugins/loom/skills/loom-adopt/.loom-runtime/shared/references/adoption/routing-and-checkpoints.md)
  - [../shared/references/adoption/loom-surfaces-version-control.md](plugins/loom/skills/loom-adopt/.loom-runtime/shared/references/adoption/loom-surfaces-version-control.md)
  - [../shared/references/harness/fact-chain-contract.md](plugins/loom/skills/loom-adopt/.loom-runtime/shared/references/harness/fact-chain-contract.md)
  - [../loom-init/references/input-signals.md](plugins/loom/skills/loom-adopt/.loom-runtime/loom-init/references/input-signals.md)
  - [../loom-init/references/output-contract.md](plugins/loom/skills/loom-adopt/.loom-runtime/loom-init/references/output-contract.md)
- 本 skill 的场景合同
  - [references/input-signals.md](./references/input-signals.md)
  - [references/output-contract.md](./references/output-contract.md)

## 3. 固定编排

本 skill 不新增新 CLI，固定复用：

- `python3 scripts/loom-adopt.py bootstrap --target <repo> [--intent observe-only|skill-install-only|attach-only|light-governance|execution-control|strong-governance]`
- `python3 scripts/loom-adopt.py verify --target <repo>`
- `python3 scripts/loom-adopt.py fact-chain --target <repo>`

执行顺序固定为：

1. `read`
   - 读取目标仓库根规则、验证入口、已有治理载体、repo-specific gates、retained host actions、repo-native carriers、现有 companion / interop locator
2. `judge`
   - 判断这是 `新项目`、`小型既有仓库` 还是 `复杂既有仓库`
   - 消费或输出 `adoption_intent`；当 intent 不明确且写入会创建重执行控制面时，先停在 decision prompt / dry-run，不静默写入
   - 输出 `scaffold_profile`，并按该 profile 列出 required、planned、intentionally absent 与 forbidden authored carriers
   - 输出本轮启用能力、暂不启用能力、升级触发条件、source locator、write target 与 validation command
3. `write`
   - 只有用户要求实际落盘时才执行 `bootstrap --write`
   - 写入目标不得新增平行事实链或把 repo-owned residue 改写成 Loom core 规则
4. `verify`
   - 落盘后必须能用 `verify` 与 `fact-chain` 复读
   - 验证 generated companion / interop locator 存在或 intentionally absent，并输出 resume guidance

## 4. 输出要求

输出必须直接遵守初始化输出合同，而不是另写一套 adopt 专属真相：

- [../loom-init/references/output-contract.md](plugins/loom/skills/loom-adopt/.loom-runtime/loom-init/references/output-contract.md)

至少要明确：

- 当前初始化场景判断
- 本轮启用能力
- 首批工件与首批事项
- 事实链入口
- 验证入口
- decision prompt 字段、source locator、writeback target 与 verification evidence
- generated companion / interop 边界
- adoption verify closure
- post-adoption resume guidance
- 当前不启用什么，以及为什么

## 5. 完成标准

只有当以下条件同时满足时，才算 `loom-adopt` 完成：

- root route 或显式 skill 调用都能稳定命中 `loom-adopt`
- `bootstrap` 输出能解释为什么是这条 adoption 路径
- `verify` 与 `fact-chain` 都能消费落盘结果
- 结果没有引入新的事实链载体或平行状态源
- generated companion / interop locator 已存在，或被明确标记为 intentionally absent
- repo-specific 判断都有 source locator、reasoning、writeback target 与 verification evidence
- resume 能识别 adoption 后的 continuation entry，或明确回退到 admission / adoption verify
