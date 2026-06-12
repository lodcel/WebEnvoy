# FR-0070 Logical Data Model

本 FR 不新增 SQLite 表、迁移、运行时持久化模型或 command output schema。本文件只冻结后续 parser / gate / evidence owner / #1188 consumer 可引用的 logical entities。

## 实体

### `WebEnvoyRiskEvidenceBoundary`

职责：表达 WebEnvoy-owned risk evidence 的正式 owner、允许输入、非证明信号、scope/freshness 绑定、fail-closed blocker、closeout/audit 边界与 handoff。

关键字段：

- `boundary_id`: 固定为 `webenvoy_owned_risk_evidence_boundary`。
- `boundary_version`: 当前固定为 `v1`。
- `owner_ref`: `#1183` 或 `FR-0070`。
- `provider_stealth_boundary_ref`: 指向 `FR-0069.provider_owned_stealth_boundary.v1`。
- `accepted_evidence_classes`: 可进入 evaluation 的 evidence class enum。
- `non_proofs`: 不得替代 risk accepted / live evidence / read-write gate allow 的输入。
- `required_bindings`: exact scope 与 freshness 绑定字段。
- `state_enum`: risk evidence state。
- `blocking_reasons`: fail-closed blocker enum。
- `provider_consumption_boundary`: 对 provider-owned stealth 输入的允许 / 禁止边界。
- `closeout_audit_boundary`: closeout evidence 与 audit 的最低边界。
- `handoff_refs`: #1182/#1183/#1176/#1187/#1188/#1118 owners。

生命周期：

- Created by this formal spec suite.
- Consumed by #1188 risk hint consumer gate and future implementation/parser/gate work.
- Invalidated or treated as stale when provider boundary, account safety, runtime target binding, target page, profile, provider, head, run, artifact identity or redaction policy drifts.

### `RiskEvidenceGateInput`

职责：表达一次 WebEnvoy-owned risk evidence evaluation 的输入。

关键字段：

- `requested_scope`
- `provider_boundary_ref`
- `evidence_refs`
- `non_proofs_observed`
- `evaluated_at`

约束：

- `provider_boundary_ref` 只能指向 formal provider stealth boundary，不得包含 provider private patch body。
- `evidence_refs` 只能是 locator/ref，不得内联 secret、private patch、raw account/profile/path 或 page payload。
- `non_proofs_observed` 不能单独产生 accepted。

### `WebEnvoyRiskEvidenceScope`

职责：绑定 exact workflow / capability / target / profile / provider / head / run / artifact scope。

关键字段：

- `workflow_ref`
- `capability_level`
- `target_domain`
- `target_page`
- `profile_ref`
- `browser_channel`
- `execution_surface`
- `provider_ref`
- `provider_stealth_boundary_ref`
- `account_safety_ref`
- `runtime_target_binding_ref`
- `head_sha`
- `run_id`
- `evaluation_context_ref`
- `artifact_identity`

约束：

- `formal_spec` 只允许用于 spec review/static validation sample。
- `stub` 和 `fake_host` 不能满足 live/account-touching closeout 或 #1188 gate allow。
- `write_prepare` / `live_write_commit` 必须消费 exact-scope account safety ref。

### `WebEnvoyRiskEvidenceRef`

职责：表达某个可消费 evidence lane 的 locator、owner、sensitivity、redaction、freshness 与 artifact identity。

关键字段：

- `evidence_class`
- `ref`
- `owner_ref`
- `sensitivity`
- `redaction_state`
- `freshness_ref`
- `collected_at`
- `expires_at`
- `artifact_identity`

约束：

- `redaction_state` 必须与 `FR-0040` / `FR-0041` 对齐。
- `redaction_required|policy_missing|invalid` 命中 required evidence 时必须 fail-closed。
- Real evaluation 必须提供 freshness 证据；formal sample 可使用 synthetic context。

### `RiskEvidenceGateResult`

职责：表达 #1183-owned risk evidence evaluation 的输出，并交给 #1188 或 blocker owner。

关键字段：

- `risk_state`
- `decision`
- `blocking_reasons`
- `risk_evidence_ref`
- `evidence_refs_consumed`
- `evaluated_at`
- `downstream_owner`

约束：

- `decision=allow_input_to_1188` 只表示可交给 #1188 作为必要输入，不表示 read/write gate allow。
- `blocking_reasons` 非空时必须 `deny` 或 `defer`。
- `defer` 必须有 concrete downstream owner。

## 关系

```text
FR-0069 Provider-Owned Stealth Boundary
        |
        | provider declarations / limitations / redacted refs only
        v
WebEnvoy-Owned Risk Evidence Boundary (#1183 / FR-0070)
        |
        | risk evidence states / blockers / handoff refs
        v
Risk Hint Consumer Gate (#1188)
        |
        | later read/write gate behavior
        v
Read / Write / Closeout gate decisions
```

Sibling inputs:

```text
FR-0066 / #1176 Account Safety Gate
#1187 Account Safety Signal Integration
FR-0067 Extension Native Bridge Gate
FR-0068 Default Commit Lock
Live evidence / route evidence / behavior baseline owners
        |
        v
WebEnvoy-Owned Risk Evidence Boundary (#1183)
```

## Risk evidence state 与 handoff blockers

后续 consumer 至少必须处理以下 `WebEnvoyRiskEvidenceState` 值：

- `missing`: required evidence 不存在。
- `unclassified`: evidence 存在但无法归类为 accepted or blocked。
- `stale`: freshness 不满足当前请求。
- `scope_mismatch`: workflow/capability/target/profile/provider/head/run/page/artifact 不匹配。
- `redaction_invalid`: evidence 或 ref 暴露 forbidden data。
- `provider_private_boundary_violation`: provider private internals 被展开或作为 proof。

以下不是 risk evidence state，只能作为 blocking reasons 或 handoff blockers：

- `risk_hint_consumer_required`: risk evidence 已到达 #1188 需要消费的边界；它不是 #1183 定义的 read/write gate allow，也不是 risk state。
- `downstream_owner_required`: 当前阻断必须交给 account safety / runtime / provider / live evidence owner；它不是 risk state。

未分类状态、未知 state enum、未知 blocking reason 或影响目标 capability 的 missing state 必须 fail-closed。
