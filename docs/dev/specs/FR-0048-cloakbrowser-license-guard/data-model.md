# FR-0048 Data Model

## 数据模型定位

本 FR 不新增 runtime schema、provider registry row、provider doctor report、launch envelope、release artifact manifest 或 persistent storage migration。

本 FR 只冻结 `cloakbrowser_license_guard` 的 formal data shape，用于后续 provider selection、provider evidence、doctor input 或 #1212 release packaging audit 消费：

- `guard_identity`
- `redistribution_policy`
- `operator_binary`
- `license_acknowledgement`
- `binary_source_evidence`
- `audit_consumption`
- `blocking_reasons`

## 上游输入

| 输入 | 来源 | 用途 | 约束 |
|---|---|---|---|
| provider id / provider family | FR-0033 或后续 provider registry consumer | 绑定 CloakBrowser managed provider | 不得使用 binary path、profile name、vendor account id 代替 |
| binary locator ref | operator-installed environment | 表达 operator-installed binary handle | 必须按 FR-0041 脱敏，默认至少 `sensitive` |
| license acknowledgement | operator / legal review / vendor account ref / manual record | 证明 operator 已确认许可责任 | 不复制第三方 license 全文，不暴露 license key 或账号数据 |
| binary source evidence | operator / provider broker / diagnostic input | 证明 binary source 与 ownership | 不得内联 raw download URL、credential、private path 或 binary payload |
| provider evidence refs | FR-0040 | 证据索引、freshness、artifact identity | required evidence stale / redaction invalid 时 fail-closed |
| redaction policy | FR-0041 | sensitivity、locator、secret handling | policy missing 或 invalid 命中 required evidence 时 fail-closed |
| audit closeout input | #1212 | release packaging audit 消费本 guard | 不得重定义 ownership model 或再分发规则 |

## 数据关系

### Redistribution policy

`redistribution_policy` 是强约束，不是配置偏好：

- `bundled_binary_allowed=false`
- `redistribution_allowed_by_webenvoy=false`
- `repository_binary_allowed=false`
- `release_artifact_binary_allowed=false`
- `fixture_binary_allowed=false`
- `encoded_payload_allowed=false`

任何后续 implementation 或 release gate 如果需要改变这些值，必须走新的 formal spec / legal review 事项；不得在 #1212 closeout 或 provider implementation PR 中临时降级。

### Operator binary

`operator_binary.ownership_model=operator_installed_binary` 是唯一合法模型。

允许的数据：

- opaque binary handle
- hash locator
- redacted private locator
- artifact identity
- logical source id

禁止的数据：

- raw private absolute path on public surfaces
- raw binary payload
- installer / archive / native component copy
- credential-bearing download URL
- license key
- vendor account id

### License acknowledgement

`license_acknowledgement` 只表达 operator 已确认许可责任。

有效状态：

- `acknowledgement_status=acknowledged`
- scope 覆盖目标用途，例如 release audit 需要 `release_packaging_audit`
- evidence refs redaction valid

阻断状态：

- `pending`
- `rejected`
- `expired`
- `unknown`
- scope mismatch
- missing / invalid evidence ref

### Binary source evidence

Required binary source evidence 必须同时满足：

- `source_kind=operator_installed_binary`，或后续 provider-specific contract 明确允许更窄 broker locator。
- `source_owner!=unknown`
- `installed_by!=unknown`
- freshness 满足目标 gate。
- redaction state 可被 FR-0041 接受。

`checksum_ref` 可以用于 identity / integrity 结论，但不能作为 redistribution permission。

## Fail-closed 数据关系

- bundled binary detected -> `bundled_binary_detected`，阻断 provider eligibility 和 #1212 closeout。
- encoded / encrypted / compressed proprietary payload detected -> `redistribution_payload_detected`。
- operator binary missing or unknown -> `operator_binary_missing` 或 `operator_binary_source_unknown`。
- license acknowledgement 缺失或不是 `acknowledged` -> `license_acknowledgement_missing` 或 `license_acknowledgement_not_accepted`。
- acknowledgement scope 不覆盖目标用途 -> `license_scope_mismatch`。
- binary source evidence 缺失、stale 或 unknown -> `binary_source_evidence_missing` / `binary_source_evidence_stale`。
- required redaction invalid -> `binary_source_redaction_invalid`。
- public surface 泄露 raw private locator 或 secret -> `raw_private_locator_leaked` / `secret_or_license_material_leaked`。
- provider self-declaration 替代 guard evidence -> `provider_self_declaration_only`。

## 下游消费

| 下游 | 可消费内容 | 不可消费内容 |
|---|---|---|
| provider selection | guard pass / blocking reasons / redacted refs | provider runtime ready 结论 |
| provider doctor | binary source evidence ref / acknowledgement ref / blocker | 新 doctor schema 或 binary discovery implementation |
| provider evidence kernel | evidence refs、freshness、artifact identity、redaction state | raw binary path、payload、credential |
| #1212 release audit | no bundled binary、repository / release scan ref、license ack ref、binary source ref | 新 license ownership model 或 runtime closeout |
| fixtures / examples | synthetic redacted sample | real binary path、license key、vendor account、binary payload |
