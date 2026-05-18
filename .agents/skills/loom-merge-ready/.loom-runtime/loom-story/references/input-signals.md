# Loom Story Input Signals

当任务满足以下任一信号时，进入 `loom-story`：

- 将 vision / roadmap / notes / discussion 整理成 User Story
- story shaping
- story readiness
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

若缺少产品上下文，返回 `needs-shaping` 或 `blocked`，不要编造 product truth。
