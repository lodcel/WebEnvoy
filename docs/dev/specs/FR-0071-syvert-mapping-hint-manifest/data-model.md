# FR-0071 Logical Data Model

本 FR 不新增 SQLite 表、迁移、runtime output schema、CLI stdout schema、JSON-RPC schema 或 provider adapter schema。本文件只冻结后续 parser / documentation / downstream consumer 可引用的 logical entities。

## 实体

### `SyvertMappingHintManifest`

职责：表达 WebEnvoy-owned mapping hints、source bindings、mapping gaps、consumer actions、non-proof signals 与 blockers。

关键字段：

- `identity`: manifest id、version、owner、canonical issue、integration mode 与 producer / consumer boundary。
- `source_contract_refs`: 该 manifest 引用的 WebEnvoy formal contract refs。
- `hints`: WebEnvoy-owned hint item 列表。
- `mapping_gaps`: 下游 normalization / taxonomy / workflow mapping 缺口。
- `consumer_actions`: 下游 owner 需要执行的 action。
- `non_proofs`: manifest 不证明的事项。
- `blockers`: 当前 manifest 不能被消费的 blocker。

生命周期：

- Created by this formal spec suite.
- Consumed by future downstream documentation, parser, Syvert-owned contract, or wrapper work only after those owners explicitly consume it.
- Invalidated or treated as stale when source contract ref、scope、head、run、target、redaction policy or downstream owner changes.

### `MappingHintItem`

职责：表达一个具体 hint 及其来源、允许效果和禁止效果。

关键字段：

- `hint_id`
- `hint_class`
- `hint_value_ref`
- `source_binding`
- `mapping_intent`
- `allowed_effect`
- `forbidden_effects`

约束：

- `hint_value_ref` 只能是 opaque ref、redacted locator、checksum、contract ref 或 synthetic sample。
- `allowed_effect=downstream_mapping_input` 只能用于 `source_binding_state=bound` 且具备非空 `source_ref` 的 consumable hint。
- `allowed_effect=blocker_explanation` 是缺失、未知或不可追踪 source 的唯一允许效果。
- `forbidden_effects` 必须覆盖 Syvert normalized result、resource taxonomy、error taxonomy、provider adapter、JSON-RPC wrapper、live evidence 和 integration gate。

### `MappingHintSourceBinding`

职责：绑定 hint 与 WebEnvoy formal source。

关键字段：

- `source_contract_ref`
- `source_section`
- `source_ref`
- `source_owner`
- `source_binding_state`
- `scope`
- `freshness`
- `redaction_state`

约束：

- `source_binding_state=bound` 表示 hint 有机器可核查的 WebEnvoy-owned source binding；此时 `source_section` 不得为 `unknown|null`，`source_owner` 不得为 `unknown|downstream_owner_required`，`source_ref` 不得为空。
- `source_binding_state=untraceable` 表示 WebEnvoy 没有可消费 source binding；此时 hint 只能作为 blocker explanation，不得作为 downstream mapping input。
- `freshness=historical_background|unknown` 不得作为 current accepted mapping input。
- `redaction_required|policy_missing|invalid` 命中 required hint 时必须 fail closed。

### `MappingGapHint`

职责：表达 WebEnvoy 不拥有但下游 mapping 需要补齐的缺口。

关键字段：

- `gap_id`
- `gap_class`
- `owner`
- `webenvoy_default_allowed`
- `required_action`

约束：

- `webenvoy_default_allowed` 固定为 `false`。
- `owner` 必须是 Syvert-owned contract 或 generic downstream-owned contract。
- Gap 不得包含默认 normalized result、resource type 或 error code。

## 关系

```text
WebEnvoy formal outputs / evidence refs
        |
        v
SyvertMappingHintManifest (#1199 / FR-0071)
        |
        | hints + gaps + non-proofs
        v
Future Syvert-owned or downstream-owned mapping contract
```

## 状态与失效条件

Manifest 或 hint item 在以下情况下不能作为 downstream mapping input：

- manifest version 未知。
- hint class 未知。
- required source ref 缺失。
- `source_section=unknown|null`、`source_owner=unknown|downstream_owner_required` 或 `source_ref=null` 与 `allowed_effect=downstream_mapping_input` 同时出现。
- source contract ref 不存在或不匹配。
- scope / head / run / target drift。
- freshness 为 historical / unknown 且 consumer 要求 current input。
- redaction invalid、policy missing 或 sensitive payload 内联。
- forbidden Syvert / provider / JSON-RPC / live-write 字段出现。
- consumer 试图把 hint 直接提升为 normalized result。

## 非持久化说明

本 FR 不要求 WebEnvoy 持久化 manifest，也不要求 runtime 立即输出 manifest。后续如需把 manifest 写入 CLI stdout、artifact、JSON-RPC response、SQLite 或 provider adapter output，必须另开 issue / formal spec，并重新评估 shared contract 与 integration gate。
