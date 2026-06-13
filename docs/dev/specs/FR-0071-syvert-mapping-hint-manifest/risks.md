# FR-0071 Risks

## 风险 1：把 hint manifest 误当成 Syvert normalized result

触发条件：

- Consumer 看到 `route_hint`、`raw_payload_hint` 或 `mapping_intent=classify_route` 后，直接生成 Syvert product result。

影响：

- WebEnvoy core 会越界承担 Syvert business mapping，导致 normalized result ownership 混乱。

缓解：

- 本 FR 明确 `non_proofs` 必须包含 `not_syvert_normalized_result`。
- Forbidden fields 包含 `normalized`、`syvert_normalized_result`、`syvert_resource_type` 和 `syvert_error_code`。
- `MappingGapHint.webenvoy_default_allowed=false`。

剩余风险：

- 后续 Syvert wrapper 仍可能误用 hints；#1203/#1204 必须在自身 scope 内补消费测试。

## 风险 2：local-only 被误升级为 active integration gate

触发条件：

- PR 仅因 Syvert 未来可能消费 manifest，就填写 `integration_applicable=yes` 或声明 joint acceptance。

影响：

- 本仓库 WebEnvoy-local formal carrier 被错误绑定到 integration project，scheduler gate 和 review 事实载体失真。

缓解：

- 本 FR 固定 v1 `integration_mode=local_only`。
- `spec.md` 提供 local-only integration classification。
- Future shared contract / wrapper / joint acceptance 需要单独 scheduler decision。

剩余风险：

- 后续 PR body 可能误填 integration metadata；scheduler gate 需要 read back PR body。

## 风险 3：scope drift 到 #1200/#1201/#1203/#1204/#1205

触发条件：

- 当前 PR 顺手实现 WebEnvoy envelope/error hints、Syvert CLI/JSON-RPC wrappers、evidence passthrough 或 integration metadata implementation。

影响：

- #1199 formal spec review PR 混入实现，破坏 downstream blocker ownership。

缓解：

- Plan 限定 allowed write paths 为 FR-0071 suite 与 sync-map。
- TODO 明确不承接 #1200/#1201/#1203/#1204/#1205。
- PR purity、scope audit 和 diff check 必须通过。

剩余风险：

- Downstream blockers 需要 scheduler 编排消费 FR-0071，而不是在本 PR 扩 scope。

## 风险 4：source binding 缺失导致 stale 或敏感输入被消费

触发条件：

- Hint item 缺少 source contract、source section、source owner、source ref、scope、freshness 或 redaction state。
- Hint item 使用 `source_section=unknown`、`source_owner=unknown|downstream_owner_required` 或 `source_ref=null`，却仍声明 `allowed_effect=downstream_mapping_input`。
- Example 内联 raw payload、private URL、credential header 或 provider private patch details。

影响：

- Consumer 可能消费无来源证据、历史证据、跨 scope 证据或敏感数据。

缓解：

- Consumable hint 必须使用 `MappingHintConsumableSourceBindingV1`，并提供非空 source ref、明确 source section 与 owner。
- Unknown/null/untraceable source 只能使用 blocker-only item，且 `allowed_effect=blocker_explanation`。
- Contract rules 要求 missing source、stale、scope mismatch、redaction invalid fail closed。
- Synthetic example 只使用 redacted refs。

剩余风险：

- 后续 parser / artifact writer 需要机器检查 forbidden data。

## 风险 5：provider adapter 或 live evidence 语义被混入 hint

触发条件：

- Manifest 声明 provider adapter ready、live evidence accepted、read/write gate allow 或 live_write_commit。

影响：

- Provider/runtime/live gate owner 被绕过，真实浏览器或账号风险被低估。

缓解：

- `non_proofs` 覆盖 provider adapter、live evidence 和 read/write gate allow。
- Forbidden fields 包含 `provider_adapter` 与 `live_write_commit`。
- `forbidden_effects` 必须包含 adapter/live/gate completion enum。

剩余风险：

- 后续 provider/runtime implementation PR 需要重新核对 FR-0069/FR-0070 与 live evidence gate。
