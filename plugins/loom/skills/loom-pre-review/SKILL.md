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

- [../route-matrix.md](plugins/loom/skills/loom-pre-review/.loom-runtime/route-matrix.md)

## 2. 固定入口

统一入口固定为：

- `python3 scripts/loom-pre-review.py flow pre-review --target <repo> [--item <id>]`

该入口消费 repo-local `loom suite evidence validate --json` 与
`loom suite carrier validate --json` 输出作为 gate input evidence。缺少可读 CLI
JSON 或返回 blocking/fallback 时 fail closed；skill 不重写 evidence-map 或
task-carrier 规则。

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
- 不重新定义 full/minimal suite、evidence-map、consistency-analysis 或 gate-chain

## 4. 输出要求

输出必须是统一的 pre-review 摘要 JSON，至少要让执行者能读出：

- 当前事项是什么
- 当前是否可进入 review
- 哪一步阻断了继续进入 review
- 若阻断，应回退到哪里
- 当前 steps 的机械结果是什么
- full path 的 suite locator、evidence-map freshness 与 consistency-analysis
  blocking/advisory 分类是否已经可供 review 消费
- minimal path 的 `not_applicable` rationale、consumer boundary 与 recheck condition
  是否足够；不足时必须 fail-closed，不能进入 review

## 5. 完成标准

只有当以下条件同时满足时，`loom-pre-review` 才算完成：

- 显式调用 `loom-pre-review` 与 root 隐式路由都能稳定命中
- `flow pre-review` 的步骤顺序稳定为 `runtime-state -> fact-chain -> state-check -> runtime-evidence -> checkpoint-admission -> workspace-locate`
- 输出 JSON 能直接支撑“是否进入 review 前语义审查”的判断
- skill 自身不复制治理真相，也不冒充 reviewer 结论
- full path 缺少必需 suite artifact、provenance、fresh evidence 或存在 blocking
  consistency gap 时返回 `block` / `fallback`
- minimal path 只有在缺口具备有效 `not_applicable` rationale 时才允许进入 review
- 昂贵 semantic review 前必须消费 readiness / cost guard：PR head / checkout
  head、dirty state、deterministic validation summary、generated skills surface、
  PR metadata preflight、#969 review profile proof、closeout preview 与
  post-review carrier-only policy；有 PR 绑定或已到 build checkpoint 时 fail
  closed，普通早期路由探测只输出 advisory evidence

输入信号与输出合同见：

- [references/input-signals.md](./references/input-signals.md)
- [references/output-contract.md](./references/output-contract.md)

Pre-review 消费的共享合同见：

- [spec-suite.md](plugins/loom/skills/loom-pre-review/.loom-runtime/shared/references/templates/spec-suite.md)
- [evidence-map.md](plugins/loom/skills/loom-pre-review/.loom-runtime/shared/references/templates/evidence-map.md)
- [consistency-analysis.md](plugins/loom/skills/loom-pre-review/.loom-runtime/shared/references/templates/consistency-analysis.md)
- [gate-chain.md](plugins/loom/skills/loom-pre-review/.loom-runtime/shared/references/harness/gate-chain.md)
