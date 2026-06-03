# Loom Pre Review Output Contract

输出固定为统一 pre-review 摘要 JSON，至少需要给出：

- `item`
  - 当前事项编号、目标、范围、执行路径
- `result`
  - `pass`、`block` 或 `fallback`
- `summary`
  - 当前是否可进入 review 的单句结论
- `missing_inputs`
  - 当前阻断需要补齐的信息；无阻断时为空数组
- `fallback_to`
  - 若当前不能继续进入 review，应回退到哪个 checkpoint；无回退时为 `null`
- `runtime_state`
  - 当前 Loom 入口自己的 scene / carrier 判定，以及 fail-closed 原因
- `governance_lint`
  - `loom-governance-lint-status/v1` 派生证据；blocking lint 进入 `missing_inputs`，advisory lint 只进入风险摘要，不产生 reviewer 结论
- `suite_path_consumption`
  - full path 的 required artifacts、evidence-map freshness、consistency-analysis
    blocking/advisory 分类
  - minimal path 的 `not_applicable` rationale、consumer boundary、recheck condition
  - full path 缺必需输入或 minimal path 无有效 rationale 时必须 fail-closed
- `readiness_cost_guard`
  - schema 固定为 `loom-pre-review-readiness-cost-guard/v1`
  - 在 PR 绑定或 build checkpoint 存在时以 blocking 模式消费 review 前成本信号
  - 消费 checkout HEAD / PR head alignment、dirty worktree、`Latest Validation
    Summary` 中的 deterministic checks、generated skills surface、release/package
    surface、PR metadata preflight、#969 review profile proof、closeout preview 和
    post-review carrier-only policy
  - 输出 `result`、`missing_inputs`、`failure_taxonomy`、`fallback_to` 与
    `summary`
  - 不替代 `Work Item`、review record、merge-ready result、closeout evidence 或
    docs/source truth
- `steps`
  - 固定按 `runtime-state -> fact-chain -> state-check -> runtime-evidence -> checkpoint-admission -> workspace-locate -> suite-evidence-validate -> suite-carrier-validate -> governance-lint -> pr-metadata-preflight -> pre-review-readiness-cost-guard` 顺序列出

这个 skill 不产生 reviewer 结论；它只提供进入 review 前的统一机械判断。
