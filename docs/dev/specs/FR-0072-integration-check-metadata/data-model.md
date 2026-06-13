# FR-0072 Logical Data Model

本 FR 不新增 SQLite 表、迁移、runtime output schema、CLI stdout schema、JSON-RPC schema、provider adapter schema 或 integration project storage。本文件只冻结 PR metadata parser、reviewer、guardian merge gate 和 future governance work 可引用的 logical entities。

## 实体

### `IntegrationCheckMetadata`

职责：表达一个 PR 的 integration applicability、touchpoint、shared contract change、external dependency、merge gate、contract surface、joint acceptance 和状态核对结果。

关键字段：

- `integration_applicable`
- `integration_touchpoint`
- `integration_ref`
- `shared_contract_changed`
- `external_dependency`
- `merge_gate`
- `contract_surface`
- `joint_acceptance_needed`
- `integration_status_checked_before_pr`
- `integration_status_checked_before_merge`

生命周期：

- Created or updated in PR body before review.
- Re-read after PR body or head changes.
- Re-read before merge-ready / scheduler-owned gate.
- Invalidated when PR diff, issue scope, dependency state, integration ref state or head SHA changes in a way that affects integration classification.

约束：

- Field values must match `contracts/integration-check-metadata.md`.
- Missing or unknown field values fail closed.
- Local-only metadata must not be inferred when the block is missing.

### `IntegrationRef`

职责：当 PR 被判定为 integration-gated 时，指向可核查的 integration issue 或 project item。

关键字段：

- `ref`
- `ref_kind`
- `owner`
- `status_checked_before_pr`
- `status_checked_before_merge`

约束：

- `integration_applicable=no` 时，`integration_ref` 必须为 `none`。
- `integration_applicable=yes` 时，`integration_ref` 必须是具体可核查 ref；project root、`TBD`、空值或自然语言说明无效。
- `status_checked_before_merge=yes` 不替代 hosted integration run、joint acceptance implementation 或 scheduler gate；它只证明 latest PR metadata 声明作者/worker已核对该 ref。

### `ContractSurface`

职责：分类 integration-gated PR 触及的共享表面。

枚举：

- `none`
- `execution_provider`
- `ids_trace`
- `errors`
- `raw_normalized`
- `diagnostics_observability`
- `runtime_modes`
- `integration_governance`

约束：

- `none` 只允许用于 local-only PR。
- `integration_governance` 用于 integration gate / review 语义、metadata parser / policy 或联合验收口径，不代表 runtime business payload。
- 若 PR 同时触及多个 surface，scheduler / reviewer 应选择最保守 surface 或要求拆分 PR。

### `IntegrationMetadataDisposition`

职责：表达 parser / reviewer / gate 对 PR metadata 的消费结果。

状态：

- `accepted_local_only`
- `accepted_integration_gated`
- `blocked_missing_metadata`
- `blocked_invalid_enum`
- `blocked_invalid_ref`
- `blocked_relationship_mismatch`
- `blocked_status_readback_missing`
- `blocked_surface_mismatch`
- `blocked_scope_mismatch`

约束：

- `accepted_local_only` 只能用于 valid local-only matrix。
- `accepted_integration_gated` 只能用于 valid integration-gated matrix。
- 任一 blocker 状态都不得降级为 warning。

## 关系

```text
PR diff / issue scope / dependency state
        |
        v
IntegrationCheckMetadata
        |
        +--> IntegrationRef
        +--> ContractSurface
        |
        v
IntegrationMetadataDisposition
        |
        v
reviewer / guardian / scheduler merge gate
```

## 非持久化说明

本 FR 不要求 WebEnvoy 持久化 integration metadata，也不要求 runtime 输出该 metadata。PR body 是当前 metadata carrier；未来如需把该 metadata 写入 separate machine artifact、integration project state、SQLite、CLI stdout、JSON-RPC response 或 provider adapter output，必须另开 issue / formal spec，并重新评估 shared contract 与 integration gate。
