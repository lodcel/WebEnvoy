# Loom Story Input Signals

当任务满足以下任一信号时，进入 `loom-story`：

- 将 vision / roadmap / notes / discussion 整理成 User Story
- story shaping
- story readiness
- story business confirmation
- 用户确认 story 业务语义
- 用户对 story 给出修订意见
- actor specificity
- scenario coverage
- story acceptance scenarios 到 `spec.md` / `plan.md` 的映射

最小输入：

- 目标仓库
- 产品上下文或 locator
- story shaping 意图
- 已知 actor 或 actor 候选
- 目标 capability / problem
- 期望 outcome 或 value signal

若缺少产品上下文、业务确认或关键场景，返回 `pending` 并列出 missing inputs，不要编造 product truth。

若用户要求修改 story，返回 `revision-requested` 并回到 story shaping，不得继续进入 `spec.md` / `plan.md`。

若事项不涉及业务语义，例如纯治理、维护、格式、链接修复或载体整理，返回 `not_applicable` 并记录 bypass rationale；不要把缺少 story 当成隐式通过。
