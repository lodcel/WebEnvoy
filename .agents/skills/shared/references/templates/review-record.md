# Review Record

正式 review record 至少应表达：

- `item_id`
- `kind`
- `reviewed_head`
- `reviewed_validation_summary`
- `decision`
- `summary`
- `reviewer`
- `fallback_to`
- `findings`
- `blocking_issues`
- `follow_ups`
- `consumed_inputs`

允许结果：

- `allow`
- `block`
- `fallback`

约束：

- `fallback_to` 只在 `decision: fallback` 时使用
- `reviewed_head` 与 `reviewed_validation_summary` 必须对应本次审查基线
- merge checkpoint 允许 review 之后只新增 Loom 自身的 `review_entry` / recovery / status carriers 提交；除此之外的 `HEAD` 漂移仍视为 stale
- `findings` 是权威 findings / rebuttal / disposition 数组；每条至少包含 `id`、`summary`、`severity`、`rebuttal`、`disposition`
- `severity` 当前稳定值为 `warn`、`block`
- `rebuttal` 当前稳定值为 `null` 或非空字符串
- `disposition` 当前稳定值为 `null` 或对象；对象内的 `status` 只允许 `accepted`、`rejected`、`deferred`
- `blocking_issues` / `follow_ups` 仅作为兼容字段保留，默认从 `findings` 投影，不应被当作独立 authored 真相
- `consumed_inputs.engine_adapter`、`consumed_inputs.engine_evidence`、`consumed_inputs.normalized_findings` 只记录 evidence 来源，不构成第二 authored truth
- review record 是 merge checkpoint 的正式输入之一，不得只留在会话或 PR 评论里
