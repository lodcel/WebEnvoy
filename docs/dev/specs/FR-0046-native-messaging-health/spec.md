# FR-0046 Native Messaging Health

Canonical Issue: #1141

## 背景

`#1141` 属于 `#1113 M3 official-chrome Provider` 的 M3-C capability and health 批次。上游 `FR-0038 Provider Health / Doctor Contract` 已冻结 provider health / doctor report 的 status、failure semantics、evidence refs 与 fail-closed 规则；`FR-0043 official-chrome.persistent Descriptor` 已为 persistent provider 留出 `native_messaging_readiness_refs`，但没有定义 health result schema。

本 FR 只定义 `official-chrome.persistent` 的 Native Messaging host / socket / bridge readiness 应如何映射到 `FR-0038.provider_doctor_report` 的 `native_messaging` check。它不定义新的 health result schema，不实现 Native Messaging host、socket、bridge、CLI、runtime、extension、Playwright 或 browser 行为。

`#1141` 的 issue meta 已声明 `Close Semantics: work-item-complete`。本 suite 合入后关闭 #1141 的规约定义事项；runtime health implementation、fixtures、launch evidence、guardian/formal review 与 merge gate 由后续 owner 或 scheduler 承接。

## 目标

1. 冻结 official Chrome Native Messaging health 的 scoped readiness categories：host identity、manifest locator、allowed origins、host registration、socket availability 与 bridge handshake readiness。
2. 规定这些 readiness facts 只能写入 `FR-0038.provider_doctor_report.checks[*].category="native_messaging"`，不得新增 report schema。
3. 明确 failure codes、blocking level、capability attribution 与 aggregate outcome 的 fail-closed 语义。
4. 规定 health evidence refs 必须消费 `FR-0040` evidence refs 与 `FR-0041` redaction policy，不得内联 secret、private path 或 manifest 原文。
5. 为 #1144 official Chrome fixtures 和后续 runtime health implementation 提供可消费 formal 输入。

## 非目标

- 不定义新的 health result schema、runtime status row、Native Messaging report object 或 bridge-specific output envelope。
- 不实现 doctor command、health runner、Native Messaging host、socket server、bridge protocol、extension runtime、CLI、Playwright、provider registry、fixtures 或 tests。
- 不定义 persistent extension identity health；该范围属于 #1140。
- 不定义 extension service worker freshness health；该范围属于 #1142。
- 不定义 capability matrix、supported action rows 或 verification threshold；该范围属于 #1139。
- 不推进 #1143 launch evidence、#1144 fixtures、Syvert normalized result、CloakBrowser-as-core、browser patching、XHS driver、live read/write 或 account-touching behavior。
- 不要求 fresh live evidence；本 FR 是 formal spec review PR，`live_evidence_record` 为 `N/A`。

## 功能需求

### 1. Health ownership

Native Messaging Health 属于 `official-chrome.persistent` 的 provider/runtime diagnostics surface。

约束：

- 后续 health implementation 必须输出 `FR-0038.provider_doctor_report`。
- 所有 Native Messaging readiness checks 必须使用 `category="native_messaging"`。
- 本 FR 只定义 check semantics、required evidence 和 failure mapping；不新增 `ProviderDoctorCheckCategory`、status、severity、blocking、evidence kind 或 outcome 字段。
- `FR-0043.native_messaging_readiness_refs` 是本 FR 的 descriptor input；descriptor refs 不是 health pass。

### 2. Required readiness checks

当 `official-chrome.persistent.transport.native_messaging_support="required"`，或目标 capability 的 runtime requirements 包含 `native_messaging`，doctor report 必须至少包含以下 `native_messaging` provider-level checks：

- `native_host_identity`
- `native_host_manifest`
- `allowed_origins`
- `host_registration`
- `socket_availability`
- `bridge_handshake`

约束：

- 每项 check 必须是 `ProviderDoctorCheck`，`category="native_messaging"`。
- Provider-level check 使用 `capability_id="N/A"`。
- 如果 requested capability 需要 `native_messaging`，还必须有对应 `capability_readiness` check 消费这些 provider-level results。
- 任一 required Native Messaging check 缺失、`unknown`、`fail` 或 required evidence 不可用时，受影响 provider 或 capability 必须 fail-closed。

### 3. Host identity readiness

`native_host_identity` check 必须判断 selected provider 是否引用了可识别的 Native Messaging host identity。

必须验证：

- `native_host_identity_ref` 存在并可追溯到 `FR-0043.native_messaging_readiness_refs.native_host_identity_ref`。
- host name / logical id 与 `official-chrome.persistent` provider namespace 一致。
- host identity 不以内联 secret、account id、private absolute path 或 manifest 原文表达。

失败语义：

- identity 缺失、provider mismatch、unrecognized host id 或 secret/path 泄露时，check 必须 `status=fail`。
- 命中 required persistent provider 时，`blocking=provider_blocking`。

