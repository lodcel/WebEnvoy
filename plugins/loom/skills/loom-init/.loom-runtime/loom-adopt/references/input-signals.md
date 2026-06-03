# Loom Adopt Input Signals

当任务满足以下任一信号时，进入 `loom-adopt`：

- 明确要求初始化新项目
- 明确要求把既有仓库接入 Loom
- 明确要求 retrofit Loom 入口、首批工件或初始化事实链
- 明确要求判断某个仓库应该采用哪条 Loom 初始化路径

最小输入：

- `target_repository`
- `adoption_scope`
- `write_intent`
  - `dry-run | write`
- `repository_mode_guess`
  - 可为 `unknown`
- `existing_governance_signals`
  - 目标仓库已有根规则、workflow、review、status、recovery、closeout 或等价治理入口；每项应带 locator
- `existing_validation_entry`
  - CI、测试命令、repo-local verify script 或明确缺口
- `companion_boundary_intent`
  - 是否生成或更新 `repo companion`，以及预期 locator
- `interop_boundary_intent`
  - 是否生成或更新 `repo interop`，以及预期 locator
- `resume_after_adoption_intent`
  - adoption 完成后是否需要继续执行当前事项
- 当前任务是否仍属于初始化，而不是恢复/交接/review/merge-ready

若缺少最后一项，必须先回到 [../../route-matrix.md](../../route-matrix.md) 重新判断场景。

若缺少 source locator、writeback target 或 verification command，`loom-adopt` 必须把它作为 decision prompt 缺口输出，不能直接宣称 adoption 完成。
