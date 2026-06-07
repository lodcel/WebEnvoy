# FR-0044 Data Model

## 1. `official_chrome_capability_matrix`

`official_chrome_capability_matrix` 是 #1139 的 formal matrix carrier。它只承载 official Chrome provider variants 的 capability support rows，不承载 descriptor shape、health result、runtime state、launch evidence、live evidence 或 fixture payload。

核心字段：

- `matrix_id`: `official-chrome.capability-matrix.v1`
- `matrix_owner`: `#1139` / `FR-0044`
- `descriptor_inputs`: `FR-0042`, `FR-0043`
- `verification_model_input`: `FR-0035`
- `rows`: `OfficialChromeCapabilityRow[]`

## 2. `OfficialChromeCapabilityRow`

每一行表达一个 provider variant 对一个 capability 的静态支持结论。

字段：

- `provider_id`
- `capability_id`
- `capability_kind`
- `supported_actions`
- `supported_execution_layers`
- `required_runtime_requirements`
- `support_level`
- `limitations`
- `verification_sources`
- `evidence_ref_strategy`
- `fail_closed_policy`
- `downstream_owner`

约束：

- `provider_id` 只能来自 `FR-0042` 或 `FR-0043`。
- `spec.md` 的 direct / persistent matrix table 与 provider-specific required-field expansion table 共同组成完整 row；任何 consumer 读取 row 时必须同时消费两者。
- `support_level` 消费 `FR-0035.support_state`，不创建新枚举。
- `verification_sources` 消费 `FR-0035.verification_source`，不创建 health schema。
- `evidence_ref_strategy` 是 locator strategy，不是 evidence record。
- `downstream_owner` 只能指向后续 owner，不表示对应输出已存在。

## 3. Support level lifecycle

本 suite 的生命周期停在 static matrix freeze：

- `unsupported`: descriptor 明确缺少 capability 前置，例如 direct 无 extension/native messaging。
- `declared`: capability 只作为 future evidence slot 或 declaration 存在。
- `statically_verified`: descriptor fields、refs、limitations 与 matrix row 已静态一致。
- `blocked`: concrete consumer/admission 命中 `FR-0035` fail-closed 条件。

本 suite 不产生：

- `health_checked`
- `runtime_attested`
- `runtime_observed`
- `live_evidence_attested`

后续 owner 可提供对应 source，但必须通过独立 issue / PR 进入本 matrix 的 consuming flow。

## 4. Evidence ref strategy

允许的 evidence strategy：

- `static_descriptor_ref`: 指向 `FR-0042` 或 `FR-0043`。
- `capability_matrix_ref`: 指向本 `FR-0044`。
- `health_result_ref`: future #1140/#1141/#1142，消费 `FR-0038`。
- `launch_evidence_ref`: future #1143，消费 `FR-0040` / `FR-0041`。
- `fixture_ref`: future #1144。

禁止：

- 内联完整日志、页面内容、cookie、token、账号凭据、native host secret 或 sensitive local path。
- 用 `N/A`、旧 artifact、runtime ping、bootstrap ack、stub/fake host 或 descriptor presence 代替 required evidence。
- 把 future ref slot 解释为 evidence passed。

## 5. Fail-closed policy

所有 matrix row 继承 `FR-0035` default decision policy：

- `allow_declared_only_for_business=false`
- `allow_defer_for_business=false`
- `fail_closed_on_blocking_reasons=true`
- `fail_closed_on_unknown_limitation=true`
- `fail_closed_on_invalid_or_stale_evidence_ref=true`
- `degraded_state_policy=explicit_only`
- `manual_review_policy=confirm_existing_evidence_only`

业务 `read/write/download` 的默认 admission 不得接受 `declared`。当 consumer minimum support state 高于本 matrix 当前 support level 时，必须 deny/defer；已进入 admission 时必须 blocked/deny。

## 6. Ownership boundaries

| 数据 | Owner | 本 FR 是否定义 |
|---|---|---|
| common descriptor shape | FR-0042 / #1137 | 否，只消费 |
| persistent descriptor delta | FR-0043 / #1138 | 否，只消费 |
| support state and decision policy | FR-0035 / #1124 | 否，只消费 |
| official Chrome capability rows | FR-0044 / #1139 | 是 |
| health result schema | FR-0038 and #1140/#1141/#1142 | 否 |
| launch evidence record | FR-0040 / FR-0041 and #1143 | 否 |
| official Chrome fixtures | #1144 | 否 |
