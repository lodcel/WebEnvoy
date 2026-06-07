# FR-0047 Data Model

## 数据模型定位

本 FR 不新增持久化实体、runtime row、health result schema 或 launch evidence record。

唯一正式输出模型是 `FR-0038.provider_doctor_report` 的一个 check-level delta:

- `checks[*].category=extension_load`
- `checks[*].check_id=official_chrome_persistent_service_worker_freshness`
- `checks[*].diagnostics.code` 使用本 FR 冻结的 service worker freshness diagnostic code
- `checks[*].evidence_refs` 使用 FR-0038 evidence refs，并可映射到 FR-0040 provider evidence refs

## 上游输入

| 输入 | 来源 | 用途 | 约束 |
|---|---|---|---|
| provider id / contract version / provider version | FR-0038 / FR-0033 consumer input | report identity 对齐 | 不得用显示名称或 profile 名称代替 |
| persistent service worker readiness ref | FR-0043 | 声明 persistent descriptor 需要 service worker readiness | ref 存在不表示 ready |
| expected bundle identity locator | doctor / runtime admission input | 与 observed service worker code identity 比较 | 不得包含 raw private path 或 source |
| observed service worker code identity locator | doctor / runtime observation | 表达 active worker 当前代码身份 | 必须脱敏 |
| evidence refs | FR-0038 / FR-0040 | 证据索引、freshness、artifact identity | required evidence stale 或 unavailable 时 fail-closed |
| redaction policy | FR-0041 | sensitivity、locator、secret handling | redaction gap 命中 required evidence 时 fail-closed |

## 不新增字段的消费方式

后续实现不得新增 top-level health result object。需要表达 freshness detail 时，使用:

- `ProviderDoctorDiagnostics.code`
- `ProviderDoctorDiagnostics.observed`
- `ProviderDoctorDiagnostics.expected`
- `ProviderDoctorDiagnostics.remediation_hint`
- `ProviderDoctorCheck.evidence_refs`

如果实现需要更丰富的内部采集结构，必须作为 implementation-private intermediate，不能进入 formal health output，也不能绕过 FR-0038 parser / gate。

## Fail-closed 数据关系

- expected identity 缺失时，`status=fail`、`severity=fatal`、`blocking=provider_blocking`。
- observed identity 缺失或 unknown 且 extension binding required 时，`status=unknown`、`blocking=provider_blocking`。
- observed stale / mismatch 且 extension binding required 时，`status=fail`、`blocking=provider_blocking`。
- required evidence ref 为 `unavailable|partial` 且无正式降级规则时，不得 `pass`。
- required evidence freshness 为 historical background 时，不得满足 current freshness。
- required evidence redaction 为 `redaction_required|policy_missing|invalid` 时，不得 `pass`。

## 下游消费

| 下游 | 可消费内容 | 不可消费内容 |
|---|---|---|
| provider doctor parser | FR-0038 check status / blocking / diagnostics / evidence refs | 新 health schema |
| runtime admission | doctor_checked 前置和 fail-closed blocker | runtime_attested 或 live_evidence_attested 结论 |
| capability readiness | provider_doctor_passed 是否可满足 | #1139 matrix rows |
| launch evidence | provider health ref locator | launch evidence record shape |
| fixtures | synthetic sample expectation | real profile、path、secret、browser state |
