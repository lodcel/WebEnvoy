# FR-0045 Data Model

## 定位

本 FR 不引入新的持久化表、迁移、runtime status row、doctor command、health result schema 或 evidence record shape。这里的 data model 只冻结 persistent extension identity/source binding health check definition，供后续 doctor / admission / fixture owner 消费。

## 核心对象

### `persistent_extension_identity_health_check`

职责：

- 表达 `official-chrome.persistent` 必须具备的 extension identity/source binding required health check。
- 作为 `FR-0038.provider_doctor_report.checks[*]` 的 `category=extension_load` check profile 被消费。
- 绑定 expected extension identity ref、observed extension identity、profile-scoped source binding、evidence refs 与 fail-closed 规则。

非职责：

- 不表达新的 result object。
- 不表达 Native Messaging health。
- 不表达 service worker freshness。
- 不表达 capability matrix。
- 不表达 launch evidence、runtime attestation、live evidence 或 fixture payload。

生命周期：

1. `defined`：本 FR 合入后冻结 check definition。
2. `implemented`：后续 doctor/runtime owner 实现实际 probing。
3. `reported`：后续 doctor report 以 `FR-0038` shape 输出 check。
4. `consumed`：provider admission / capability admission 消费 check outcome。
5. `superseded`：若 extension identity/source binding rules 需要改变，必须通过独立 formal spec review 修订。

### `expected_extension_identity_binding`

职责：

- 引用 `FR-0043.extension_binding.extension_identity_ref` 与 `extension_installation_ref`。
- 表达 expected stable extension id、manifest identity/version source 与 profile-scoped installation ref。

约束：

- expected refs 是 locator，不是 secret carrier。
- expected refs 不得内联 cookie、token、storage、raw profile path、raw extension private path 或 account credential。
- expected refs 缺失或不可解析时，required check 必须 fail-closed。

### `observed_extension_identity_binding`

职责：

- 表达后续 implementation 在 official Chrome persistent profile 中观察到的 extension identity/source/profile binding facts。
- 只作为 `FR-0038` diagnostics observed value 与 evidence refs 的语义输入。

约束：

- observed extension id、manifest identity/version、source/installation ref 与 profile binding 必须与 expected refs 匹配。
- observed facts 不得把 runtime ping、bootstrap ack、service worker freshness 或 native messaging readiness 写成 identity/source binding match。
- raw observed local paths 必须通过 `FR-0041` policy 脱敏。

### `persistent_extension_identity_evidence_ref`

职责：

- 引用 extension identity/source binding check 依赖的 evidence。
- 对齐 `FR-0038.evidence_refs` 与 `FR-0040.provider_evidence_record.evidence_refs[*]`。

允许的 evidence refs：

- `FR-0038`: `extension_state_ref`、`profile_state_ref`、`doctor_artifact_ref`。
- `FR-0040`: `extension_binding_ref`、`profile_binding_ref`、`browser_channel_attestation`、`provider_health_ref`。

约束：

- evidence ref 是 locator，不是 raw evidence content。
- required evidence `unavailable|partial`、stale、`redaction_required|policy_missing|invalid` 时必须 fail-closed。
- `sensitivity=sensitive|secret` 必须遵循 `FR-0041` locator 与 disclosure rules。

## 字段 ownership

| 字段组 | Ownership | 不得替代 |
|---|---|---|
| health report carrier | FR-0038 | 新 health result schema |
| persistent descriptor refs | FR-0043 | runtime ready / install proof |
| extension identity/source binding check definition | FR-0045 | native messaging health、service worker freshness |
| evidence ref shape | FR-0038 / FR-0040 | launch evidence schema、fixture payload |
| redaction / disclosure | FR-0041 | secret store、artifact store、live evidence gate |

## 兼容策略

- 本 check definition 当前版本随 `FR-0045` suite 固定为 `v1`。
- 同一主版本内可以新增更具体的 non-breaking remediation guidance，但不得新增 result object、status enum 或 blocking enum。
- 改变 fail-closed 条件、允许 raw sensitive locator 公开、把 native messaging / service worker health 并入本 check，或把 doctor pass 提升为 runtime/live attestation，必须重新进入 formal spec review。
