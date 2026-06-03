---
name: loom-spec-review
description: 负责 formal spec review 执行层。Use when Codex needs to review the formal spec path and produce the spec gate consumed by implementation review and merge-ready.
---

# Loom Spec Review

这个 skill 承接独立的 formal spec review 场景。

它与 `loom-review`、`loom-merge-ready` 的边界固定如下：

- `loom-spec-review` 负责 formal spec 路径的审查与 `spec gate`
- `loom-review` 负责实现/语义层正式 review，但不能绕过 spec gate
- `loom-merge-ready` 负责 merge 前统一放行聚合

## 1. 使用时机

当任务满足以下任一条件时，进入 `loom-spec-review`：

- 明确要求做 spec review
- 明确要求确认 formal spec 是否通过
- 明确要求产出可被 implementation review / merge-ready 消费的 `spec gate` 结论
- 明确要求审查 `.loom/specs/<item>/spec.md` 或等价 formal spec 路径

如果任务其实是在做初始化、恢复执行、review 前预检、implementation review、handoff、retire 或 merge-ready，应回到 root route matrix，让 `loom-init` 路由到对应场景：

- [../route-matrix.md](plugins/loom/skills/loom-spec-review/.loom-runtime/route-matrix.md)

## 2. 固定入口

统一入口固定为：

- `loom flow spec-review --target <repo> [--item <id>]`
- `loom review run --target <repo> [--item <id>] --review-file .loom/reviews/<item>.spec.json`
- `loom review record --target <repo> [--item <id>] --review-file .loom/reviews/<item>.spec.json --decision <allow|block|fallback> --kind spec_review --summary <text> --reviewer <id>`

补充约束：

- formal spec 路径不存在时，`flow spec-review` 必须 fail-closed
- formal spec suite readiness 必须来自 repo-local `loom suite validate --json`
  输出；缺少可读 CLI JSON 时 fail closed，不在 skill runtime 中重新判定 suite 规则
- spec review 只写回单一 spec review record，不替代 implementation review record
- `reviewed_head` 与 stale 语义必须显式暴露，供后续 gate 消费
- full path 必须消费 suite path locator、必需工件 locator、provenance，以及
  evidence-map / consistency-analysis / gate-chain 适用性结论；缺失或不可读时
  fail-closed，回退到 spec shaping 或 suite path 修正
- minimal path 只能消费带 rationale、consumer boundary 和 recheck condition 的
  `not_applicable`；无理由缺口、`deferred` 或 source/generated sync 待办不得被当作
  spec gate 通过

## 3. 固定编排

`loom-spec-review` 固定按以下顺序编排：

1. 运行 `flow spec-review`，确认 formal spec 路径、build checkpoint 与 runtime 读面齐全
2. 若 `flow spec-review` 非 `pass`，直接返回 `block` 或 `fallback`
3. 运行 `review run`，在 verified Codex App host default、显式 authoritative adapter 或 headless fallback 中选择安全路径，生成 Loom-normalized spec findings；`CI` / `CODEX_CI` 不得遮蔽已验证的真实 Codex App host proof，proof 不足时必须输出缺失 locator diagnostic
4. 若 `review run` fail-closed，回到 manual review 写回同一 spec review record
5. 用 `review record` 写入 `kind = spec_review` 的正式结论

这个 skill 不做以下事情：

- 不替代 implementation review
- 不替代 merge-ready 放行判断
- 不直接执行 merge 或平台动作
- 不回写 recovery entry、status control plane 或其他 authored 真相载体
- 不把 Codex App raw review output 直接升级成 spec review authored truth；verified host default 与显式 Codex App path 都必须经同一 normalized `review_record_input` 与 spec review record 边界
- 不重新定义 full suite、minimal suite、evidence-map、consistency-analysis 或
  gate-chain 语义；只消费这些合同已经定义的 locator、freshness、classification
  与 fallback 边界

## 4. 输出要求

输出必须是统一 spec review 摘要 JSON，至少要让执行者能读出：

- 当前事项与 formal spec 路径
- spec review 的机械基线结果
- spec review record 的定位与当前结论
- reviewed head 绑定、当前 head、是否 stale
- suite path decision，以及 full path readiness 或 minimal path `not_applicable`
  rationale 是否可被 spec gate 消费
- 审查结论（`allow` / `block` / `fallback`）
- 若当前不能继续，应回退到哪里

输入信号与输出合同见：

- [references/input-signals.md](./references/input-signals.md)
- [references/output-contract.md](./references/output-contract.md)

Formal spec path 消费的共享合同见：

- [spec-suite.md](plugins/loom/skills/loom-spec-review/.loom-runtime/shared/references/templates/spec-suite.md)
- [evidence-map.md](plugins/loom/skills/loom-spec-review/.loom-runtime/shared/references/templates/evidence-map.md)
- [consistency-analysis.md](plugins/loom/skills/loom-spec-review/.loom-runtime/shared/references/templates/consistency-analysis.md)
- [gate-chain.md](plugins/loom/skills/loom-spec-review/.loom-runtime/shared/references/harness/gate-chain.md)