### 4. Manifest and allowed origins readiness

`native_host_manifest` 与 `allowed_origins` checks 必须判断 Native Messaging manifest locator 与 allowed origins ref 是否存在、可解析且与 persistent extension identity boundary 对齐。

必须验证：

- `native_host_manifest_ref` 是 redacted/private locator 或 artifact locator，不是完整 manifest 原文。
- `allowed_origins_ref` 存在，且以 redacted origin ref 或 logical locator 表达。
- allowed origin 必须可绑定到后续 #1140 persistent extension identity health 的 extension identity conclusion；本 FR 不自行定义 extension identity pass。
- manifest locator、allowed origins source 和 registration evidence 均符合 `FR-0041` redaction policy。

失败语义：

- manifest ref 缺失、不可解析、redaction invalid、allowed origins 缺失或无法绑定 extension identity owner 时，check 必须 fail-closed。
- 如果缺口只因为 #1140 尚未提供 extension identity conclusion，diagnostics 必须使用 `minimum_next_verification_level="runtime_attested"` 或等价 next gate，而不得把 native messaging check 标为 `pass`。

### 5. Host registration readiness

`host_registration` check 必须判断 host registration ref 是否能证明 selected Chrome channel 可发现 Native Messaging host。

必须验证：

- `host_registration_ref` 存在。
- registration conclusion 能关联 `browser_channel="Google Chrome stable"` 或 equivalent official Chrome stable locator。
- registration evidence 不包含 raw registry path、home path、manifest absolute path、credential-bearing argv/env 或 host private payload。

失败语义：

- registration missing、wrong browser channel、stale registration、unredacted private locator 或 source conflict 必须 `status=fail`。
- required evidence `partial|unavailable` 时不得 `status=pass`。

### 6. Socket availability readiness

`socket_availability` check 必须判断 Native Messaging transport 的 local socket / pipe / stdio bridge 是否可用于 host communication preflight。

约束：

- 本 FR 不冻结 socket implementation、path、pipe name、port、lifecycle 或 retry algorithm。
- health output只能表达可消费结论：`available`、`partial`、`unavailable`、`unknown` evidence status 与 FR-0038 status。
- socket locator 默认至少 `sensitive`；public summary 只能使用 redacted locator 或 artifact identity。
- socket availability 不等于 runtime bootstrap ready、target tab ready、真实页面交互成功或 live evidence accepted。

失败语义：

- socket unavailable、permission denied、stale/disconnected、locator redaction invalid 或 transport owner mismatch 必须阻断 required Native Messaging health。

### 7. Bridge handshake readiness

`bridge_handshake` check 必须判断 extension-to-native-host bridge 能完成最小 health handshake preflight。

约束：

- handshake 只证明 Native Messaging bridge preflight；不得被表述为 runtime attestation、live evidence、page command success 或 account safe。
- handshake payload 不得包含 bootstrap secret、extension private payload、token、Cookie、profile path 或 raw manifest content。
- 如果 handshake 只来自 stub/fake host、historical artifact 或 non-official Chrome surface，must fail closed for `official-chrome.persistent` provider admission。

失败语义：

- no ack、version mismatch、provider id mismatch、extension origin mismatch、secret leak、stub/fake host source 或 stale evidence 必须 `status=fail|unknown`，并设置 blocking。

### 8. Diagnostics codes

Native Messaging health diagnostics 必须使用稳定 machine-readable code。至少冻结以下 code namespace：

- `native_messaging.host_identity_missing`
- `native_messaging.host_identity_mismatch`
- `native_messaging.manifest_ref_missing`
- `native_messaging.manifest_ref_invalid`
- `native_messaging.allowed_origins_missing`
- `native_messaging.allowed_origins_mismatch`
- `native_messaging.registration_missing`
- `native_messaging.registration_channel_mismatch`
- `native_messaging.socket_unavailable`
- `native_messaging.socket_stale_or_disconnected`
- `native_messaging.bridge_handshake_missing`
- `native_messaging.bridge_handshake_mismatch`
- `native_messaging.stub_or_fake_host_evidence`
- `native_messaging.evidence_redaction_invalid`
- `native_messaging.required_evidence_unavailable`

约束：

- diagnostics `observed`、`expected` 与 `remediation_hint` 不得包含 secret 或 raw private path。
- 新增 code 可以在后续实现中细化，但不得降低 fail-closed 语义。

### 9. Evidence refs and redaction

每个 Native Messaging health check 必须提供 `evidence_refs`，并按 `FR-0038` shape 表达。

约束：

- evidence refs 必须能映射或引用 `FR-0040.provider_evidence_record.native_messaging_status`、`provider_evidence_record.evidence_refs` 或 equivalent future artifact locator。
- `native_host_manifest_ref`、`allowed_origin_ref`、socket locator、command output excerpt 和 bridge artifact 默认至少 `sensitive`。
- bootstrap secret、extension private payload、provider private patch secret、token、Cookie、auth header、profile path 或 account id 必须按 `FR-0041` 处理；原值不得进入 spec sample、PR body、stdout summary 或 public artifact。
- `sensitivity=secret` 只能以 redacted locator / secret handle 表达。
- `redaction_required|policy_missing|invalid` 命中 required evidence 时，check 不得 pass。

