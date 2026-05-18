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

- [../route-matrix.md](.loom-runtime/route-matrix.md)

## 2. 固定入口

统一入口固定为：

- `python3 .agents/skills/loom-spec-review/scripts/loom-spec-review.py flow spec-review --target <repo> [--item <id>]`
- `python3 .agents/skills/loom-spec-review/scripts/loom-spec-review.py review run --target <repo> [--item <id>] --review-file .loom/reviews/<item>.spec.json`
- `python3 .agents/skills/loom-spec-review/scripts/loom-spec-review.py review record --target <repo> [--item <id>] --review-file .loom/reviews/<item>.spec.json --decision <allow|block|fallback> --kind spec_review --summary <text> --reviewer <id>`

补充约束：

- WebEnvoy clean checkout 中必须使用 repo-local vendored launcher，不依赖全局 `loom` 命令或本机 Loom 源仓 checkout。
- formal spec 路径不存在时，`flow spec-review` 必须 fail-closed
- spec review 只写回单一 spec review record，不替代 implementation review record
- `reviewed_head` 与 stale 语义必须显式暴露，供后续 gate 消费

## 3. 固定编排

`loom-spec-review` 固定按以下顺序编排：

1. 运行 `flow spec-review`，确认 formal spec 路径、build checkpoint 与 runtime 读面齐全
2. 若 `flow spec-review` 非 `pass`，直接返回 `block` 或 `fallback`
3. 运行 `review run`，在 verified Codex App host default、显式 authoritative adapter 或 headless fallback 中选择安全路径，生成 Loom-normalized spec findings
4. 若 `review run` fail-closed，回到 manual review 写回同一 spec review record
5. 用 `review record` 写入 `kind = spec_review` 的正式结论

这个 skill 不做以下事情：

- 不替代 implementation review
- 不替代 merge-ready 放行判断
- 不直接执行 merge 或平台动作
- 不回写 recovery entry、status control plane 或其他 authored 真相载体
- 不把 Codex App raw review output 直接升级成 spec review authored truth；verified host default 与显式 Codex App path 都必须经同一 normalized `review_record_input` 与 spec review record 边界

## 4. 输出要求

输出必须是统一 spec review 摘要 JSON，至少要让执行者能读出：

- 当前事项与 formal spec 路径
- spec review 的机械基线结果
- spec review record 的定位与当前结论
- reviewed head 绑定、当前 head、是否 stale
- 审查结论（`allow` / `block` / `fallback`）
- 若当前不能继续，应回退到哪里

输入信号与输出合同见：

- [references/input-signals.md](./references/input-signals.md)
- [references/output-contract.md](./references/output-contract.md)
