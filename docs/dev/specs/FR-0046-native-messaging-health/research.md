# FR-0046 research

## 输入来源

- Issue #1141: Native Messaging Health。
- Parent #1113: official-chrome Provider。
- `FR-0038 Provider Health / Doctor Contract`: health report shape、status、failure semantics、evidence refs、required check mapping and fail-closed policy。
- `FR-0040 Provider Evidence Kernel`: provider evidence record Native Messaging status and evidence refs。
- `FR-0041 Evidence Redaction Policy`: sensitivity、redaction state、locator and secret handling。
- `FR-0043 official-chrome.persistent Descriptor`: persistent provider Native Messaging readiness refs。
- Issue #1140 and #1142: adjacent health owners that must not be redefined here。

## 关键判断

### FR 编号

Scheduler 固定要求本 issue 使用 `FR-0046-native-messaging-health`，不得抢占 FR-0044/0045/0047。本 branch 从 main `839c15b454ac101962f0a071e213eb664fdaaede` 创建，main 当前已有 FR-0043，故本 suite 使用 FR-0046。

### Schema ownership

FR-0038 已冻结:

- `ProviderDoctorCheckCategory` includes `native_messaging`。
- `ProviderDoctorCheckStatus` includes `pass|warn|fail|not_applicable|unknown`。
- `ProviderDoctorEvidenceRef` shape。
- Required check mapping for `native_messaging_support=required` and capability requirement `native_messaging`。

因此 #1141 不需要也不能定义新 health result schema。正确做法是冻结 `native_messaging` category 下的 required check ids、diagnostics codes、evidence requirements and fail-closed semantics。

### Adjacent owner separation

- #1140 owns persistent extension identity health。FR-0046 可以要求 allowed origins 与 extension identity conclusion 对齐，但不能定义 extension identity pass。
- #1142 owns extension service worker freshness health。FR-0046 可以 require bridge handshake source and freshness evidence, but cannot define service worker code identity or freshness schema。
- #1139 owns capability matrix。FR-0046 only says how requested capability consumes `native_messaging` requirement through FR-0038 capability readiness。
- #1143 owns launch evidence; #1144 owns official Chrome fixtures。

### Integration 判断

Issue #1141 is WebEnvoy-local official Chrome provider health scope. This PR does not change Syvert normalized result, cross-repo shared result shape, task/run/request id semantics, or joint acceptance requirement.

PR metadata should use:

- `integration_applicable: no`
- `integration_touchpoint: none`
- `integration_ref: none`
- `shared_contract_changed: no`
- `external_dependency: none`
- `merge_gate: local_only`
- `contract_surface: none`
- `joint_acceptance_needed: no`

Rationale: this FR consumes the already-shared FR-0038 doctor contract and specializes official Chrome native messaging readiness locally; it does not modify the shared provider health schema.

### Live evidence 判断

This PR does not claim:

- official runtime loop complete
- real browser interaction complete
- real live read/write complete
- latest-head live evidence collected

Therefore `live_evidence_record` must be `N/A`; validation is docs/spec/map/purity/diff checks and hosted checks only.

## 无新增外部未知项

This formal suite does not require:

- launching Chrome
- loading an extension
- registering Native Messaging host
- opening socket / pipe
- running bridge handshake
- using Playwright or browser profile
- collecting runtime/live/account evidence

Any later implementation that performs these actions must establish readiness/admission and follow applicable live/runtime gates.
