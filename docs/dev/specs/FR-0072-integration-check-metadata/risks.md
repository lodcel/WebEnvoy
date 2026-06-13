# FR-0072 Risks

## 风险 1：把 local-only formal docs 误升级为 integration-gated

触发条件：

- PR 只冻结 WebEnvoy-owned docs / hints / metadata，但因为未来可能被 Syvert 消费而填写 `integration_applicable=yes`。

影响：

- 本仓库 local-only 事项被错误绑定到 integration project，scheduler gate 和 PR truth 失真。

缓解：

- 本 FR 明确 local-only default。
- FR-0071 mapping hint manifest 作为 local-only non-trigger example。
- Valid local-only metadata 固定 `integration_ref=none`、`merge_gate=local_only`、`contract_surface=none`。

剩余风险：

- 后续 PR author 仍可能误填；reviewer / guardian 必须按本 FR 审查 PR body。

## 风险 2：shared contract 或 joint acceptance 漏报为 local-only

触发条件：

- PR 改 shared output、provider adapter、错误/id/diagnostics/observability 语义，或 completion depends on joint acceptance，但 metadata 写 `integration_applicable=no`。

影响：

- 跨仓依赖未被 gate 消费，可能合入破坏 shared contract 的 PR。

缓解：

- Integration-gated triggers 明确列出 shared contract、external dependency、joint acceptance、provider/shared-contract gate 口径。
- Relationship matrix 要求 `shared_contract_changed=yes`、`external_dependency != none`、`joint_acceptance_needed=yes` 均触发 integration gate。
- Merge gate parser 对 inconsistent integration metadata fail closed。

剩余风险：

- Parser 无法仅凭 metadata 判断 actual diff 是否漏报；reviewer / guardian 仍需对照 diff、issue 和 architecture。

## 风险 3：contract_surface 误分类

触发条件：

- Integration-gated PR 修改 integration gate / review 语义，却填写 `contract_surface=none` 或错误 runtime surface。

影响：

- Review owner 和 gate 分类失准，integration governance 改动可能被当作普通 local docs。

缓解：

- 本 FR 明确 integration gate / review semantics changes use `contract_surface=integration_governance` when integration-gated。
- `contract_surface=none` 只允许 local-only。

剩余风险：

- 某些 mixed changes 可能同时触及 runtime surface 与 governance surface；需要 scheduler / reviewer 选择最保守 surface 或拆 PR。

## 风险 4：只修 metadata 但未重新验证 parser 消费

触发条件：

- PR body 只改 `integration_check` 字段，未重新运行 metadata parser 或 merge gate readback。

影响：

- Scheduler / guardian 使用旧 metadata 或未解析的新 metadata，造成 gate 输入漂移。

缓解：

- PR lifecycle obligations 要求 PR body metadata update 后重新 read back。
- Validation plan 包含 same-class metadata audit 和 targeted parser tests when scripts/tests change。

剩余风险：

- Hosted PR body readback 属于 scheduler gate owner；worker 完成本地验证后必须停在 waiting-scheduler-gate。

## 风险 5：scope drift 到 Syvert normalized result 或 provider adapter

触发条件：

- 当前 PR 顺手定义 Syvert normalized result、taxonomy、wrapper behavior、provider adapter 或 joint acceptance implementation。

影响：

- #1205 metadata governance PR 混入 downstream implementation，破坏 #1120 的分层边界。

缓解：

- Spec / plan 明确非目标和 forbidden scope。
- Same-class scope audit 搜索 normalized result、provider adapter、joint acceptance implementation、runtime/live evidence、browser/account action claims。

剩余风险：

- 后续 #1203/#1204 或 provider work 需要独立 FR / PR 消费本 metadata contract。
