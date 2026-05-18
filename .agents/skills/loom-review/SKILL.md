---
name: loom-review
description: 负责正式 review 执行层。Use when Codex needs to run semantic review after pre-review and produce a formal review verdict without replacing merge-ready.
---

# Loom Review

这个 skill 承接正式 review 执行层，也就是 gate chain 里的 `review gate`。

它不等于 `loom-pre-review`，也不替代 `loom-merge-ready`：

- `loom-pre-review` 负责进入 review 前的统一机械预检
- `loom-review` 负责执行正式语义审查并产出 `review gate` 结论
- `loom-merge-ready` 负责 merge 前统一放行聚合

对执行者来说，正式 review 的首层入口仍是 `loom-review` 这个场景 skill。repo-local 自动化、验证、调试和宿主编排可以统一调用 repo-local `loom CLI`，但这不替代场景 skill 的用户入口，也不改变 review / merge-ready 的边界。

## 1. 使用时机

当任务满足以下任一条件时，进入 `loom-review`：

- 明确要求正式 review
- 明确要求语义审查或审查结论
- 明确要求输出 findings、风险和是否通过的判断
- 明确要求在 pre-review 通过后进入审查执行

如果任务其实是在做初始化、恢复执行、review 前预检、handoff、retire 或 merge-ready，应回到 root route matrix，让 `loom-init` 路由到对应场景：

- [../route-matrix.md](.loom-runtime/route-matrix.md)

## 2. 固定入口

统一入口固定为：

- `loom flow review --target <repo> [--item <id>]`
- `loom review run --target <repo> [--item <id>]`
- `loom review record --target <repo> [--item <id>] --decision <allow|block|fallback> --kind <general_review|code_review|spec_review> --summary <text> --reviewer <id>`

补充约束：

- 若需要写入结构化 findings / disposition，使用 `--findings-file <path>`
- `--blocking-issue` / `--follow-up` 仅保留兼容 authored 入口，不得与 `--findings-file` 混用
- 无论通过哪种入口，最终都只允许写回单一 `review_entry` 指向的 review record

这个 skill 先用 `flow review` 读取正式 review 的机械基线，再用 `review run` 选择安全的 authoritative adapter 并生成 Loom-normalized findings，最后用 `review record` 把审查结论写成可消费载体。

已验证 Codex App host context 中，默认 `review run` 使用 `loom/codex-app-review`，并必须证明 app-server/session locator、thread id、cwd proof、target root 与 reviewed head 绑定一致；该路径不得启动嵌套 `codex exec`。`CI` / `CODEX_CI`、headless、host proof 缺失或 app-server unavailable 时 fallback 到 `loom/default-codex-exec` + `codex exec --output-schema`。proof 冲突、cwd / target / head 不匹配或 schema normalization 失败时必须 fail closed 并回到 manual review 写同一 review record。

安装态或 repo-local 开发态可以把这些 `loom ...` 动作映射到底层 `scripts/...` 或共享 runtime carrier；但 `loom-review` 自身的场景合同、进入时机和输出责任保持不变。

## 3. 固定编排

`loom-review` 固定按以下顺序编排：

1. 运行 `flow review`，确认当前事项是否具备进入正式审查的最小条件
2. 若 `flow review` 非 `pass`，直接返回 `block` 或 `fallback`，不伪造审查结论
3. 运行 `review run`，在 verified Codex App host default、显式 authoritative adapter 或 headless fallback 中选择安全路径，并把 raw output 收敛为 Loom evidence 与 normalized findings
4. 若 `review run` fail-closed，显式回到 manual review 写回同一 `review record`
5. 用 `review record` 写入正式 review 结论，让 `merge gate` 可机械消费

这个 skill 不做以下事情：

- 不替代 pre-review 预检
- 不替代 `merge gate` 放行判断
- 不直接执行 merge 或平台动作
- 不回写 recovery entry、status control plane 或其他 authored 真相载体
- 不跳过 review record，直接把口头结论交给 `merge gate`
- 不把 engine raw output 升级成第二 authored truth

## 4. 输出要求

输出必须是统一 review 摘要 JSON，至少要让执行者能读出：

- 当前事项是什么
- review 机械基线结果
- build gate 是否允许进入正式审查
- review artifact 的定位与已记录结论
- selected adapter、fallback reason、thread/target binding summary、reviewed head、evidence 定位与 fail-closed 原因
- manual review 的回退写回入口
- review record 中的权威 findings / disposition 摘要
- 审查结论（`allow` / `block` / `fallback`）
- 若当前不能继续，应回退到哪里

## 5. 完成标准

只有当以下条件同时满足时，`loom-review` 才算完成：

- 显式调用 `loom-review` 与 root 隐式路由都能稳定命中
- 审查执行严格以 `flow review -> review run -> review record` 为前置，而不是绕过预检
- 输出 JSON 与 review record 都能直接支撑 `merge gate` 消费
- skill 不创建第二 authored 真相源，不替代 merge-ready 聚合
- review/disposition contract 只扩展 review record 内部字段，不新增第二 artifact 或新状态机

输入信号与输出合同见：

- [references/input-signals.md](./references/input-signals.md)
- [references/output-contract.md](./references/output-contract.md)