### 10. Capability readiness consumption

当 requested capability 声明 `native_messaging` runtime requirement 时，对应 `capability_readiness` check 必须消费本 FR 的 provider-level Native Messaging checks。

约束：

- 所有 required provider-level Native Messaging checks `pass|not_applicable` 且无 blocking 时，`native_messaging` 可进入 `satisfied_runtime_requirements`。
- 任一 required check `fail|unknown`、required evidence missing 或 redaction invalid 时，`native_messaging` 必须进入 `unsatisfied_runtime_requirements`。
- `provider_doctor_passed` 仍按 `FR-0038` 聚合规则处理；本 FR 不重新定义 capability readiness schema。
- `target_tab`、`runtime_bootstrap_ready`、`runtime_attested` 与 `live_evidence_attested` 不得由 Native Messaging health 自行满足。

## GWT 验收场景

### 场景 1：完整 Native Messaging readiness 通过

Given selected provider is `official-chrome.persistent`
And FR-0038 doctor report contains all required `native_messaging` checks
And each required evidence ref is available, current for the doctor scope and redacted by FR-0041
When provider admission consumes the report
Then the Native Messaging provider-level checks may be `status=pass`
And requested capability may satisfy `native_messaging`
And the report still must not claim runtime attestation or live evidence.

### 场景 2：manifest ref 缺失

Given `native_host_manifest_ref` is missing
When Native Messaging health is evaluated
Then `native_host_manifest` must be `status=fail`
And diagnostics code must be `native_messaging.manifest_ref_missing`
And required provider or capability admission must fail closed.

### 场景 3：allowed origins 依赖 #1140

Given allowed origins can only be validated after persistent extension identity is known
When #1140 has not provided a consumable extension identity conclusion
Then `allowed_origins` must not be marked `pass`
And the report must point to the next runtime/health gate rather than defining extension identity health in this FR.

### 场景 4：stub/fake host evidence

Given bridge handshake evidence comes from a stub host or non-official Chrome surface
When the health report targets `official-chrome.persistent`
Then `bridge_handshake` must fail closed
And diagnostics code must be `native_messaging.stub_or_fake_host_evidence`.

### 场景 5：secret leakage

Given a Native Messaging evidence ref or sample contains raw bootstrap secret, Cookie, token, profile path or manifest private payload
When the report is validated
Then the evidence must be invalid
And the related check must not pass
And public summaries must only contain redacted locator or structured blocker.

### 场景 6：socket available but runtime not attested

Given socket availability and bridge handshake preflight pass
When no runtime attestation or target tab evidence exists
Then Native Messaging health may only support `doctor_checked`
And `target_tab`, `runtime_bootstrap_ready` and live evidence requirements remain unsatisfied.

## 异常与边界场景

- Required Native Messaging check missing: consumer must treat the report as invalid for affected provider / capability and fail closed.
- Unknown status: `status=unknown` on `native_messaging` required checks blocks affected provider / capability admission.
- Partial evidence: required evidence with `status=partial|unavailable` cannot support `status=pass`.
- Redaction gap: manifest, allowed origins, socket or bridge evidence with `redaction_required|policy_missing|invalid` must block the related check.
- Secret leak: raw bootstrap secret, Cookie, token, auth header, extension private payload, provider private patch payload, profile path or account id invalidates evidence and must not be copied into public summary.
- Adjacent owner gap: missing #1140 extension identity conclusion or #1142 service worker freshness conclusion must remain a next gate, not be filled by this FR.
- Stub/fake source: stub host, fake host, historical artifact or non-official Chrome surface cannot satisfy `official-chrome.persistent` Native Messaging readiness.
- Runtime boundary: socket availability and bridge handshake preflight do not satisfy target tab binding, runtime bootstrap readiness, runtime attestation or live evidence.

## 验收标准

- FR-0046 suite exists at `docs/dev/specs/FR-0046-native-messaging-health/`.
- `.github/spec-issue-sync-map.yml` maps `docs/dev/specs/FR-0046-native-messaging-health/spec.md` to #1141.
- Spec clearly consumes `FR-0038` status、failure semantics and evidence refs without defining a new health result schema.
- Spec consumes `FR-0040` evidence refs and `FR-0041` redaction policy.
- Spec consumes `FR-0043.native_messaging_readiness_refs`.
- Spec excludes #1140 persistent extension identity health, #1142 service worker freshness health, #1139 capability matrix, #1143 launch evidence and #1144 fixtures.
- PR touches only FR-0046 suite and sync map, with no runtime/code/live/browser changes.
